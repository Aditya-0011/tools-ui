import { StencilError, toIssue, type Issue } from "@/lib/stencil/errors";
import {
  parseDelimited,
  type ParsedData,
  type ParseOptions,
} from "@/lib/stencil/parse";
import { compilePattern, type Program } from "@/lib/stencil/pattern";
import { renderProgram } from "@/lib/stencil/render";

export const PREVIEW_LINES = 2000;

export type RunInput = ParseOptions & { data: string; pattern: string };

export type RunResult = {
  output: string;
  preview: string;
  lineCount: number;
  size: number;
  truncated: boolean;
  rows: number;
  minColumns: number;
  maxColumns: number;
  headers: string[] | null;
  warning: string | null;
  error: Issue | null;
};

export function countLines(text: string): number {
  if (text === "") return 0;
  let count = 1;
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1))
    count++;
  return count;
}

export function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

export function previewOf(
  text: string,
  lines: number,
): { preview: string; truncated: boolean } {
  let at = -1;
  for (let n = 0; n < lines; n++) {
    at = text.indexOf("\n", at + 1);
    if (at === -1) return { preview: text, truncated: false };
  }
  return { preview: text.slice(0, at), truncated: true };
}

export function compileIssue(pattern: string): Issue | null {
  try {
    compilePattern(pattern);
    return null;
  } catch (error) {
    if (error instanceof StencilError) return toIssue(error, pattern);
    throw error;
  }
}

export function createRunner() {
  let parsedKey: {
    data: string;
    delimiter: string;
    hasHeader: boolean;
    trim: boolean;
  } | null = null;
  let parsed: ParsedData | null = null;
  let compiledFor: string | null = null;
  let compiled: { program: Program } | { error: StencilError } | null = null;

  return function run(input: RunInput): RunResult {
    if (
      !parsed ||
      !parsedKey ||
      parsedKey.data !== input.data ||
      parsedKey.delimiter !== input.delimiter ||
      parsedKey.hasHeader !== input.hasHeader ||
      parsedKey.trim !== input.trim
    ) {
      parsed = parseDelimited(input.data, input);
      parsedKey = {
        data: input.data,
        delimiter: input.delimiter,
        hasHeader: input.hasHeader,
        trim: input.trim,
      };
    }

    if (compiledFor !== input.pattern || !compiled) {
      try {
        compiled = { program: compilePattern(input.pattern) };
      } catch (error) {
        if (!(error instanceof StencilError)) throw error;
        compiled = { error };
      }
      compiledFor = input.pattern;
    }

    const base = {
      rows: parsed.rows.length,
      minColumns: parsed.minColumns,
      maxColumns: parsed.headers
        ? Math.max(parsed.maxColumns, parsed.headers.length)
        : parsed.maxColumns,
      headers: parsed.headers,
      warning: parsed.warning,
    };
    const failed = (error: StencilError): RunResult => ({
      ...base,
      output: "",
      preview: "",
      lineCount: 0,
      size: 0,
      truncated: false,
      error: toIssue(error, input.pattern),
    });

    if (input.pattern === "") {
      return {
        ...base,
        output: "",
        preview: "",
        lineCount: 0,
        size: 0,
        truncated: false,
        error: null,
      };
    }
    if ("error" in compiled) return failed(compiled.error);
    try {
      const output = renderProgram(compiled.program, parsed);
      const { preview, truncated } = previewOf(output, PREVIEW_LINES);
      return {
        ...base,
        output,
        preview,
        lineCount: countLines(output),
        size: utf8Length(output),
        truncated,
        error: null,
      };
    } catch (error) {
      if (!(error instanceof StencilError)) throw error;
      return failed(error);
    }
  };
}
