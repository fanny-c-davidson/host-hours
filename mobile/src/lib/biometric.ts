import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const PREF_KEY = "hh.biometricEnabled";

/** True if the device has enrolled biometrics (Face ID / fingerprint). */
export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

export async function isBiometricEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(PREF_KEY)) === "1";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(PREF_KEY, enabled ? "1" : "0");
}

/** Prompts for biometric auth. Resolves true on success. */
export async function authenticate(): Promise<boolean> {
  if (Platform.OS === "web") return true;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Host Hours",
    fallbackLabel: "Use passcode",
  });
  return res.success;
}
