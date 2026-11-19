import { StyleSheet, View } from "react-native";

import { useT } from "@/i18n";

import { withAlpha } from "../color";
import { useTheme } from "../theme";
import { radius, tint, type Hue, type Palette } from "../tokens";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { Text } from "./Text";

export type BannerTone = "info" | "success" | "warning" | "danger";

type BannerStyle = { hue: Hue; icon: IconName; urgent: boolean };

const STYLES: Record<BannerTone, BannerStyle> = {
  info: { hue: "savings", icon: "information-circle", urgent: false },
  success: { hue: "accent", icon: "checkmark-circle", urgent: false },
  warning: { hue: "warning", icon: "alert-circle", urgent: true },
  danger: { hue: "danger", icon: "warning", urgent: true },
};

function inkOf(color: Palette, hue: Hue): string {
  return color[`${hue}Ink` as const];
}

export type BannerProps = {
  tone: BannerTone;
  /** What happened, in a few words. */
  title?: string;
  /** What to do about it. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
};

/**
 * Inline feedback. The tone shows in the icon, the tint and the border, and the
 * text stays neutral so it reads on every surface. Warnings and problems are
 * announced to screen readers right away.
 */
export function Banner({ tone, title, message, actionLabel, onAction, onDismiss }: BannerProps) {
  const { color } = useTheme();
  const t = useT();
  const { hue, icon, urgent } = STYLES[tone];
  const ink = inkOf(color, hue);

  return (
    <View
      accessibilityRole={urgent ? "alert" : undefined}
      accessibilityLiveRegion={urgent ? "assertive" : "polite"}
      style={[styles.box, { backgroundColor: tint(color, hue), borderColor: withAlpha(ink, 0.55) }]}
    >
      <Icon name={icon} size={22} color={ink} />
      <View style={styles.text}>
        {title ? (
          <Text variant="label" style={styles.title}>
            {title}
          </Text>
        ) : null}
        <Text variant="body">{message}</Text>
        {actionLabel && onAction ? (
          <View style={styles.action}>
            <Button label={actionLabel} onPress={onAction} variant="quiet" size="sm" />
          </View>
        ) : null}
      </View>
      {onDismiss ? <IconButton icon="close" label={t.common.dismiss} onPress={onDismiss} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: radius.card,
    alignItems: "flex-start",
  },
  text: { flex: 1, gap: 2 },
  title: { marginBottom: 2 },
  action: { marginTop: 4, marginLeft: -12 },
});
