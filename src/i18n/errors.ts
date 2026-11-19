import { ValidationError } from "@/db/types";

import type { Strings } from "./id";

/** A sentence for the person: the coded validation message, or a generic one. */
export function errorMessage(error: unknown, strings: Strings): string {
  if (error instanceof ValidationError) {
    return (strings.errors as Record<string, string>)[error.code] ?? strings.errors.generic;
  }
  return strings.errors.generic;
}
