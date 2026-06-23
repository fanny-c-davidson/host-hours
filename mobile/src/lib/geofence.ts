import { Platform } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { supabase } from "./supabase";
import {
  getActiveTimerByProperty,
  getGeoProperties,
  getMyAutoTimer,
  getMyRole,
  startTimer,
  stopTimer,
} from "./db";

export const GEOFENCE_TASK = "hh-geofence";

// Background handler: auto start/stop the timer as the user enters/leaves an
// assigned property. Runs without React context, so it talks to Supabase
// directly using the session persisted in AsyncStorage. (No-op on web.)
if (Platform.OS !== "web")
  TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }: any) => {
  if (error) return;
  const eventType = data?.eventType as Location.GeofencingEventType;
  const region = data?.region as Location.LocationRegion;
  if (!region?.identifier) return;

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return;

  const propertyId = region.identifier;

  if (eventType === Location.GeofencingEventType.Enter) {
    const existing = await getActiveTimerByProperty(uid, propertyId);
    if (existing) return; // already running for this property
    const role = await getMyRole(uid);
    const at = await getMyAutoTimer(uid, role);
    await startTimer(uid, propertyId, at.defaultTask || "Auto-timer");
  } else if (eventType === Location.GeofencingEventType.Exit) {
    const existing = await getActiveTimerByProperty(uid, propertyId);
    if (existing) await stopTimer(existing, uid);
  }
});

export type GeofenceStatus =
  | { ok: true; regions: number }
  | { ok: false; reason: "web" | "disabled" | "permission" | "no-properties" };

async function stop(): Promise<void> {
  if (Platform.OS === "web") return;
  const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK).catch(() => false);
  if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => {});
}

export async function stopGeofencing() {
  await stop();
}

/**
 * Reconciles geofences with the user's auto-timer setting + properties. Called
 * after toggling auto-timer and on app start. Requests background location when
 * enabling.
 */
export async function syncGeofences(userId: string): Promise<GeofenceStatus> {
  if (Platform.OS === "web") return { ok: false, reason: "web" };

  const role = await getMyRole(userId);
  const at = await getMyAutoTimer(userId, role);
  if (!at.enabled) {
    await stop();
    return { ok: false, reason: "disabled" };
  }

  const fg = await Location.requestForegroundPermissionsAsync();
  const bg = fg.granted ? await Location.requestBackgroundPermissionsAsync() : { granted: false };
  if (!bg.granted) {
    await stop();
    return { ok: false, reason: "permission" };
  }

  const props = await getGeoProperties();
  if (props.length === 0) {
    await stop();
    return { ok: false, reason: "no-properties" };
  }

  await Location.startGeofencingAsync(
    GEOFENCE_TASK,
    props.map((p) => ({
      identifier: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
      radius: p.radius,
      notifyOnEnter: true,
      notifyOnExit: true,
    })),
  );
  return { ok: true, regions: props.length };
}
