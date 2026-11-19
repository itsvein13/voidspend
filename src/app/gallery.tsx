// Dev-only component gallery: every piece of the design system, in both themes
// and both languages, with controls that really work. It is hidden from the
// tab bar and redirects away from release builds. Open it with the deep link
// duitku://gallery or exp://<host>:8081/--/gallery in Expo Go.
import { Redirect } from "expo-router";
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import {
  Amount,
  AmountKeypad,
  Banner,
  blend,
  Button,
  categoryOrder,
  Chip,
  contrastRatio,
  DesignProvider,
  emptyKeypad,
  EmptyState,
  Field,
  HorizonGlow,
  Icon,
  IconButton,
  keypadExpression,
  keypadTotal,
  ListRow,
  Screen,
  Segmented,
  SheetHeader,
  Skeleton,
  Surface,
  SwitchRow,
  Text,
  typography,
  useSnackbar,
  useTheme,
  VoidRing,
  type IconName,
  type KeypadState,
  type TextVariant,
} from "@/design";
import { useLanguage, useT } from "@/i18n";
import { formatRupiah } from "@/lib/money";
import { usePrefs } from "@/lib/PrefsProvider";
import type { LanguagePref, ThemeMode } from "@/lib/prefs";

const INCOME = 5000000;
const STEP = 250000;

export default function GalleryRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <DesignProvider>
      <Gallery />
    </DesignProvider>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {note ? (
        <Text variant="body" tone="secondary">
          {note}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function Gallery() {
  const { scheme, mode, setMode } = useTheme();
  const t = useT();
  const { pref, setPref } = useLanguage();
  const { prefs, setPrefs } = usePrefs();
  const { show } = useSnackbar();

  const [remaining, setRemaining] = useState(3200000);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string[]>(["food"]);
  const [favorite, setFavorite] = useState(false);
  const [merchant, setMerchant] = useState("Kopi Kenangan");
  const [note, setNote] = useState("");
  const [amountText, setAmountText] = useState("25.000");
  const [keypad, setKeypad] = useState<KeypadState>(emptyKeypad);
  const [pulse, setPulse] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
  const [notify, setNotify] = useState(true);

  const intensity = INCOME > 0 ? Math.max(0, remaining) / INCOME : 0;

  const spend = (amount: number) => {
    const before = remaining;
    setRemaining(before - amount);
    show({
      message: `Spent ${formatRupiah(amount)}`,
      actionLabel: t.common.undo,
      onAction: () => setRemaining(before),
    });
  };

  const themeOptions = [
    { value: "system", label: t.settings.theme.system },
    { value: "dark", label: t.settings.theme.dark },
    { value: "light", label: t.settings.theme.light },
  ] as const satisfies readonly { value: ThemeMode; label: string }[];

  const languageOptions = [
    { value: "system", label: t.settings.language.system },
    { value: "id", label: "ID" },
    { value: "en", label: "EN" },
  ] as const satisfies readonly { value: LanguagePref; label: string }[];

  return (
    <Screen background={<HorizonGlow intensity={intensity} />}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Design gallery
        </Text>
        <Text variant="body" tone="secondary">
          Development only. Every component, both themes, both languages.
        </Text>
      </View>

      <Section title={t.settings.theme.title}>
        <Segmented label={t.settings.theme.title} options={themeOptions} value={mode} onChange={setMode} />
        <Segmented label={t.settings.language.title} options={languageOptions} value={pref} onChange={setPref} />
        <Surface variant="smoke" padding={12}>
          <SwitchRow
            label={t.settings.reduceMotion.title}
            description={t.settings.reduceMotion.description}
            value={prefs.reduceMotion}
            onValueChange={(value) => setPrefs({ reduceMotion: value })}
          />
          <SwitchRow
            label={t.settings.haptics.title}
            description={t.settings.haptics.description}
            value={prefs.haptics}
            onValueChange={(value) => setPrefs({ haptics: value })}
          />
        </Surface>
      </Section>

      <Section title="Void ring" note="Money left this month. Spend to drain the arc, then undo from the snackbar.">
        <Surface variant="glass" radius="hero" elevated padding={20} style={styles.hero}>
          <VoidRing remaining={remaining} income={INCOME}>
            <Amount value={remaining} size="lg" animated maxWidth={190} />
            <Text variant="label" tone="secondary" style={styles.caption}>
              {remaining < 0 ? t.ring.overBy(formatRupiah(-remaining, "never")) : t.ring.leftThisMonth}
            </Text>
          </VoidRing>
          <Text variant="caption" tone="secondary">
            {`Income ${formatRupiah(INCOME)}`}
          </Text>
        </Surface>
        <View style={styles.wrap}>
          <Button label="Spend Rp 250.000" size="sm" variant="secondary" onPress={() => spend(STEP)} />
          <Button label="Spend Rp 3.000.000" size="sm" variant="secondary" onPress={() => spend(3000000)} />
          <Button label="Add Rp 250.000" size="sm" variant="secondary" onPress={() => setRemaining((value) => value + STEP)} />
          <Button label="Reset" size="sm" variant="quiet" onPress={() => setRemaining(3200000)} />
        </View>
      </Section>

      <Section title="Amounts" note="Expenses read as minus in plain text. Income is lime, savings blue, a negative balance red.">
        <Surface variant="smoke" padding={16} style={styles.stack}>
          <Row label={t.amount.income}>
            <Amount value={1250000} kind="income" size="md" />
          </Row>
          <Row label={t.amount.expense}>
            <Amount value={54300} kind="expense" size="md" />
          </Row>
          <Row label={t.amount.saving}>
            <Amount value={500000} kind="saving" size="md" />
          </Row>
          <Row label="Balance, negative">
            <Amount value={-120000} size="md" />
          </Row>
          <Row label="Small">
            <Amount value={12500} kind="expense" size="sm" />
          </Row>
        </Surface>
      </Section>

      <Section title="Buttons">
        <View style={styles.wrap}>
          <Button label="Record expense" icon="add" onPress={() => show({ message: "Primary pressed" })} />
          <Button label="Scan receipt" variant="secondary" icon="scan" onPress={() => show({ message: "Secondary pressed" })} />
          <Button label="Skip" variant="quiet" onPress={() => show({ message: "Quiet pressed" })} />
          <Button label="Delete" variant="destructive" icon="trash" onPress={() => show({ message: "Destructive pressed" })} />
        </View>
        <View style={styles.wrap}>
          <Button
            label={loading ? "Saving" : "Save"}
            loading={loading}
            onPress={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1500);
            }}
          />
          <Button label="Disabled" disabled onPress={() => {}} />
          <Button label="Small" size="sm" variant="secondary" onPress={() => show({ message: "Small pressed" })} />
          <Button label="Large" size="lg" variant="secondary" onPress={() => show({ message: "Large pressed" })} />
        </View>
        <Button label="Full width" fullWidth variant="secondary" onPress={() => show({ message: "Full width pressed" })} />
        <View style={styles.wrap}>
          <IconButton icon="close" label={t.common.close} onPress={() => show({ message: "Close pressed" })} />
          <IconButton icon="share-outline" label="Share" variant="tonal" onPress={() => show({ message: "Share pressed" })} />
          <IconButton icon="add" label="Add" variant="filled" onPress={() => show({ message: "Add pressed" })} />
          <IconButton icon={favorite ? "star" : "star-outline"} label="Favourite" selected={favorite} onPress={() => setFavorite((v) => !v)} />
          <IconButton icon="trash-outline" label={t.common.delete} disabled onPress={() => {}} />
        </View>
      </Section>

      <Section title="Choices">
        <View style={styles.wrap}>
          {(["food", "transport", "bills", "health"] as const).map((key) => (
            <Chip
              key={key}
              label={key[0].toUpperCase() + key.slice(1)}
              selected={picked.includes(key)}
              onPress={() => setPicked((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]))}
            />
          ))}
          <Chip label="Disabled" disabled onPress={() => {}} />
        </View>
        <SwitchRow label="Budget alerts" description="Warn when a category reaches 80 percent." value={notify} onValueChange={setNotify} />
      </Section>

      <Section title="Fields">
        <Field label="Merchant" value={merchant} onChangeText={setMerchant} placeholder="For example Indomaret" error={merchant.trim() === "" ? "Enter where you paid, for example Indomaret." : undefined} />
        <Field label="Amount" variant="amount" value={amountText} onChangeText={setAmountText} helper="Digits group as you type." />
        <Field label="Note" optional value={note} onChangeText={setNote} placeholder="Anything to remember" />
        <Field label="Disabled" value="Locked" onChangeText={() => {}} disabled />
      </Section>

      <Section title="Amount keypad" note="No system keyboard for amounts. Hold backspace to clear.">
        <Surface variant="smoke" padding={16} style={styles.stack}>
          <Text variant="caption" tone="secondary">
            {keypadExpression(keypad) || "Type an amount"}
          </Text>
          <Amount value={keypadTotal(keypad)} size="md" />
          <AmountKeypad state={keypad} onChange={setKeypad} />
        </Surface>
      </Section>

      <Section title="Rows and sheet header">
        <Surface variant="smoke" padding={16}>
          <ListRow
            title="Kopi Kenangan"
            subtitle="Food, 08:12"
            leading={<IconTile icon="cafe-outline" />}
            trailing={<Amount value={32000} kind="expense" size="sm" />}
            divider
            onPress={() => show({ message: "Row opened" })}
          />
          <ListRow title="Plain row, not pressable" subtitle="Without onPress it is just content." />
        </Surface>
        <Surface variant="raised" padding={16}>
          <SheetHeader title="Record expense" onClose={() => show({ message: "Sheet closed" })} />
        </Surface>
      </Section>

      <Section title="Feedback">
        {showInfo ? (
          <Banner tone="info" title="Backup file saved" message="Your v1 data was copied before the update." onDismiss={() => setShowInfo(false)} />
        ) : (
          <Button label="Show the info banner again" variant="quiet" onPress={() => setShowInfo(true)} />
        )}
        <Banner tone="success" message="Receipt saved to Food." />
        <Banner tone="warning" title="Food is at 85 percent" message="Rp 150.000 left of the Rp 1.000.000 budget." actionLabel="Edit budget" onAction={() => show({ message: "Edit budget pressed" })} />
        <Banner tone="danger" title="Could not read the receipt" message="Retake the photo in better light, or enter the amount yourself." actionLabel={t.common.retry} onAction={() => show({ message: "Retry pressed" })} />
        <Button label="Show a snackbar with Undo" variant="secondary" onPress={() => show({ message: "Expense deleted", actionLabel: t.common.undo, onAction: () => show({ message: "Restored" }) })} />
      </Section>

      <Section title="Loading and empty" note="Skeletons are for real waits only, such as a scan or an import.">
        <SwitchRow label="Pulse" value={pulse} onValueChange={setPulse} />
        <View accessible accessibilityLabel={t.common.loading} accessibilityState={{ busy: true }} style={styles.stack}>
          <Skeleton height={20} width="60%" pulse={pulse} />
          <Skeleton height={14} pulse={pulse} />
          <Skeleton height={14} width="80%" pulse={pulse} />
        </View>
        <Surface variant="smoke">
          <EmptyState
            source={require("../assets/mascot/what2.png")}
            title="No expenses this month"
            body="Record your first expense to see where the money goes."
            actionLabel="Record expense"
            onAction={() => show({ message: "Record expense pressed" })}
          />
        </Surface>
      </Section>

      <Section title="Surfaces" note="Four layers. Glass appears once, on the hero above.">
        <View style={styles.wrap}>
          {(["smoke", "raised", "inset"] as const).map((variant) => (
            <Surface key={variant} variant={variant} padding={14} style={styles.swatchSurface}>
              <Text variant="label">{variant}</Text>
            </Surface>
          ))}
        </View>
      </Section>

      <Section title="Color tokens" note={`${scheme} palette. Ratios are computed, not estimated.`}>
        <Swatches />
      </Section>

      <Section title="Type scale">
        <Surface variant="smoke" padding={16} style={styles.stack}>
          {(Object.keys(typography) as TextVariant[]).map((variant) => (
            <View key={variant} style={styles.typeRow}>
              <Text variant="micro" tone="secondary">
                {`${variant} ${typography[variant].fontSize}/${typography[variant].lineHeight}`}
              </Text>
              <Text variant={variant}>
                {variant.startsWith("amount") ? "Rp 1.250.000" : "Catat pengeluaran"}
              </Text>
            </View>
          ))}
        </Surface>
      </Section>
    </Screen>
  );
}

// A decorative category tile. It is not a button, so it can sit inside a pressable row.
function IconTile({ icon }: { icon: IconName }) {
  const { color } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: color.surface3 }]}>
      <Icon name={icon} size={22} color={color.text} />
    </View>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.rowBetween}>
      <Text variant="body" tone="secondary">
        {label}
      </Text>
      {children}
    </View>
  );
}

// Picks near-black or near-white text for a swatch by computed contrast.
function onSwatch(hex: string): string {
  return contrastRatio(hex, "#0B0F02") >= contrastRatio(hex, "#F4F6F2") ? "#0B0F02" : "#F4F6F2";
}

function Swatches() {
  const { color } = useTheme();
  const groups: { title: string; items: { name: string; hex: string; against: string; min: number }[] }[] = [
    {
      title: "Surfaces and text",
      items: [
        { name: "canvas", hex: color.canvas, against: color.text, min: 4.5 },
        { name: "surface1", hex: color.surface1, against: color.text, min: 4.5 },
        { name: "surface2", hex: color.surface2, against: color.textSecondary, min: 4.5 },
        { name: "surface3", hex: color.surface3, against: color.textTertiary, min: 4.5 },
      ],
    },
    {
      title: "Fills and their text",
      items: [
        { name: "accent", hex: color.accent, against: color.onAccent, min: 4.5 },
        { name: "savings", hex: color.savings, against: color.onSavings, min: 4.5 },
        { name: "danger", hex: color.danger, against: color.onDanger, min: 4.5 },
        { name: "warning", hex: color.warning, against: color.onWarning, min: 4.5 },
      ],
    },
    {
      title: "Ink on the card surface",
      items: [
        { name: "accentInk", hex: color.accentInk, against: color.surface1, min: 4.5 },
        { name: "savingsInk", hex: color.savingsInk, against: color.surface1, min: 4.5 },
        { name: "dangerInk", hex: color.dangerInk, against: color.surface1, min: 4.5 },
        { name: "warningInk", hex: color.warningInk, against: color.surface1, min: 4.5 },
        { name: "outline", hex: color.outline, against: color.surface1, min: 3 },
        { name: "focus", hex: color.focus, against: color.surface1, min: 3 },
      ],
    },
    {
      title: "Categories, in chart order",
      items: categoryOrder.map((key) => ({ name: key, hex: color.category[key], against: color.surface1, min: 3 })),
    },
  ];
  const glass = blend(color.glass.tint, color.glass.alpha, blend(color.accent, color.glass.glowMax, color.canvas));

  return (
    <View style={styles.stack}>
      {groups.map((group) => (
        <View key={group.title} style={styles.stack}>
          <Text variant="label" tone="secondary">
            {group.title}
          </Text>
          <View style={styles.wrap}>
            {group.items.map((item) => {
              const ratio = contrastRatio(item.hex, item.against);
              return (
                <View key={item.name} style={[styles.swatch, { backgroundColor: item.hex, borderColor: color.outline }]}>
                  <Text variant="micro" style={{ color: onSwatch(item.hex) }}>
                    {item.name}
                  </Text>
                  <Text variant="micro" style={{ color: onSwatch(item.hex) }}>
                    {`${ratio.toFixed(1)}:1 ${ratio >= item.min ? "ok" : `below ${item.min}`}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      ))}
      <Text variant="caption" tone="secondary">
        {`Text on glass over the strongest glow: ${contrastRatio(color.text, glass).toFixed(1)}:1`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 4, marginBottom: 8 },
  section: { gap: 12, marginTop: 28 },
  hero: { alignItems: "center", gap: 12 },
  caption: { marginTop: 2 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  stack: { gap: 10 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  typeRow: { gap: 2 },
  swatch: { width: 104, minHeight: 56, padding: 8, borderRadius: 10, borderWidth: 1, justifyContent: "space-between" },
  swatchSurface: { minWidth: 104, minHeight: 80, justifyContent: "center" },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
