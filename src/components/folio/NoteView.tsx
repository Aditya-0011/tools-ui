import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Copy,
  Download,
  Ellipsis,
  FilePen,
  History,
  Lock,
  PencilLine,
  Save,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";

import { describeError } from "@/api/handler";
import { loadContent, useNoteContent } from "@/api/folio";
import { useNoteEditor } from "@/hooks/use-note-editor";
import { useFolio } from "@/hooks/use-folio";
import { dropDraft, readDraft, type Draft } from "@/lib/folio/cache";
import { getEditorId } from "@/lib/folio/editor";
import { fileNameFromTitle, formatBytes } from "@/lib/folio/paths";
import { presenceFor, presenceStore } from "@/lib/folio/presence";
import type { NoteLock, NoteSummary } from "@/lib/folio/types";
import {
  destructiveButtonClass,
  destructiveDialogClass,
  primaryButtonClass,
  quietActionClass,
  readingClass,
} from "@/lib/styles";
import { formatTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Error as ErrorState } from "@/components/Error";
import { LeaveGuard } from "@/components/folio/LeaveGuard";
import { FolioBreadcrumbs } from "@/components/folio/FolioBreadcrumbs";
import {
  MarkdownSkeleton,
  MarkdownView,
  NoteEditor,
} from "@/components/folio/NoteEditor";
import { BackButton, PaneBar } from "@/components/folio/PaneBar";

const TIME = { hour: "2-digit", minute: "2-digit" } as const;

function lockTime(lock: NoteLock | undefined) {
  return lock?.locked_at ? formatTimestamp(lock.locked_at, TIME) : null;
}

function lockHolder(lock: NoteLock | undefined) {
  return lock?.editor_label || "another device";
}

function isForeignLock(lock: NoteLock | undefined) {
  if (!lock?.editor_id || lock.editor_id === getEditorId()) return false;
  if (!lock.expires_at) return true;
  return Date.parse(lock.expires_at) > Date.now();
}

type Tone = "info" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  info: "text-violet-200 [&_[data-notice-icon]]:text-violet-400",
  warning: "text-amber-100 [&_[data-notice-icon]]:text-amber-400",
  danger: "text-red-100 [&_[data-notice-icon]]:text-red-400",
};

const noticeButtonClass =
  "h-7 rounded-md px-2 text-xs font-medium text-neutral-200 hover:bg-white/5 hover:text-white";

const noticePrimaryClass =
  "h-7 rounded-md px-2 text-xs font-medium text-violet-300 hover:bg-violet-500/10 hover:text-violet-200";

function Notice({
  tone,
  icon,
  children,
  actions,
}: {
  tone: Tone;
  icon: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-4 py-1.5 text-xs",
        toneClass[tone],
      )}
    >
      <div className="flex min-w-0 flex-1 basis-64 items-start gap-2 py-1">
        <span
          aria-hidden="true"
          data-notice-icon=""
          className="mt-px shrink-0 [&_svg]:size-3.5"
        >
          {icon}
        </span>
        <p className="min-w-0 text-pretty">{children}</p>
      </div>
      {actions && (
        <div className="-mr-2 flex shrink-0 flex-wrap items-center gap-1">
          {actions}
        </div>
      )}
    </div>
  );
}

function downloadMarkdown(title: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileNameFromTitle(title);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Couldn't copy. Select the text and copy it manually.");
  }
}

export function NoteView({ note }: { note: NoteSummary }) {
  const queryClient = useQueryClient();
  const { userId, openDialog, folderHref } = useFolio();
  const content = useNoteContent(userId, note);
  const editor = useNoteEditor({ userId, note, loaded: content.data });
  const peers = useSyncExternalStore(
    presenceStore.subscribe,
    presenceStore.getSnapshot,
  );
  const presence = presenceFor(peers, note.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmTakeOver, setConfirmTakeOver] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const loadedContent = content.data?.content;
  useEffect(() => {
    if (loadedContent === undefined) return;
    let active = true;
    void readDraft(userId, note.id).then((found) => {
      if (!active) return;
      setDraft(found && found.content !== loadedContent ? found : null);
    });
    return () => {
      active = false;
    };
  }, [loadedContent, note.id, userId]);

  const { mode } = editor;
  const showsEditor =
    mode === "editing" || mode === "conflict" || mode === "lost";
  const offerDraft = draft !== null && !showsEditor && mode !== "acquiring";

  const exportNote = async () => {
    try {
      const loaded =
        content.data ?? (await loadContent(queryClient, userId, note));
      downloadMarkdown(note.title, showsEditor ? editor.text : loaded.content);
    } catch (error) {
      toast.error(describeError(error));
    }
  };

  const cancel = () => {
    if (editor.dirty) setConfirmDiscard(true);
    else editor.stopEditing({ discard: true });
  };

  const meta = [
    note.updated_at ? `Updated ${formatTimestamp(note.updated_at)}` : null,
    formatBytes(note.size),
  ]
    .filter(Boolean)
    .join(" · ");

  const viewLock = content.data?.lock;

  const status = editor.dirty ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-amber-300">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-400" />
      <span className="max-sm:sr-only">Unsaved changes</span>
    </span>
  ) : mode === "editing" ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-violet-300 max-sm:hidden">
      <Lock aria-hidden="true" className="size-3" />
      Editing here
    </span>
  ) : mode === "view" && isForeignLock(viewLock) ? null : (
    <span className="text-muted-foreground hidden shrink-0 truncate text-xs tabular-nums lg:inline">
      {meta}
    </span>
  );

  return (
    <article
      className="flex min-h-0 flex-1 flex-col"
      aria-labelledby="note-heading"
    >
      <LeaveGuard
        when={editor.dirty}
        onDiscard={() => editor.stopEditing({ discard: true })}
      />
      <h1 id="note-heading" className="sr-only">
        {note.title}
      </h1>
      <PaneBar
        actions={
          <>
            {showsEditor ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className={quietActionClass}
                  onClick={cancel}
                  disabled={editor.saving}
                >
                  {mode === "editing" ? "Cancel" : "Close"}
                </Button>
                {mode === "editing" && (
                  <Button
                    size="sm"
                    className={primaryButtonClass}
                    onClick={() => void editor.save()}
                    disabled={editor.saving}
                    aria-keyshortcuts="Control+S Meta+S"
                  >
                    <Save data-icon="inline-start" aria-hidden="true" />
                    {editor.saving ? "Saving…" : "Save"}
                  </Button>
                )}
              </>
            ) : mode === "blocked" ? null : (
              <Button
                size="sm"
                className={primaryButtonClass}
                onClick={() => void editor.startEdit()}
                disabled={mode === "acquiring" || !content.data}
              >
                <PencilLine data-icon="inline-start" aria-hidden="true" />
                {mode === "acquiring" ? "Opening…" : "Edit"}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`More actions for ${note.title}`}
                    className={quietActionClass}
                  />
                }
              >
                <Ellipsis aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-md">
                {mode === "editing" && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        className="rounded-md"
                        disabled={editor.saving}
                        onClick={() => void editor.save({ close: true })}
                      >
                        <Save aria-hidden="true" />
                        Save & Close
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    className="rounded-md"
                    onClick={() => void exportNote()}
                  >
                    <Download aria-hidden="true" />
                    Export .md
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="rounded-md"
                    onClick={() => openDialog({ type: "rename", note })}
                  >
                    <FilePen aria-hidden="true" />
                    Rename or Move
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    variant="destructive"
                    className="rounded-md"
                    onClick={() => openDialog({ type: "delete-note", note })}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <BackButton fallback={folderHref(note.folder)} />
        <FolioBreadcrumbs folder={note.folder} current={note.title} />
        {status}
      </PaneBar>

      {presence !== "none" && (
        <Notice tone="info" icon={<Users />}>
          {presence === "editing"
            ? "This note is being edited in another tab of this browser."
            : "This note is also open in another tab of this browser."}
        </Notice>
      )}

      {offerDraft && (
        <Notice
          tone="warning"
          icon={<History />}
          actions={
            <>
              <Button
                variant="ghost"
                className={noticeButtonClass}
                onClick={() => {
                  void dropDraft(userId, note.id);
                  setDraft(null);
                }}
              >
                Discard
              </Button>
              <Button
                variant="ghost"
                className={noticePrimaryClass}
                onClick={() => {
                  const text = draft.content;
                  setDraft(null);
                  void editor.startEdit({ initialText: text });
                }}
              >
                Restore Draft
              </Button>
            </>
          }
        >
          Restore unsaved draft from{" "}
          {formatTimestamp(new Date(draft.updatedAt).toISOString(), TIME)}?
          {draft.baseVersion !== note.version &&
            " The note has changed since, so check the result before saving."}
        </Notice>
      )}

      {mode === "blocked" && (
        <Notice
          tone="warning"
          icon={<Lock />}
          actions={
            <Button
              variant="ghost"
              className={noticePrimaryClass}
              onClick={() => setConfirmTakeOver(true)}
            >
              Take Over Editing
            </Button>
          }
        >
          Being edited on {lockHolder(editor.lock)}
          {lockTime(editor.lock) ? ` since ${lockTime(editor.lock)}` : ""}. You
          can read it, but only one session can edit at a time.
        </Notice>
      )}

      {mode === "view" && isForeignLock(viewLock) && (
        <Notice tone="info" icon={<Lock />}>
          Being edited on {lockHolder(viewLock)}
          {lockTime(viewLock) ? ` since ${lockTime(viewLock)}` : ""}.
        </Notice>
      )}

      {mode === "lost" && (
        <Notice
          tone="danger"
          icon={<TriangleAlert />}
          actions={
            <>
              <Button
                variant="ghost"
                className={noticeButtonClass}
                onClick={() => void copyText(editor.text)}
              >
                <Copy data-icon="inline-start" aria-hidden="true" />
                Copy Text
              </Button>
              <Button
                variant="ghost"
                className={noticePrimaryClass}
                onClick={() => setConfirmTakeOver(true)}
              >
                Take Back Editing
              </Button>
            </>
          }
        >
          Editing was taken over
          {editor.lock?.editor_label
            ? ` on ${editor.lock.editor_label}`
            : " in another session"}
          , so this tab can no longer save. Your text is still below and kept in
          this browser&apos;s local draft. Copy it, or take editing back.
        </Notice>
      )}

      {mode === "conflict" && (
        <Notice
          tone="danger"
          icon={<TriangleAlert />}
          actions={
            <>
              <Button
                variant="ghost"
                className={noticeButtonClass}
                onClick={() => void copyText(editor.text)}
              >
                <Copy data-icon="inline-start" aria-hidden="true" />
                Copy My Text
              </Button>
              <Button
                variant="ghost"
                className={noticePrimaryClass}
                onClick={() => void editor.reloadLatest()}
              >
                Load Latest Version
              </Button>
            </>
          }
        >
          This note was changed elsewhere after you started editing, so saving
          would overwrite it. Copy your text first, then load the latest version
          and reapply your changes.
        </Notice>
      )}

      {editor.problem && (
        <Notice
          tone="danger"
          icon={<TriangleAlert />}
          actions={
            <Button
              variant="ghost"
              className={noticeButtonClass}
              onClick={editor.clearProblem}
            >
              Dismiss
            </Button>
          }
        >
          {editor.problem.kind === "quota"
            ? `Not saved: ${editor.problem.message || "your storage limit is reached"}. Free up space by deleting notes, or ask an admin to raise your limit.`
            : `Not saved: ${editor.problem.message}`}
        </Notice>
      )}

      {showsEditor ? (
        <NoteEditor
          title={note.title}
          text={editor.text}
          readOnly={mode === "lost"}
          onChange={editor.setText}
        />
      ) : (
        <div className="min-h-0 flex-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent overflow-y-auto overscroll-contain">
          <div className={cn(readingClass, "px-4 py-5 md:px-8 md:py-6")}>
            <p className="text-muted-foreground mb-4 text-xs tabular-nums lg:hidden">
              {meta}
            </p>
            {content.isPending ? (
              <MarkdownSkeleton />
            ) : content.error || !content.data ? (
              <ErrorState
                content="note"
                onRetry={() => void content.refetch()}
              />
            ) : content.data.content.trim() ? (
              <MarkdownView content={content.data.content} />
            ) : (
              <p className="text-muted-foreground text-sm">
                This note is empty. Select Edit to start writing.
              </p>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={confirmTakeOver} onOpenChange={setConfirmTakeOver}>
        <AlertDialogContent className="rounded-lg border border-violet-500 bg-neutral-950">
          <AlertDialogHeader>
            <AlertDialogTitle>Take over editing?</AlertDialogTitle>
            <AlertDialogDescription>
              The other session ({lockHolder(editor.lock)}) loses the edit lock
              and can no longer save. Its unsaved text stays in that
              browser&apos;s local draft.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={primaryButtonClass}
              onClick={() => {
                setConfirmTakeOver(false);
                void editor.startEdit({ takeOver: true });
              }}
            >
              Take Over
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent className={destructiveDialogClass}>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your changes to this note haven&apos;t been saved. Discarding
              removes them and releases the edit lock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              className={destructiveButtonClass}
              onClick={() => {
                setConfirmDiscard(false);
                editor.stopEditing({ discard: true });
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

export function MissingNote() {
  const { folderHref } = useFolio();
  return (
    <section
      aria-label="Note not found"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PaneBar>
        <BackButton fallback={folderHref("")} />
        <h1 className="truncate text-sm font-medium text-neutral-100">
          Note not found
        </h1>
      </PaneBar>
      <p className="text-muted-foreground px-4 py-3 text-sm text-pretty">
        It may have been deleted or moved in another session.{" "}
        <Link
          to={folderHref("")}
          className="text-violet-400 underline-offset-4 hover:text-violet-300 hover:underline"
        >
          Back to all notes
        </Link>
      </p>
    </section>
  );
}
