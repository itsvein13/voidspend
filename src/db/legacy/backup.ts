import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

/**
 * Saves the raw v1 data before the import touches the database. On a phone it
 * is a file in the app's document folder (kept until the app is uninstalled).
 * Web has no file system, so the preview keeps the copy in browser storage.
 */
export async function writeBackupFile(fileName: string, json: string): Promise<string> {
  if (Platform.OS === "web") {
    const key = `backup:${fileName}`;
    await AsyncStorage.setItem(key, json);
    return `browser storage ${key}`;
  }
  const directory = new Directory(Paths.document, "backups");
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, fileName);
  file.create({ overwrite: true });
  file.write(json);
  return file.uri;
}
