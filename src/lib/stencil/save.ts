import { describeError } from "@/api/handler";
import { FetchError } from "@/lib/errors";
import {
  MAX_TITLE_LENGTH,
  sameTitle,
  type SavedPattern,
} from "@/lib/stencil/types";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD_KEY = isMac ? "⌘" : "Ctrl";

export function validateTitle(
  title: string,
  patterns: SavedPattern[],
  exceptId: number | null,
): string | null {
  const trimmed = title.trim();
  if (trimmed === "") return "Enter a title";
  if ([...trimmed].length > MAX_TITLE_LENGTH) {
    return `Titles can be at most ${MAX_TITLE_LENGTH} characters`;
  }
  if (
    patterns.some(
      (entry) => entry.id !== exceptId && sameTitle(entry.title, trimmed),
    )
  ) {
    return `You already have a pattern called “${trimmed}”. Pick another title.`;
  }
  return null;
}

export function saveErrorMessage(
  error: unknown,
  title: string,
): { title?: string; form?: string } {
  if (error instanceof FetchError) {
    if (error.status === 409) {
      return {
        title: `You already have a pattern called “${title.trim()}”. Pick another title.`,
      };
    }
    if (error.status === 412) {
      return {
        form:
          error.message ||
          "You can save up to 200 patterns. Delete one to save another.",
      };
    }
    if (error.status === 429) {
      const seconds = error.retryAfter ?? 60;
      return {
        form: `Too many saves in a row. Try again in ${seconds} ${seconds === 1 ? "second" : "seconds"}.`,
      };
    }
    if (error.status === 404) {
      return { form: "This pattern no longer exists. Save it as new instead." };
    }
    if (error.status === 400) {
      return {
        form:
          error.message ||
          "The pattern couldn’t be saved. Check the title and pattern.",
      };
    }
  }
  return { form: describeError(error) };
}
