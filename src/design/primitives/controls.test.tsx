import { fireEvent, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";

import { renderWithDesign } from "@/test/render";

import { palettes } from "../tokens";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Field } from "./Field";
import { IconButton } from "./IconButton";
import { Segmented } from "./Segmented";
import { SwitchRow } from "./SwitchRow";

describe("Button", () => {
  it("is an accessible button named by its label and runs onPress", async () => {
    const onPress = jest.fn();
    await renderWithDesign(<Button label="Save" onPress={onPress} />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeEnabled();
    await user.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disabled, and says so to assistive tech", async () => {
    const onPress = jest.fn();
    await renderWithDesign(<Button label="Save" onPress={onPress} disabled />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("draws a visible focus ring while a keyboard has focus, and removes it after", async () => {
    // A secondary button, because the primary one is filled with the same lime.
    await renderWithDesign(<Button label="Save" variant="secondary" onPress={() => {}} />);
    const button = screen.getByRole("button", { name: "Save" });
    const ringColor = palettes.dark.focus;
    expect(JSON.stringify(screen.toJSON())).not.toContain(ringColor);
    await fireEvent(button, "focus");
    expect(JSON.stringify(screen.toJSON())).toContain(ringColor);
    await fireEvent(button, "blur");
    expect(JSON.stringify(screen.toJSON())).not.toContain(ringColor);
  });

  it("is busy and inert while loading", async () => {
    const onPress = jest.fn();
    await renderWithDesign(<Button label="Save" onPress={onPress} loading />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeBusy();
    await user.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("is named by its required label, not by the icon", async () => {
    const onPress = jest.fn();
    await renderWithDesign(<IconButton icon="close" label="Close" onPress={onPress} />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Close" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is at least 44 by 44 even if asked for less", async () => {
    await renderWithDesign(<IconButton icon="close" label="Close" onPress={() => {}} size={24} />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(button.props.style).toBeDefined();
    // The visible box is the animated child; its size comes from the style prop.
    expect(JSON.stringify(screen.toJSON())).toContain('"width":44');
  });

  it("reports a pressed toggle as selected", async () => {
    await renderWithDesign(<IconButton icon="star" label="Favourite" selected onPress={() => {}} />);
    expect(screen.getByRole("button", { name: "Favourite" })).toBeSelected();
  });
});

describe("Chip", () => {
  it("shows selection in its state, not only in its color", async () => {
    const onPress = jest.fn();
    await renderWithDesign(<Chip label="Food" selected onPress={onPress} />);
    const chip = screen.getByRole("button", { name: "Food" });
    expect(chip).toBeSelected();
    await userEvent.setup().press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is not selected by default", async () => {
    await renderWithDesign(<Chip label="Food" onPress={() => {}} />);
    expect(screen.getByRole("button", { name: "Food" })).not.toBeSelected();
  });
});

describe("Segmented", () => {
  const options = [
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ] as const;

  function Harness({ onChange }: { onChange: (value: string) => void }) {
    const [value, setValue] = useState<"system" | "dark" | "light">("dark");
    return (
      <Segmented
        label="Appearance"
        options={options}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    );
  }

  it("is a radio group named by its label, with one option checked", async () => {
    await renderWithDesign(<Harness onChange={() => {}} />);
    // The group container is deliberately not an accessibility element itself,
    // so TalkBack can still focus each option inside it.
    expect(screen.getByLabelText("Appearance").props.accessibilityRole).toBe("radiogroup");
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked();
  });

  it("moves the selection and reports the change", async () => {
    const onChange = jest.fn();
    await renderWithDesign(<Harness onChange={onChange} />);
    await userEvent.setup().press(screen.getByRole("radio", { name: "Light" }));
    expect(onChange).toHaveBeenCalledWith("light");
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
  });

  it("does not report a press on the option that is already selected", async () => {
    const onChange = jest.fn();
    await renderWithDesign(<Harness onChange={onChange} />);
    await userEvent.setup().press(screen.getByRole("radio", { name: "Dark" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("SwitchRow", () => {
  function Harness({ onValueChange }: { onValueChange: (value: boolean) => void }) {
    const [value, setValue] = useState(false);
    return (
      <SwitchRow
        label="Budget alerts"
        description="Warn at 80 percent."
        value={value}
        onValueChange={(next) => {
          setValue(next);
          onValueChange(next);
        }}
      />
    );
  }

  it("is a switch whose state follows the value", async () => {
    const onValueChange = jest.fn();
    await renderWithDesign(<Harness onValueChange={onValueChange} />);
    const row = screen.getByRole("switch", { name: "Budget alerts" });
    expect(row).not.toBeChecked();
    await userEvent.setup().press(row);
    expect(onValueChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch", { name: "Budget alerts" })).toBeChecked();
  });
});

describe("Field", () => {
  it("has a visible label that also names the input", async () => {
    await renderWithDesign(<Field label="Merchant" value="Kopi" onChangeText={() => {}} />);
    expect(screen.getByText("Merchant")).toBeOnTheScreen();
    expect(screen.getByLabelText("Merchant")).toHaveDisplayValue("Kopi");
  });

  it("shows an error as text and passes it to assistive tech", async () => {
    await renderWithDesign(
      <Field label="Merchant" value="" onChangeText={() => {}} error="Enter where you paid." />,
    );
    expect(screen.getByText("Enter where you paid.")).toBeOnTheScreen();
    expect(screen.getByLabelText("Merchant").props.accessibilityHint).toBe("Enter where you paid.");
  });

  it("marks optional fields in words", async () => {
    await renderWithDesign(<Field label="Note" optional value="" onChangeText={() => {}} />);
    expect(screen.getByText("Note (optional)")).toBeOnTheScreen();
  });

  it("groups digits of an amount as you type", async () => {
    const onChangeText = jest.fn();
    await renderWithDesign(<Field label="Amount" variant="amount" value="" onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByLabelText("Amount"), "1250000");
    expect(onChangeText).toHaveBeenCalledWith("1.250.000");
    expect(screen.getByText("Rp")).toBeOnTheScreen();
  });

  it("does not accept input when disabled", async () => {
    await renderWithDesign(<Field label="Locked" value="x" onChangeText={() => {}} disabled />);
    expect(screen.getByLabelText("Locked").props.editable).toBe(false);
  });
});
