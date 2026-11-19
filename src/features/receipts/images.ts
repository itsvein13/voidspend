import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { newId } from "@/lib/ids";

/**
 * Keeps a copy of the receipt photo in the app's own folder and fingerprints it,
 * so the same photo scanned twice can be told apart from a new one. The picker
 * hands over a cache file that the system may clean up, which is why it is copied.
 */
export async function storeReceiptImage(sourceUri: string): Promise<{ path: string; hash: string }> {
  if (Platform.OS === "web") return { path: sourceUri, hash: await hashText(sourceUri) };
  const directory = `${FileSystem.documentDirectory}receipts/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true }).catch(() => undefined);
  const path = `${directory}${newId()}.jpg`;
  await FileSystem.copyAsync({ from: sourceUri, to: path });
  const base64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
  return { path, hash: await hashText(base64) };
}

const hashText = (text: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);

/** Removes a stored photo. A photo that is already gone is not an error. */
export async function deleteReceiptImage(path: string | null): Promise<void> {
  if (!path || Platform.OS === "web") return;
  await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
}
