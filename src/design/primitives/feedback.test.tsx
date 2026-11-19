import { act, screen, userEvent } from "@testing-library/react-native";
import { useState } from "react";

import { renderWithDesign } from "@/test/render";

import { VoidRing } from "../charts/VoidRing";
import { Amount } from "./Amount";
import { AmountKeypad } from "./AmountKeypad";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { emptyKeypad, keypadTotal, type KeypadState } from "./keypad";
import { SheetHeader } from "./SheetHeader";
import { useSnackbar } from "./Snackbar";
import { Text } from "./Text";

const NBSP = " ";

describe("Banner", () => {
  it("announces warnings and problems right away, but not plain information", async () => {
    await renderWithDesign(
      <>
        <Banner tone="danger" message="Could not read the receipt." />
        <Banner tone="info" message="Backup saved." />
      </>,
    );
    const roles = (JSON.stringify(screen.toJSON()).match(/"accessibilityRole":"alert"/g) ?? []).length;
    expect(roles).toBe(1);
  });

  it("offers an action and a dismiss button with real names", async () => {
    const onAction = jest.fn();
    const onDismiss = jest.fn();
    await renderWithDesign(
      <Banner tone="warning" title="Food is at 85 percent" message="Rp 150.000 left." actionLabel="Edit budget" onAction={onAction} onDismiss={onDismiss} />,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Edit budget" }));
    await user.press(screen.getByRole("button", { name: "Dismiss message" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("Snackbar", () => {
  function Trigger({ onAction }: { onAction: () => void }) {
    const { show } = useSnackbar();
    return (
      <Button label="Delete" onPress={() => show({ message: "Expense deleted", actionLabel: "Undo", onAction })} />
    );
  }

  it("shows the message with an Undo that runs the action and closes it", async () => {
    const onAction = jest.fn();
    await renderWithDesign(<Trigger onAction={onAction} />);
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText("Expense deleted")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Expense deleted")).not.toBeOnTheScreen();
  });

  it("closes itself after six seconds", async () => {
    jest.useFakeTimers();
    try {
      await renderWithDesign(<Trigger onAction={() => {}} />);
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      await user.press(screen.getByRole("button", { name: "Delete" }));
      expect(screen.getByText("Expense deleted")).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(6100);
      });
      expect(screen.queryByText("Expense deleted")).not.toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("SheetHeader", () => {
  it("has a heading and a close button with a name", async () => {
    const onClose = jest.fn();
    await renderWithDesign(<SheetHeader title="Record expense" onClose={onClose} />);
    expect(screen.getByRole("header", { name: "Record expense" })).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("VoidRing", () => {
  it("describes the balance to screen readers as a progress value", async () => {
    await renderWithDesign(
      <VoidRing remaining={2500000} income={5000000}>
        <Text>hidden detail</Text>
      </VoidRing>,
    );
    const ring = screen.getByRole("progressbar");
    expect(ring).toHaveAccessibilityValue({ min: 0, max: 100, now: 50 });
    expect(ring.props.accessibilityLabel).toBe(
      `Rp${NBSP}2.500.000 left of Rp${NBSP}5.000.000 income, 50 percent`,
    );
  });

  it("says so when spending went past income", async () => {
    await renderWithDesign(<VoidRing remaining={-50000} income={5000000} />);
    const ring = screen.getByRole("progressbar");
    expect(ring.props.accessibilityLabel).toBe(
      `Spending is Rp${NBSP}50.000 over the Rp${NBSP}5.000.000 income`,
    );
    expect(ring).toHaveAccessibilityValue({ now: 0 });
  });

  it("says so when there is no income yet", async () => {
    await renderWithDesign(<VoidRing remaining={0} income={0} />);
    expect(screen.getByRole("progressbar").props.accessibilityLabel).toBe("No income yet this month");
  });
});

describe("Amount", () => {
  it("shows an expense as minus and speaks its kind", async () => {
    await renderWithDesign(<Amount value={54300} kind="expense" size="md" />);
    const amount = screen.getByLabelText(`Expense Rp${NBSP}54.300`);
    expect(amount).toHaveTextContent(`−Rp${NBSP}54.300`);
  });

  it("shows income with a plus sign", async () => {
    await renderWithDesign(<Amount value={1250000} kind="income" size="md" />);
    expect(screen.getByLabelText(`Income Rp${NBSP}1.250.000`)).toHaveTextContent(`+Rp${NBSP}1.250.000`);
  });

  it("speaks the large amount as one value, not digit by digit", async () => {
    await renderWithDesign(<Amount value={3200000} size="lg" animated />);
    expect(screen.getByLabelText(`Rp${NBSP}3.200.000`)).toBeOnTheScreen();
  });
});

describe("AmountKeypad", () => {
  function Harness() {
    const [state, setState] = useState<KeypadState>(emptyKeypad);
    return (
      <>
        <Text testID="total">{String(keypadTotal(state))}</Text>
        <AmountKeypad state={state} onChange={setState} />
      </>
    );
  }

  it("adds numbers with real key names for screen readers", async () => {
    await renderWithDesign(<Harness />);
    const user = userEvent.setup();
    const press = (name: string) => user.press(screen.getByRole("button", { name }));
    await press("2");
    await press("5");
    await press("Three zeros");
    await press("Add");
    await press("1");
    await press("0");
    await press("Three zeros");
    expect(screen.getByTestId("total")).toHaveTextContent("35000");
    await press("Calculate");
    expect(screen.getByTestId("total")).toHaveTextContent("35000");
    await press("Delete last digit");
    expect(screen.getByTestId("total")).toHaveTextContent("3500");
    await press("Clear amount");
    expect(screen.getByTestId("total")).toHaveTextContent("0");
  });
});
