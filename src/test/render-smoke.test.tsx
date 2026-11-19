import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";

// Infrastructure check only: proves jest-expo, React Native Testing Library 14
// and React 19 work together. Replace it with real component tests in M1.
describe("test setup", () => {
  it("renders React Native components", async () => {
    await render(<Text>VOIDSPEND</Text>);
    expect(screen.getByText("VOIDSPEND")).toBeTruthy();
  });
});
