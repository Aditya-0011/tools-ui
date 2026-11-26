import { useId, useRef, useState, type DragEvent } from "react";

import { FileText, TriangleAlert, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { formatBytes, formatCount } from "@/lib/folio/paths";
import { CUSTOM, DELIMITERS } from "@/lib/stencil/delimiters";
import { MAX_DELIMITER_LENGTH } from "@/lib/stencil/types";
import { barButtonClass } from "@/lib/stencil/ui";
import {
  editorClass,
  paneClass,
  paneHeaderClass,
  paneLabelClass,
} from "@/lib/styles";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const INLINE_LIMIT = 1_000_000;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const ACCEPTED = /\.(csv|tsv|txt|tab)$/i;

export type LoadedFile = { name: string; size: number; text: string };

export type DataSummary = {
  rows: number;
  minColumns: number;
  maxColumns: number;
  headers: string[] | null;
  warning: string | null;
};

type DataPaneProps = {
  className?: string;
  text: string;
  file: LoadedFile | null;
  delimiter: string;
  custom: boolean;
  hasHeader: boolean;
  trim: boolean;
  delimiterError: string | null;
  summary: DataSummary | null;
  onTextChange: (text: string) => void;
  onFile: (file: LoadedFile | null, inline: boolean) => void;
  onDelimiterChange: (delimiter: string, custom: boolean) => void;
  onHasHeaderChange: (value: boolean) => void;
  onTrimChange: (value: boolean) => void;
};

const CHOICES = [
  ...DELIMITERS.map((option) => ({ value: option.value, label: option.label })),
  { value: CUSTOM, label: "Custom" },
];

const switchClass =
  "data-checked:border-violet-500 data-checked:bg-violet-500 focus-visible:border-violet-500";

function readout(summary: DataSummary): string {
  const rows =
    summary.rows === 1 ? "1 row" : `${formatCount(summary.rows)} rows`;
  const { minColumns, maxColumns } = summary;
  const cols =
    minColumns === maxColumns || summary.rows === 0
      ? `${formatCount(maxColumns)} ${maxColumns === 1 ? "col" : "cols"}`
      : `${formatCount(minColumns)}–${formatCount(maxColumns)} cols`;
  return `${rows} · ${cols}`;
}

function columnList(headers: string[]): string {
  const shown = headers
    .slice(0, 30)
    .map((name, index) => `$${index} ${name.trim() || "(blank)"}`);
  const more = headers.length > 30 ? `, +${headers.length - 30} more` : "";
  return shown.join(", ") + more;
}

export function DataPane(props: DataPaneProps) {
  const {
    className,
    text,
    file,
    delimiter,
    custom,
    hasHeader,
    trim,
    delimiterError,
    summary,
    onTextChange,
    onFile,
    onDelimiterChange,
    onHasHeaderChange,
    onTrimChange,
  } = props;
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const ids = useId();
  const empty = file === null && text.trim() === "";
  const bigFile = file !== null && file.text.length > INLINE_LIMIT;

  const readFile = async (picked: File) => {
    if (!ACCEPTED.test(picked.name)) {
      toast.error("Choose a .csv, .tsv or .txt file.");
      return;
    }
    if (picked.size > MAX_FILE_BYTES) {
      toast.error(
        `Files can be up to ${formatBytes(MAX_FILE_BYTES)}. This one is ${formatBytes(picked.size)}.`,
      );
      return;
    }
    let content: string;
    try {
      content = await picked.text();
    } catch {
      toast.error(`Couldn’t read ${picked.name}.`);
      return;
    }
    if (/\.(tsv|tab)$/i.test(picked.name) && delimiter !== "\t") {
      onDelimiterChange("\t", false);
      toast.info("Switched the delimiter to Tab for this file.");
    }
    onFile(
      { name: picked.name, size: picked.size, text: content },
      content.length <= INLINE_LIMIT,
    );
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const picked = event.dataTransfer.files[0];
    if (picked) void readFile(picked);
  };

  const onDragOver = (event: DragEvent) => {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };

  const summaryText = !empty && summary ? readout(summary) : null;

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className={cn(paneClass, className)}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={onDrop}
    >
      <div className={paneHeaderClass}>
        <h2 id={`${ids}-title`} className={paneLabelClass}>
          Data
        </h2>
        <Select
          items={CHOICES}
          value={custom ? CUSTOM : delimiter}
          onValueChange={(value) => {
            if (value === null) return;
            if (value === CUSTOM)
              onDelimiterChange(custom ? delimiter : "", true);
            else onDelimiterChange(value, false);
          }}
        >
          <SelectTrigger
            size="sm"
            aria-label="Delimiter"
            className={cn(
              barButtonClass,
              "border-0 bg-transparent focus-visible:ring-2 focus-visible:ring-violet-500",
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-input rounded-md border px-1 py-2">
            <SelectGroup>
              {CHOICES.map((choice) => (
                <SelectItem
                  key={choice.label}
                  value={choice.value}
                  className="rounded-md"
                >
                  {choice.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {custom && (
          <input
            name="delimiter"
            aria-label="Custom delimiter"
            aria-invalid={!!delimiterError}
            aria-describedby={delimiterError ? `${ids}-delim` : undefined}
            value={delimiter}
            maxLength={MAX_DELIMITER_LENGTH}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. ::"
            onChange={(event) => onDelimiterChange(event.target.value, true)}
            className="h-7 w-20 border-b border-white/20 bg-transparent px-1 font-mono text-sm outline-none placeholder:text-neutral-600 focus-visible:border-violet-500 aria-invalid:border-red-500"
          />
        )}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-300">
          <Switch
            size="sm"
            checked={hasHeader}
            onCheckedChange={onHasHeaderChange}
            className={switchClass}
          />
          Header
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-300">
          <Switch
            size="sm"
            checked={trim}
            onCheckedChange={onTrimChange}
            className={switchClass}
          />
          Trim
        </label>
        <div className="ml-auto flex items-center gap-1">
          {summaryText &&
            (summary?.headers ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="text-muted-foreground rounded-sm text-xs tabular-nums underline decoration-dotted underline-offset-4 outline-none hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-violet-500"
                    />
                  }
                >
                  {summaryText}
                </TooltipTrigger>
                <TooltipContent className="max-w-xs font-mono text-xs">
                  {columnList(summary.headers)}
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="text-muted-foreground text-xs tabular-nums">
                {summaryText}
              </span>
            ))}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Open a .csv, .tsv or .txt file"
            title="Open file"
            className="rounded-md text-neutral-400 hover:text-violet-300"
            onClick={() => input.current?.click()}
          >
            <Upload aria-hidden="true" />
          </Button>
          {!empty && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Clear data"
              title="Clear data"
              className="rounded-md text-neutral-400 hover:text-white"
              onClick={() => onFile(null, true)}
            >
              <X aria-hidden="true" />
            </Button>
          )}
          <input
            ref={input}
            type="file"
            accept=".csv,.tsv,.tab,.txt,text/csv,text/plain,text/tab-separated-values"
            hidden
            tabIndex={-1}
            onChange={(event) => {
              const picked = event.target.files?.[0];
              event.target.value = "";
              if (picked) void readFile(picked);
            }}
          />
        </div>
      </div>

      {custom && delimiterError && (
        <p id={`${ids}-delim`} role="alert" className="text-xs text-red-400">
          {delimiterError}
        </p>
      )}

      {bigFile ? (
        <div className="flex flex-col gap-2 py-2">
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <FileText
              aria-hidden="true"
              className="size-4 shrink-0 text-violet-400"
            />
            <span className="truncate text-neutral-200" title={file.name}>
              {file.name}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {formatBytes(file.size)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto shrink-0 rounded-md text-neutral-400 hover:text-white"
              onClick={() => onFile(null, true)}
            >
              Remove File
            </Button>
          </p>
          <p className="text-muted-foreground text-xs">
            Read in this browser only. Large files stay out of the editor so
            typing stays fast.
          </p>
        </div>
      ) : (
        <Textarea
          aria-labelledby={`${ids}-title`}
          name="data"
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          wrap="off"
          placeholder="Paste rows or drop a .csv, .tsv or .txt file…"
          onChange={(event) => onTextChange(event.target.value)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData("text/plain");
            if (pasted.length <= INLINE_LIMIT || text !== "") return;
            event.preventDefault();
            onFile(
              {
                name: "Pasted text",
                size: new Blob([pasted]).size,
                text: pasted,
              },
              false,
            );
          }}
          className={editorClass}
        />
      )}

      {summary?.warning && !empty && (
        <p
          role="status"
          className="flex items-start gap-1.5 pt-1 text-xs text-amber-400"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-px size-3.5 shrink-0"
          />
          {summary.warning}
        </p>
      )}

      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center bg-neutral-950/90 text-sm font-medium text-violet-300 shadow-[inset_0_0_0_2px_var(--color-violet-500)]"
        >
          Drop to read the file locally
        </div>
      )}
    </section>
  );
}
