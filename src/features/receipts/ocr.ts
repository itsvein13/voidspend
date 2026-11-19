// Text recognition behind one function, so the rest of the scanner does not care
// where the text comes from. The real reader is the local Android module in
// modules/receipt-scan (Google ML Kit, on the device). It only exists in a
// development build. Without it (Expo Go, web) the answer is "unavailable" and
// the scan screen sends the person to manual entry with the photo beside it.
import type { OcrLine } from "./parse";

export type OcrResult = { text: string; lines: OcrLine[] };

export type OcrOutcome =
  | { status: "ok"; result: OcrResult }
  | { status: "empty" }
  | { status: "unavailable" }
  | { status: "error"; message: string };

export type OcrProvider = (imageUri: string) => Promise<OcrResult>;

type NativeReader = { recognizeAsync(uri: string): Promise<OcrResult> };

function nativeProvider(): OcrProvider | null {
  try {
    // Loaded lazily: the native side is missing in Expo Go, and that is not an error.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireOptionalNativeModule } = require("expo-modules-core") as { requireOptionalNativeModule: <T>(name: string) => T | null };
    const native = requireOptionalNativeModule<NativeReader>("ReceiptScan");
    return native ? (uri) => native.recognizeAsync(uri) : null;
  } catch {
    return null;
  }
}

let override: OcrProvider | null = null;

/** Replaces the reader. Tests use it, and so could a future cloud or other on-device reader. */
export function setOcrProvider(provider: OcrProvider | null): void {
  override = provider;
}

export function isOcrAvailable(): boolean {
  return override !== null || nativeProvider() !== null;
}

/** Reads a photo. `isCancelled` lets the processing screen stop waiting without leaving a result behind. */
export async function recognizeReceipt(imageUri: string, isCancelled: () => boolean = () => false): Promise<OcrOutcome> {
  const provider = override ?? nativeProvider();
  if (!provider) return { status: "unavailable" };
  try {
    const result = await provider(imageUri);
    if (isCancelled()) return { status: "error", message: "cancelled" };
    return result.text.trim() === "" && result.lines.length === 0 ? { status: "empty" } : { status: "ok", result };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
}
