import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { CircleHelp } from "lucide-react";
import { toast } from "sonner";

import { usePatterns, useSavePattern } from "@/api/stencil";
import { useAuth } from "@/contexts/AuthContext";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useStencilOutput } from "@/hooks/use-stencil-output";
import { byteLength, formatCount } from "@/lib/folio/paths";
import { isPreset } from "@/lib/stencil/delimiters";
import { readDraft, writeDraft, type Draft } from "@/lib/stencil/draft";
import { compileIssue, type RunInput } from "@/lib/stencil/run";
import { saveErrorMessage, validateTitle } from "@/lib/stencil/save";
import {
  MAX_DELIMITER_LENGTH,
  MAX_PATTERN_BYTES,
  MAX_PATTERNS,
  type SavedPattern,
} from "@/lib/stencil/types";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheatSheet } from "@/components/stencil/CheatSheet";
import { DataPane, type LoadedFile } from "@/components/stencil/DataPane";
import { OutputPane, type OutputView } from "@/components/stencil/OutputPane";
import {
  DeletePatternDialog,
  RenamePatternDialog,
} from "@/components/stencil/PatternDialogs";
import { PatternPane } from "@/components/stencil/PatternPane";
import { PatternsMenu } from "@/components/stencil/PatternsMenu";
import { SavePopover } from "@/components/stencil/SavePopover";

type Dialog = { type: "rename" | "delete"; pattern: SavedPattern } | null;

function delimiterProblem(delimiter: string): string | null {
  const length = [...delimiter].length;
  if (length === 0) return "Enter a delimiter, for example :: or ~.";
  if (length > MAX_DELIMITER_LENGTH) {
    return `Delimiters can be at most ${MAX_DELIMITER_LENGTH} characters.`;
  }
  if (/[\r\n"]/.test(delimiter)) {
    return "Delimiters can’t contain quotes or line breaks.";
  }
  return null;
}

function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileName(title: string | null): string {
  const base = (title ?? "stencil-output")
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "stencil-output"}.txt`;
}

function Workspace({ userId }: { userId: number }) {
  const patternsQuery = usePatterns(userId);
  const patterns = patternsQuery.data;
  const saveMutation = useSavePattern(userId);

  const [draft, setDraft] = useState<Draft>(() => readDraft(userId));
  const [text, setText] = useState("");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [savingMode, setSavingMode] = useState<"update" | "new" | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [tab, setTab] = useState("data");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wide = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    writeDraft(userId, draft);
  }, [userId, draft]);

  const update = (patch: Partial<Draft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const loaded =
    draft.loadedId !== null
      ? (patterns?.find((entry) => entry.id === draft.loadedId) ?? null)
      : null;
  const settingsChanged =
    loaded !== null &&
    (loaded.pattern !== draft.pattern ||
      (loaded.delimiter || ",") !== draft.delimiter ||
      loaded.has_header !== draft.hasHeader ||
      loaded.trim !== draft.trim);
  const titleChanged =
    loaded !== null &&
    draft.title.trim() !== "" &&
    loaded.title !== draft.title.trim();
  const dirty = settingsChanged || titleChanged;

  const data = file ? file.text : text;
  const hasData = data.trim() !== "";
  const hasPattern = draft.pattern !== "";
  const delimiterError = delimiterProblem(draft.delimiter);
  const bytes = byteLength(draft.pattern);

  const input = useMemo<RunInput | null>(
    () =>
      hasData && !delimiterError
        ? {
            data,
            pattern: draft.pattern,
            delimiter: draft.delimiter,
            hasHeader: draft.hasHeader,
            trim: draft.trim,
          }
        : null,
    [
      data,
      hasData,
      delimiterError,
      draft.pattern,
      draft.delimiter,
      draft.hasHeader,
      draft.trim,
    ],
  );
  const { result, failure, pending } = useStencilOutput(input);
  const current = input ? result : null;
  const syntaxIssue = useMemo(
    () => (input === null && hasPattern ? compileIssue(draft.pattern) : null),
    [input, hasPattern, draft.pattern],
  );
  const issue = current?.error ?? syntaxIssue;

  let view: OutputView;
  if (!hasData && !hasPattern) {
    view = {
      state: "empty",
      message:
        "Paste data on the left and write a pattern on the right; the result appears here.",
    };
  } else if (!hasData) {
    view = { state: "empty", message: "Add some data to see the output." };
  } else if (delimiterError) {
    view = { state: "error", message: delimiterError, canShow: false };
  } else if (!hasPattern) {
    view = {
      state: "empty",
      message: "Write a pattern to see the output. Start with $0.",
    };
  } else if (failure) {
    view = {
      state: "error",
      message: `Something went wrong while rendering: ${failure}`,
      canShow: false,
    };
  } else if (!current) {
    view = {
      state: "ready",
      preview: "",
      lineCount: 0,
      size: 0,
      truncated: false,
    };
  } else if (current.error) {
    view = {
      state: "error",
      message: current.error.message,
      canShow: current.error.start !== null,
    };
  } else if (current.rows === 0 && current.output === "") {
    view = {
      state: "empty",
      message: "Only a header row was found. Add rows, or turn off Header.",
    };
  } else {
    view = {
      state: "ready",
      preview: current.preview,
      lineCount: current.lineCount,
      size: current.size,
      truncated: current.truncated,
    };
  }

  const loadPattern = (pattern: SavedPattern) => {
    const delimiter = pattern.delimiter || ",";
    setTitleError(null);
    setFormError(null);
    update({
      pattern: pattern.pattern,
      delimiter,
      custom: !isPreset(delimiter),
      hasHeader: pattern.has_header,
      trim: pattern.trim,
      loadedId: pattern.id,
      title: pattern.title,
    });
    if (!wide) setTab("pattern");
  };

  const newPattern = () => {
    const previous = draft;
    setTitleError(null);
    setFormError(null);
    update({ pattern: "", loadedId: null, title: "" });
    if (!wide) setTab("pattern");
    if (previous.pattern !== "") {
      toast.success("Started a new pattern", {
        id: "stencil-new",
        description: "Your data is unchanged.",
        action: { label: "Undo", onClick: () => setDraft(previous) },
      });
    }
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const save = async (mode: "update" | "new") => {
    if (savingMode !== null || !patterns) return;
    const exceptId = mode === "update" && loaded ? loaded.id : null;
    const title = draft.title.trim();
    setFormError(null);
    const invalidTitle = validateTitle(title, patterns, exceptId);
    setTitleError(invalidTitle);
    if (invalidTitle) return setSaveOpen(true);
    const problem =
      draft.pattern === ""
        ? "Write a pattern before saving."
        : bytes > MAX_PATTERN_BYTES
          ? "Patterns can be at most 20 KB. Shorten it before saving."
          : (delimiterError ??
            (mode === "new" && patterns.length >= MAX_PATTERNS
              ? `You can save up to ${MAX_PATTERNS} patterns. Delete one to save another.`
              : null));
    if (problem) {
      setFormError(problem);
      return setSaveOpen(true);
    }
    setSavingMode(mode);
    try {
      const saved = await saveMutation.mutateAsync({
        id: exceptId ?? 0,
        title,
        pattern: draft.pattern,
        delimiter: draft.delimiter,
        has_header: draft.hasHeader,
        trim: draft.trim,
      });
      update({ loadedId: saved.id, title: saved.title });
      setSaveOpen(false);
      toast.success(
        mode === "new" ? `Saved “${saved.title}”` : `Updated “${saved.title}”`,
      );
    } catch (error) {
      const message = saveErrorMessage(error, title);
      setTitleError(message.title ?? null);
      setFormError(message.form ?? null);
      setSaveOpen(true);
      if (mode === "update" && message.form?.includes("no longer exists")) {
        update({ loadedId: null });
      }
    } finally {
      setSavingMode(null);
    }
  };

  const openSave = (open: boolean) => {
    setSaveOpen(open);
    if (!open) return;
    setFormError(null);
    setTitleError(null);
    if (draft.title.trim() === "" && loaded) update({ title: loaded.title });
  };

  const copyOutput = async () => {
    if (!current || current.error || pending) return;
    try {
      await navigator.clipboard.writeText(current.output);
      toast.success(
        current.lineCount === 1
          ? "Copied 1 line"
          : `Copied ${formatCount(current.lineCount)} lines`,
        { id: "stencil-copy" },
      );
    } catch {
      toast.error(
        "Couldn’t copy. Select the output and copy it manually, or use Download.",
        { id: "stencil-copy" },
      );
    }
  };

  const downloadOutput = () => {
    if (!current || current.error || pending) return;
    downloadText(current.output, fileName(loaded?.title ?? null));
  };

  const showIssue = () => {
    if (!issue || issue.start === null || issue.end === null) return;
    const { start, end } = issue;
    if (!wide) setTab("pattern");
    window.requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      target.setSelectionRange(start, end);
    });
  };

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || dialog) return;
    const key = event.key.toLowerCase();
    if (key === "s") {
      event.preventDefault();
      if (saveOpen) {
        void save(loaded ? "update" : "new");
      } else if (loaded && settingsChanged && !titleChanged) {
        void save("update");
      } else {
        openSave(true);
      }
      return;
    }
    if (key === "enter" && current && !current.error && !pending) {
      event.preventDefault();
      void copyOutput();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const onFile = (next: LoadedFile | null, inline: boolean) => {
    if (next === null) {
      setFile(null);
      setText("");
      return;
    }
    if (inline) {
      setFile(null);
      setText(next.text);
    } else {
      setFile(next);
      setText("");
    }
    toast.success(`Read ${next.name}`, {
      id: "stencil-file",
      description: "Read in this browser only.",
    });
  };

  const dataPane = (className?: string) => (
    <DataPane
      className={className}
      text={text}
      file={file}
      delimiter={draft.delimiter}
      custom={draft.custom}
      hasHeader={draft.hasHeader}
      trim={draft.trim}
      delimiterError={draft.custom ? delimiterError : null}
      summary={current}
      onTextChange={setText}
      onFile={onFile}
      onDelimiterChange={(delimiter, custom) => update({ delimiter, custom })}
      onHasHeaderChange={(hasHeader) => update({ hasHeader })}
      onTrimChange={(trim) => update({ trim })}
    />
  );

  const patternPane = (className?: string) => (
    <PatternPane
      className={className}
      pattern={draft.pattern}
      bytes={bytes}
      issue={issue}
      loadedTitle={loaded?.title ?? null}
      dirty={dirty}
      textareaRef={textareaRef}
      onPatternChange={(pattern) => update({ pattern })}
      onShowIssue={showIssue}
    />
  );

  const outputPane = (className?: string) => (
    <OutputPane
      className={className}
      view={view}
      pending={pending}
      wrap={!wide}
      onCopy={() => void copyOutput()}
      onDownload={downloadOutput}
      onShowIssue={showIssue}
    />
  );

  const outputBadge =
    view.state === "error"
      ? " · error"
      : view.state === "ready" && view.lineCount > 0
        ? ` · ${formatCount(view.lineCount)}`
        : "";

  return (
    <div className="flex min-w-0 flex-col md:h-[calc(100svh-6rem)] md:min-h-[32rem]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">Stencil</h1>
        <div className="flex items-center gap-1.5">
          <PatternsMenu
            patterns={patterns}
            loading={patternsQuery.isPending}
            failed={patternsQuery.isError && !patterns}
            activeId={loaded?.id ?? null}
            onRetry={() => void patternsQuery.refetch()}
            onNew={newPattern}
            onLoad={loadPattern}
            onRename={(pattern) => setDialog({ type: "rename", pattern })}
            onDelete={(pattern) => setDialog({ type: "delete", pattern })}
          />
          <SavePopover
            open={saveOpen}
            onOpenChange={openSave}
            save={{
              title: draft.title,
              loadedTitle: loaded?.title ?? null,
              dirty,
              pending: savingMode,
              titleError,
              formError,
              count: patterns?.length ?? 0,
              ready: patterns !== undefined,
            }}
            onTitleChange={(title) => {
              setTitleError(null);
              update({ title });
            }}
            onSave={(mode) => void save(mode)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open the pattern cheat sheet"
            title="Cheat sheet"
            className="rounded-md text-neutral-300 hover:bg-white/5 hover:text-violet-300"
            onClick={() => setHelpOpen(true)}
          >
            <CircleHelp aria-hidden="true" />
          </Button>
        </div>
      </div>

      {wide ? (
        <div className="-mx-4 grid min-h-0 flex-1 grid-rows-[minmax(0,55fr)_minmax(0,45fr)] border-t border-white/10">
          <div className="grid min-h-0 grid-cols-2">
            {dataPane()}
            {patternPane("border-l border-white/10")}
          </div>
          {outputPane("border-t border-white/10")}
        </div>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(String(value))}
          className="-mx-4 min-w-0 gap-0"
        >
          <TabsList
            variant="line"
            className="w-full items-start justify-start gap-4 border-b border-white/10 px-4 group-data-[orientation=horizontal]/tabs:h-10"
          >
            <TabsTrigger
              value="data"
              className="flex-none px-0 after:bg-violet-500 data-active:text-white"
            >
              Data
            </TabsTrigger>
            <TabsTrigger
              value="pattern"
              className="flex-none px-0 after:bg-violet-500 data-active:text-white"
            >
              Pattern{issue ? " · error" : ""}
            </TabsTrigger>
            <TabsTrigger
              value="output"
              className="flex-none px-0 tabular-nums after:bg-violet-500 data-active:text-white"
            >
              Output{outputBadge}
            </TabsTrigger>
          </TabsList>
          {(["data", "pattern", "output"] as const).map((value) => (
            <TabsContent
              key={value}
              value={value}
              keepMounted={value !== "output"}
              className="flex h-[calc(100svh-11rem)] min-h-80 flex-col"
            >
              {value === "data"
                ? dataPane("flex-1")
                : value === "pattern"
                  ? patternPane("flex-1")
                  : outputPane("flex-1")}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <CheatSheet open={helpOpen} onOpenChange={setHelpOpen} />

      {dialog?.type === "rename" && (
        <RenamePatternDialog
          userId={userId}
          pattern={dialog.pattern}
          patterns={patterns ?? []}
          onClose={() => setDialog(null)}
          onRenamed={(saved, previousTitle) => {
            if (
              draft.loadedId === saved.id &&
              draft.title.trim() === previousTitle
            ) {
              update({ title: saved.title });
            }
          }}
        />
      )}
      {dialog?.type === "delete" && (
        <DeletePatternDialog
          userId={userId}
          pattern={dialog.pattern}
          onClose={() => setDialog(null)}
          onDeleted={(pattern) => {
            if (draft.loadedId === pattern.id) update({ loadedId: null });
          }}
        />
      )}
    </div>
  );
}

export default function Stencil() {
  const { identity } = useAuth();
  const userId = identity?.user_id ?? 0;
  return <Workspace key={userId} userId={userId} />;
}
