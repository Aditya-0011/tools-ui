import { z } from "zod";

export const MAX_PATTERNS = 200;
export const MAX_TITLE_LENGTH = 100;
export const MAX_PATTERN_BYTES = 20000;
export const MAX_DELIMITER_LENGTH = 8;

export const PatternSchema = z.object({
  id: z.number(),
  title: z.string().default(""),
  pattern: z.string().default(""),
  delimiter: z.string().default(""),
  has_header: z.boolean().default(false),
  trim: z.boolean().default(false),
  updated_at: z.string().optional(),
});
export type SavedPattern = z.infer<typeof PatternSchema>;

export const ListPatternsResponseSchema = z.object({
  patterns: z.array(PatternSchema).default([]),
});

export type SavePatternRequest = {
  id: number;
  title: string;
  pattern: string;
  delimiter: string;
  has_header: boolean;
  trim: boolean;
};

export type DeletePatternRequest = { id: number };

export type PatternSettings = {
  pattern: string;
  delimiter: string;
  hasHeader: boolean;
  trim: boolean;
};

export function comparePatterns(a: SavedPattern, b: SavedPattern): number {
  const left = a.title.toLowerCase();
  const right = b.title.toLowerCase();
  if (left !== right) return left < right ? -1 : 1;
  return a.id - b.id;
}

export function sameTitle(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
