import { useId } from "react";

import { Copy, Download, LoaderCircle } from "lucide-react";

import { formatBytes, formatCount } from "@/lib/folio/paths";
import { PREVIEW_LINES } from "@/lib/stencil/run";
import { MOD_KEY } from "@/lib/stencil/save";
import { barButtonClass } from "@/lib/stencil/ui";
import {
  editorClass,
  paneClass,
  paneHeaderClass,
  paneLabelClass,
} from "@/lib/styles";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type OutputView =
  | { state: "empty"; message: string }
  | { state: "error"; message: string; canShow: boolean }
  | {
      state: "ready";
      preview: string;
      lineCount: number;
      size: number;
      truncated: boolean;
    };

type OutputPaneProps = {
  className?: string;
  view: OutputView;
  pending: boolean;
  wrap: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onShowIssue: () => void;
};

export function OutputPane({
  className,
  view,
  pending,
  wrap,
  onCopy,
  onDownload,
  onShowIssue,
}: OutputPaneProps) {
  const ids = useId();
  const ready = view.state === "ready";
  const lines =
    view.state === "ready"
      ? view.lineCount === 1
        ? "1 line"
        : `${formatCount(view.lineCount)} lines`
      : "";
  const status = pending
    ? "Updating…"
    : view.state === "ready"
      ? `${lines} · ${formatBytes(view.size)}`
      : view.state === "error"
        ? "Paused: fix the pattern"
        : "";

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className={cn(paneClass, className)}
    >
      <div className={paneHeaderClass}>
        <h2 id={`${ids}-title`} className={paneLabelClass}>
          Output
        </h2>
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "flex min-w-0 items-center gap-1.5 truncate text-xs tabular-nums",
            view.state === "error" && !pending
              ? "text-red-400"
              : "text-muted-foreground",
          )}
        >
          {pending && (
            <LoaderCircle
              aria-hidden="true"
              className="size-3 animate-spin motion-reduce:animate-none"
            />
          )}
          {status}
        </p>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!ready || pending}
            className={cn(
              barButtonClass,
              "text-violet-300 hover:text-violet-200",
            )}
            onClick={onCopy}
            title={`Copy all output (${MOD_KEY}+Enter)`}
          >
            <Copy data-icon="inline-start" aria-hidden="true" />
            Copy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!ready || pending}
            aria-label="Download output as .txt"
            title="Download .txt"
            className="rounded-md text-violet-300 hover:bg-white/5 hover:text-violet-200"
            onClick={onDownload}
          >
            <Download aria-hidden="true" />
          </Button>
        </div>
      </div>

      {view.state === "ready" ? (
        <>
          <Textarea
            readOnly
            aria-labelledby={`${ids}-title`}
            aria-describedby={view.truncated ? `${ids}-truncated` : undefined}
            name="output"
            value={view.preview}
            spellCheck={false}
            wrap={wrap ? "soft" : "off"}
            className={cn(
              editorClass,
              "text-neutral-200",
              pending && "opacity-70",
            )}
          />
          {view.truncated && (
            <p
              id={`${ids}-truncated`}
              className="text-muted-foreground pt-1 text-xs"
            >
              Showing the first {formatCount(PREVIEW_LINES)} of{" "}
              {formatCount(view.lineCount)} lines. Copy and Download include all
              of it.
            </p>
          )}
        </>
      ) : view.state === "error" ? (
        <p className="py-1 text-sm wrap-anywhere text-red-400">
          {view.message}
          {view.canShow && (
            <>
              {" "}
              <button
                type="button"
                onClick={onShowIssue}
                className="rounded-sm text-red-300 underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Show in pattern
              </button>
            </>
          )}
        </p>
      ) : (
        <p className="text-muted-foreground py-1 text-sm">{view.message}</p>
      )}
    </section>
  );
}
