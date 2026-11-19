import { StyleSheet, View } from "react-native";

import { useT } from "@/i18n";

import { useTheme } from "../theme";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export type SheetHeaderProps = {
  title: string;
  onClose: () => void;
  /** The small handle that says "this sheet can be dragged". */
  grabber?: boolean;
};

export function SheetHeader({ title, onClose, grabber = true }: SheetHeaderProps) {
  const { color } = useTheme();
  const t = useT();

  return (
    <View>
      {grabber ? (
        <View accessible={false} style={[styles.grabber, { backgroundColor: color.outline }]} />
      ) : null}
      <View style={styles.row}>
        <Text variant="heading" style={styles.title} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <IconButton icon="close" label={t.common.close} onPress={onClose} variant="tonal" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grabber: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1 },
});
