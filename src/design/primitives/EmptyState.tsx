import { Image, type ImageSource } from "expo-image";
import { StyleSheet, View } from "react-native";

import { Button } from "./Button";
import { Text } from "./Text";

export type EmptyStateProps = {
  /** The mascot or another real illustration. Decorative: the text carries the meaning. */
  source: ImageSource | number;
  /** Says why it is empty. "No expenses this month", not "No data". */
  title: string;
  /** Says what to do about it. */
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
};

const IMAGE_SIZE = 148;

/** First run, filtered to nothing, or nothing yet: each gets its own words and one action. */
export function EmptyState({ source, title, body, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Image
        source={source}
        style={styles.image}
        contentFit="contain"
        accessible={false}
        accessibilityIgnoresInvertColors
      />
      <Text variant="heading" align="center" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="secondary" align="center" style={styles.body}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8, paddingVertical: 24, paddingHorizontal: 16 },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE, marginBottom: 8 },
  body: { maxWidth: 320 },
  action: { marginTop: 12 },
});
