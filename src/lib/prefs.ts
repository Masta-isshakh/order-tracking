import AsyncStorage from '@react-native-async-storage/async-storage';

/** Namespaced so a future feature can clear only what it owns. */
const KEY = (name: string) => `stars.pref.${name}`;

export const readPref = async (name: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(KEY(name));
  } catch {
    return null;
  }
};

export const writePref = async (name: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY(name), value);
  } catch {
    // A failed preference write must never break the screen the user is on.
  }
};
