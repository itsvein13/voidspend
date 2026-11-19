import AsyncStorage from "@react-native-async-storage/async-storage";
import { screen, userEvent, waitFor } from "@testing-library/react-native";

import { useLanguage, useT } from "@/i18n";
import { PREFS_KEY } from "@/lib/prefs";
import { renderWithDesign } from "@/test/render";

import { Button } from "./primitives/Button";
import { Text } from "./primitives/Text";
import { useTheme } from "./theme";
import { palettes } from "./tokens";

function ThemeProbe() {
  const { scheme, mode, setMode, color } = useTheme();
  return (
    <>
      <Text testID="scheme">{`${mode}:${scheme}:${color.canvas}`}</Text>
      <Button label="Go light" onPress={() => setMode("light")} />
      <Button label="Follow system" onPress={() => setMode("system")} />
    </>
  );
}

function LanguageProbe() {
  const t = useT();
  const { language, setPref } = useLanguage();
  return (
    <>
      <Text testID="language">{`${language}:${t.common.close}`}</Text>
      <Button label="Use Indonesian" onPress={() => setPref("id")} />
    </>
  );
}

describe("theme", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("starts dark, the brand default", async () => {
    await renderWithDesign(<ThemeProbe />);
    expect(screen.getByTestId("scheme")).toHaveTextContent(`dark:dark:${palettes.dark.canvas}`);
  });

  it("switches to the light palette and saves the choice", async () => {
    await renderWithDesign(<ThemeProbe />);
    await userEvent.setup().press(screen.getByRole("button", { name: "Go light" }));
    expect(screen.getByTestId("scheme")).toHaveTextContent(`light:light:${palettes.light.canvas}`);
    await waitFor(async () => {
      const saved = JSON.parse((await AsyncStorage.getItem(PREFS_KEY)) ?? "{}");
      expect(saved.themeMode).toBe("light");
    });
  });

  it("keeps the theme a v1 user chose", async () => {
    await AsyncStorage.setItem("theme", "light");
    await renderWithDesign(<ThemeProbe />);
    await waitFor(() => expect(screen.getByTestId("scheme")).toHaveTextContent(`light:light:${palettes.light.canvas}`));
  });

  it("follows the system setting when asked (the test environment reports light)", async () => {
    await renderWithDesign(<ThemeProbe />);
    await userEvent.setup().press(screen.getByRole("button", { name: "Follow system" }));
    // The dark fallback for a device that reports nothing is covered by the
    // resolveScheme unit tests in src/lib/prefs.test.ts.
    expect(screen.getByTestId("scheme")).toHaveTextContent(`system:light:${palettes.light.canvas}`);
  });
});

describe("language", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("follows the device: this one is English", async () => {
    await renderWithDesign(<LanguageProbe />);
    expect(screen.getByTestId("language")).toHaveTextContent("en:Close");
  });

  it("switches the whole interface to Indonesian at once", async () => {
    await renderWithDesign(<LanguageProbe />);
    await userEvent.setup().press(screen.getByRole("button", { name: "Use Indonesian" }));
    expect(screen.getByTestId("language")).toHaveTextContent("id:Tutup");
  });
});
