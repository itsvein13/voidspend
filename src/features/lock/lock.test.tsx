import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { renderWithDesign } from "@/test/render";

import { AppLock } from "./AppLock";
import { authenticate, canUseLock, LOCK_GRACE_MS, shouldRelock } from "./lock";

jest.mock("expo-local-authentication", () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Auth = require("expo-local-authentication") as Record<string, jest.Mock>;

beforeEach(async () => {
  Auth.getEnrolledLevelAsync.mockReset();
  Auth.authenticateAsync.mockReset();
  await AsyncStorage.clear();
});

describe("the lock rule", () => {
  it("relocks only after the app was away for the grace time", () => {
    expect(shouldRelock(null, 10_000)).toBe(false);
    expect(shouldRelock(1_000, 1_000 + LOCK_GRACE_MS - 1)).toBe(false);
    expect(shouldRelock(1_000, 1_000 + LOCK_GRACE_MS)).toBe(true);
  });
});

describe("asking the phone", () => {
  it("is available when the phone has any screen lock", async () => {
    Auth.getEnrolledLevelAsync.mockResolvedValue(1);
    expect(await canUseLock()).toBe(true);
    Auth.getEnrolledLevelAsync.mockResolvedValue(0);
    expect(await canUseLock()).toBe(false);
    Auth.getEnrolledLevelAsync.mockRejectedValue(new Error("no hardware"));
    expect(await canUseLock()).toBe(false);
  });

  it("answers true or false and never throws", async () => {
    Auth.authenticateAsync.mockResolvedValue({ success: true });
    expect(await authenticate("Unlock", "Cancel")).toBe(true);
    Auth.authenticateAsync.mockResolvedValue({ success: false, error: "user_cancel" });
    expect(await authenticate("Unlock", "Cancel")).toBe(false);
    Auth.authenticateAsync.mockRejectedValue(new Error("boom"));
    expect(await authenticate("Unlock", "Cancel")).toBe(false);
  });
});

describe("the lock screen", () => {
  it("covers the app while locked, keeps the failure in words, and opens after a good verification", async () => {
    await AsyncStorage.setItem("v2.prefs", JSON.stringify({ appLock: true, language: "en" }));
    Auth.authenticateAsync.mockResolvedValueOnce({ success: false });
    await renderWithDesign(
      <AppLock>
        <Text>Inside the app</Text>
      </AppLock>,
    );
    expect(await screen.findByText("VOIDSPEND is locked")).toBeTruthy();
    expect(await screen.findByText("Verification failed. Try again.")).toBeTruthy();

    Auth.authenticateAsync.mockResolvedValueOnce({ success: true });
    await fireEvent.press(screen.getByRole("button", { name: "Unlock" }));
    await waitFor(() => expect(screen.queryByText("VOIDSPEND is locked")).toBeNull());
    expect(screen.getByText("Inside the app")).toBeTruthy();
  });

  it("does not appear, and never asks, when the lock is off", async () => {
    await renderWithDesign(
      <AppLock>
        <Text>Inside the app</Text>
      </AppLock>,
    );
    expect(await screen.findByText("Inside the app")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("VOIDSPEND is locked")).toBeNull());
    expect(Auth.authenticateAsync).not.toHaveBeenCalled();
  });
});
