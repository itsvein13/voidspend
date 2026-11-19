import { StyleSheet, View } from "react-native";

import type { TagUsage } from "@/db/repo/tags";
import { Button, Chip, Field, Surface, SwitchRow, Text, useBreakpoint } from "@/design";
import { useT } from "@/i18n";
import { formatShortDate } from "@/lib/dateLabels";
import type { LocalDate } from "@/lib/dates";

import { canPickDateTime, pickDateTime } from "../transactions/pickDateTime";
import { DATE_PRESETS, presetOf, presetRange, type ExtraFilters } from "./filters";

type Props = {
  extra: ExtraFilters;
  onExtra: (next: ExtraFilters) => void;
  from: LocalDate | undefined;
  to: LocalDate | undefined;
  onDates: (from: LocalDate | undefined, to: LocalDate | undefined) => void;
  tags: readonly TagUsage[];
  tagId: string | undefined;
  onTag: (id: string | undefined) => void;
  today: LocalDate;
  onClear: () => void;
};

/** The filters beyond type, wallet and category: dates, an amount range, a tag, a receipt, a place. */
export function FilterPanel({ extra, onExtra, from, to, onDates, tags, tagId, onTag, today, onClear }: Props) {
  const t = useT();
  const { largeText } = useBreakpoint();
  const preset = presetOf(from, to, today);
  const usedTags = tags.filter((tag) => tag.count > 0);

  const pickFrom = async () => {
    const picked = await pickDateTime(from ? new Date(`${from}T12:00:00`) : new Date(), false);
    // A start after the end moves the end along, so the range never runs backwards.
    if (picked) onDates(picked.date, to && picked.date > to ? picked.date : to);
  };
  const pickTo = async () => {
    const picked = await pickDateTime(to ? new Date(`${to}T12:00:00`) : new Date(), false);
    if (picked) onDates(from && picked.date < from ? picked.date : from, picked.date);
  };

  return (
    <Surface variant="smoke" padding={16} style={styles.panel}>
      <Section title={t.history.dateRange}>
        <View style={styles.wrap}>
          {DATE_PRESETS.map((item) => (
            <Chip
              key={item}
              label={t.history.presets[item]}
              selected={preset === item}
              onPress={() => {
                if (preset === item) onDates(undefined, undefined);
                else {
                  const range = presetRange(item, today);
                  onDates(range.from, range.to);
                }
              }}
            />
          ))}
          {canPickDateTime ? (
            <>
              <Chip label={t.history.fromDate(from ? formatShortDate(from, t, today) : null)} icon="calendar-outline" onPress={pickFrom} />
              <Chip label={t.history.toDate(to ? formatShortDate(to, t, today) : null)} icon="calendar-outline" onPress={pickTo} />
            </>
          ) : null}
        </View>
      </Section>

      <Section title={t.history.amountRange}>
        {/* Side by side when there is room, stacked at large system text, where the amounts would not fit. */}
        <View style={largeText ? styles.pairStacked : styles.pair}>
          <Field label={t.history.min} variant="amount" value={extra.min} onChangeText={(min) => onExtra({ ...extra, min })} containerStyle={largeText ? undefined : styles.half} />
          <Field label={t.history.max} variant="amount" value={extra.max} onChangeText={(max) => onExtra({ ...extra, max })} containerStyle={largeText ? undefined : styles.half} />
        </View>
      </Section>

      {usedTags.length > 0 ? (
        <Section title={t.tags.title}>
          <View style={styles.wrap}>
            {usedTags.map((tag) => (
              <Chip key={tag.id} label={`#${tag.name}`} selected={tagId === tag.id} onPress={() => onTag(tagId === tag.id ? undefined : tag.id)} />
            ))}
          </View>
        </Section>
      ) : null}

      <SwitchRow label={t.history.onlyReceipt} value={extra.hasReceipt} onValueChange={(hasReceipt) => onExtra({ ...extra, hasReceipt })} />
      <SwitchRow label={t.history.onlyPlace} value={extra.hasLocation} onValueChange={(hasLocation) => onExtra({ ...extra, hasLocation })} />
      <Field label={t.history.place} value={extra.place} onChangeText={(place) => onExtra({ ...extra, place })} optional maxLength={80} />

      <View style={styles.start}>
        <Button label={t.history.clearAll} variant="quiet" size="sm" onPress={onClear} />
      </View>
    </Surface>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" tone="secondary">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  section: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pair: { flexDirection: "row", gap: 12 },
  pairStacked: { gap: 12 },
  half: { flex: 1 },
  start: { alignItems: "flex-start" },
});
