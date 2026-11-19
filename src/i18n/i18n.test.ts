import { en } from "./en";
import { id, type Strings } from "./id";

type Leaf = string | ((...args: never[]) => string);

function flatten(node: unknown, path: string[] = []): [string, Leaf][] {
  if (typeof node === "string" || typeof node === "function") {
    return [[path.join("."), node as Leaf]];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(([key, child]) =>
    flatten(child, [...path, key]),
  );
}

// Sample arguments for the interpolating strings: amounts and a percentage.
const samples: unknown[] = ["Rp 1.250.000", "Rp 5.000.000", 25];

function render(leaf: Leaf): string {
  return typeof leaf === "string"
    ? leaf
    : (leaf as (...args: unknown[]) => string)(...samples);
}

describe("strings", () => {
  const idLeaves = flatten(id);
  const enLeaves = flatten(en as Strings);

  it("has the same keys in both languages", () => {
    expect(enLeaves.map(([key]) => key)).toEqual(idLeaves.map(([key]) => key));
  });

  it("has the same kind of value (text or function) under every key", () => {
    const kinds = (leaves: [string, Leaf][]) =>
      leaves.map(([key, leaf]) => `${key}:${typeof leaf}`);
    expect(kinds(enLeaves)).toEqual(kinds(idLeaves));
  });

  it("never leaves an empty string", () => {
    for (const [key, leaf] of [...idLeaves, ...enLeaves]) {
      expect([key, render(leaf).trim().length > 0]).toEqual([key, true]);
    }
  });

  it("contains no em dash and no decorative emoji (R-02)", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    for (const [key, leaf] of [...idLeaves, ...enLeaves]) {
      const text = render(leaf);
      expect([key, text.includes("2014")]).toEqual([key, false]);
      expect([key, emoji.test(text)]).toEqual([key, false]);
    }
  });

  it("fills interpolated values", () => {
    expect(id.ring.summary("Rp 1", "Rp 2", 25)).toContain("Rp 1");
    expect(en.ring.summary("Rp 1", "Rp 2", 25)).toContain("25");
  });
});
