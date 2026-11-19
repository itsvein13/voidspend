import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import type { Db } from "@/db/types";

import { shareTextFile } from "../export/share";
import { backupFileName, createBackup } from "./backup";

/** Writes a backup file and opens the share sheet, so it can be saved to Drive, sent to another phone or kept. */
export async function shareBackup(db: Db, date: string): Promise<void> {
  const backup = await createBackup(db);
  await shareTextFile(backupFileName(date), JSON.stringify(backup), "application/json");
}

/** Lets the person pick a file and returns its text. Null when they cancel. */
export async function pickBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ["application/json", "text/plain", "*/*"], copyToCacheDirectory: true });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  if (Platform.OS === "web" && asset.file) return asset.file.text();
  return new File(asset.uri).text();
}
