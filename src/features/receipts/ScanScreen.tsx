import { Asset } from "expo-asset";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { useDb, useWrite } from "@/db/DatabaseProvider";
import { createReceiptDraft } from "@/db/repo/receipts";
import { Banner, Button, Screen, SheetHeader, Skeleton, Text } from "@/design";
import { useT } from "@/i18n";

import { findSamePhoto } from "./duplicates";
import { deleteReceiptImage, storeReceiptImage } from "./images";
import { recognizeReceipt } from "./ocr";
import { parseReceipt } from "./parse";
import { emptyReview, reviewFromParsed, type ReviewState } from "./review";
import { suggestCategory } from "./suggest";
import { newId } from "@/lib/ids";

type Stored = { path: string; hash: string };
type Phase = { kind: "choose" } | { kind: "busy" } | { kind: "same"; stored: Stored } | { kind: "problem"; reason: "unavailable" | "empty" | "error"; stored: Stored } | { kind: "denied" };

// A made-up receipt for trying the review screen in development, where no text reader exists.
const SAMPLE_TEXT = `INDOMARET
JL. SUDIRMAN NO. 12 JAKARTA
18/11/2026 14:32
INDOMIE GORENG 2 x 3.500 7.000
AQUA 600ML 3.500
TEH BOTOL SOSRO 5.000
SUBTOTAL 15.500
TOTAL 15.500
TUNAI 20.000`;

/** Choose a photo, keep a copy, read it on the device, and open the review. Nothing is saved as an expense here. */
export function ScanScreen() {
  const t = useT();
  const router = useRouter();
  const db = useDb();
  const write = useWrite();
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const cancelled = useRef(false);

  const openReview = async (stored: Stored | null, review: ReviewState, ocrText: string | null) => {
    const id = await write((database) =>
      createReceiptDraft(database, { imagePath: stored?.path ?? null, imageHash: stored?.hash ?? null, ocrText, draftJson: JSON.stringify(review) }),
    );
    router.replace({ pathname: "/receipt/[id]", params: { id } });
  };

  const read = async (stored: Stored) => {
    setPhase({ kind: "busy" });
    cancelled.current = false;
    const outcome = await recognizeReceipt(stored.path, () => cancelled.current);
    if (cancelled.current) {
      await deleteReceiptImage(stored.path);
      setPhase({ kind: "choose" });
      return;
    }
    if (outcome.status === "ok") {
      const parsed = parseReceipt(outcome.result.lines.length > 0 ? outcome.result.lines : outcome.result.text);
      const review = reviewFromParsed(parsed, newId);
      review.categoryId = await suggestCategory(db, review.merchant, review.items.map((item) => item.name));
      await openReview(stored, review, outcome.result.text);
    } else if (outcome.status === "unavailable") {
      // No reader in this build: straight to manual review, with the photo beside the fields.
      await openReview(stored, emptyReview(), null);
    } else {
      setPhase({ kind: "problem", reason: outcome.status, stored });
    }
  };

  const begin = async (uri: string) => {
    setPhase({ kind: "busy" });
    try {
      const stored = await storeReceiptImage(uri);
      if (await findSamePhoto(db, stored.hash)) setPhase({ kind: "same", stored });
      else await read(stored);
    } catch {
      setPhase({ kind: "choose" });
    }
  };

  const pick = async (source: "camera" | "gallery") => {
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return setPhase({ kind: "denied" });
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.8 };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) await begin(result.assets[0].uri);
  };

  // Development only: sends a bundled picture through the real photo pipeline (copy, fingerprint, reader).
  const useSamplePhoto = async () => {
    const asset = Asset.fromModule(require("../../assets/logo.png"));
    await asset.downloadAsync();
    if (asset.localUri) await begin(asset.localUri);
  };

  const useSample = async () => {
    const review = reviewFromParsed(parseReceipt(SAMPLE_TEXT), newId);
    review.categoryId = await suggestCategory(db, review.merchant, review.items.map((item) => item.name));
    await openReview(null, review, SAMPLE_TEXT);
  };

  return (
    <Screen contentStyle={styles.content}>
      <SheetHeader title={t.scan.title} onClose={() => router.back()} grabber={false} />

      {phase.kind === "busy" ? (
        <View accessible accessibilityLabel={t.scan.processing} accessibilityState={{ busy: true }} style={styles.content}>
          <Text variant="heading" accessibilityRole="header">
            {t.scan.processing}
          </Text>
          <Text variant="body" tone="secondary">
            {t.scan.processingBody}
          </Text>
          <Skeleton height={20} width="70%" />
          <Skeleton height={14} />
          <Skeleton height={14} width="85%" />
          <Button
            label={t.scan.cancel}
            variant="quiet"
            onPress={() => {
              cancelled.current = true;
              setPhase({ kind: "choose" });
            }}
            fullWidth
          />
        </View>
      ) : phase.kind === "same" ? (
        <View style={styles.content}>
          <Banner tone="warning" title={t.scan.sameTitle} message={t.scan.sameBody} />
          <Button label={t.scan.continueAnyway} onPress={() => read(phase.stored)} fullWidth />
          <Button
            label={t.scan.cancel}
            variant="quiet"
            onPress={async () => {
              await deleteReceiptImage(phase.stored.path);
              setPhase({ kind: "choose" });
            }}
            fullWidth
          />
        </View>
      ) : phase.kind === "problem" ? (
        <View style={styles.content}>
          <Banner
            tone={phase.reason === "error" ? "danger" : "warning"}
            title={phase.reason === "empty" ? t.scan.emptyTitle : t.scan.errorTitle}
            message={phase.reason === "empty" ? t.scan.emptyBody : t.scan.errorBody}
          />
          <Button label={t.scan.manual} onPress={() => openReview(phase.stored, emptyReview(), null)} fullWidth />
          <Button
            label={t.scan.retake}
            variant="secondary"
            onPress={async () => {
              await deleteReceiptImage(phase.stored.path);
              setPhase({ kind: "choose" });
            }}
            fullWidth
          />
        </View>
      ) : (
        <View style={styles.content}>
          <Text variant="body" tone="secondary">
            {t.scan.hint}
          </Text>
          {phase.kind === "denied" ? <Banner tone="warning" message={t.scan.permissionDenied} /> : null}
          {Platform.OS !== "web" ? <Button label={t.scan.camera} icon="camera-outline" onPress={() => pick("camera")} fullWidth /> : null}
          <Button label={t.scan.gallery} icon="images-outline" variant="secondary" onPress={() => pick("gallery")} fullWidth />
          {__DEV__ ? <Button label="Use a sample receipt (dev only)" variant="quiet" onPress={useSample} fullWidth /> : null}
          {__DEV__ ? <Button label="Use a sample photo (dev only)" variant="quiet" onPress={useSamplePhoto} fullWidth /> : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
});
