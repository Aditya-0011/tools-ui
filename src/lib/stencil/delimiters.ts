export type DelimiterOption = { value: string; label: string };

export const CUSTOM = "custom";

export const DELIMITERS: DelimiterOption[] = [
  { value: ",", label: "Comma" },
  { value: "\t", label: "Tab" },
  { value: ";", label: "Semicolon" },
  { value: "|", label: "Pipe" },
];

export function isPreset(delimiter: string): boolean {
  return DELIMITERS.some((option) => option.value === delimiter);
}

export function delimiterLabel(delimiter: string): string {
  return (
    DELIMITERS.find((option) => option.value === delimiter)?.label ??
    `“${delimiter}”`
  );
}
