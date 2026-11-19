import { randomUUID } from "expo-crypto";

/** A random id for a new row. UUID v4, so two devices never collide and ids reveal nothing. */
export function newId(): string {
  return randomUUID();
}
