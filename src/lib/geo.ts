/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type GeoProperty = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  geo_radius_meters: number;
};

/** Resolve the device's current position, or null if unavailable/denied. */
export function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  });
}

/**
 * IDs of the properties the device is currently within range of.
 * Returns an empty set when geolocation is unavailable or denied — so the
 * caller falls back to "remote" rather than incorrectly claiming on-site.
 */
export async function detectNearbyPropertyIds(
  properties: GeoProperty[],
): Promise<Set<string>> {
  const pos = await getPosition();
  if (!pos) return new Set();
  const { latitude, longitude } = pos.coords;
  const ids = new Set<string>();
  for (const p of properties) {
    if (p.latitude == null || p.longitude == null) continue;
    const dist = haversineMeters(latitude, longitude, p.latitude, p.longitude);
    if (dist <= p.geo_radius_meters) ids.add(p.id);
  }
  return ids;
}

/** Whether the device is currently within range of a single property. */
export async function detectOnsite(property: GeoProperty): Promise<boolean> {
  const ids = await detectNearbyPropertyIds([property]);
  return ids.has(property.id);
}
