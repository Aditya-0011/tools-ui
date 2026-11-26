import { useId, type Ref } from "react";

import { formatBytes } from "@/lib/folio/paths";
import type { Issue } from "@/lib/stencil/errors";
import { MAX_PATTERN_BYTES } from "@/lib/stencil/types";
import {
  editorClass,
  paneClass,
  paneHeaderClass,
  paneLabelClass,
} from "@/lib/styles";
import { cn } from "@/lib/utils";

import { Textarea } from "@/components/ui/textarea";

type PatternPaneProps = {
  className?: string;
  pattern: string;
  bytes: number;
  issue: Issue | null;
  loadedTitle: string | null;
  dirty: boolean;
  textareaRef: Ref<HTMLTextAreaElement>;
  onPatternChange: (pattern: string) => void;
  onShowIssue: () => void;
};

function caret(issue: Issue): string | null {
  if (
    issue.lineText === null ||
    issue.column === null ||
    issue.start === null ||
    issue.end === null
  ) {
    return null;
  }
  const width = Math.max(
    1,
    Math.min(issue.end - issue.start, issue.lineText.length - issue.column + 1),
  );
  return " ".repeat(issue.column - 1) + "^".repeat(width);
}

function IssueText({ issue, onShow }: { issue: Issue; onShow: () => void }) {
  const marker = caret(issue);
  const where =
    issue.line !== null ? `Line ${issue.line}, col ${issue.column}` : null;
  return (
    <div className="flex flex-col gap-1 pt-2 text-xs">
      <p className="wrap-anywhere text-red-400">{issue.message}</p>
      {marker !== null && (
        <pre
          aria-hidden="true"
          className="scrollbar-thin scrollbar-thumb-neutral-800 overflow-x-auto font-mono leading-relaxed text-neutral-400"
        >
          {issue.lineText}
          {"\n"}
          <span className="text-red-400">{marker}</span>
        </pre>
      )}
      {where && (
        <p className="text-muted-foreground">
          {where}
          {issue.start !== null && (
            <>
              {" · "}
              <button
                type="button"
                onClick={onShow}
                className="rounded-sm text-red-300 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Select in pattern
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}

export function PatternPane({
  className,
  pattern,
  bytes,
  issue,
  loadedTitle,
  dirty,
  textareaRef,
  onPatternChange,
  onShowIssue,
}: PatternPaneProps) {
  const ids = useId();
  const showBytes = bytes > MAX_PATTERN_BYTES * 0.8;

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className={cn(paneClass, className)}
    >
      <div className={paneHeaderClass}>
        <h2 id={`${ids}-title`} className={paneLabelClass}>
          Pattern
        </h2>
        {loadedTitle && (
          <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            <span className="truncate text-violet-300">{loadedTitle}</span>
            {dirty && (
              <span className="flex shrink-0 items-center gap-1 text-amber-400">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-amber-400"
                />
                unsaved
              </span>
            )}
          </p>
        )}
        {showBytes && (
          <p
            className={cn(
              "ml-auto text-xs tabular-nums",
              bytes > MAX_PATTERN_BYTES
                ? "text-red-400"
                : "text-muted-foreground",
            )}
          >
            {formatBytes(bytes)} / {formatBytes(MAX_PATTERN_BYTES)}
          </p>
        )}
      </div>

      <Textarea
        ref={textareaRef}
        aria-labelledby={`${ids}-title`}
        aria-describedby={issue ? `${ids}-issue` : undefined}
        aria-invalid={issue !== null}
        name="pattern"
        value={pattern}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        wrap="off"
        placeholder="Type a pattern, e.g. $0 or ${name|upper}…"
        onChange={(event) => onPatternChange(event.target.value)}
        className={editorClass}
      />

      <div id={`${ids}-issue`} aria-live="polite">
        {issue && <IssueText issue={issue} onShow={onShowIssue} />}
      </div>
    </section>
  );
}
