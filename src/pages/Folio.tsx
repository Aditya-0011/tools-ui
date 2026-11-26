import { useEffect } from "react";

import { useNotesList } from "@/api/folio";
import { useAuth } from "@/contexts/AuthContext";
import { useFolio } from "@/hooks/use-folio";
import { useMediaQuery } from "@/hooks/use-media-query";
import { pruneCache } from "@/lib/folio/cache";
import { folioFrameClass } from "@/lib/styles";
import { cn } from "@/lib/utils";

import { Error } from "@/components/Error";
import { DialogHost } from "@/components/folio/DialogHost";
import { FolderView } from "@/components/folio/FolderView";
import { FolioExplorer } from "@/components/folio/FolioExplorer";
import { FolioProvider } from "@/components/folio/FolioProvider";
import { FolioSkeleton } from "@/components/folio/FolioSkeleton";
import { MissingNote, NoteView } from "@/components/folio/NoteView";

function MainPane() {
  const { selectedNoteId, notesById } = useFolio();
  if (selectedNoteId === null) return <FolderView />;
  const note = notesById.get(selectedNoteId);
  if (!note) return <MissingNote />;
  return <NoteView key={note.id} note={note} />;
}

function FolioLayout() {
  const { selectedNoteId, selectedFolder } = useFolio();
  const wide = useMediaQuery("(min-width: 768px)");
  const inMain = selectedNoteId !== null || selectedFolder !== "";
  const showExplorer = wide || !inMain;
  const showMain = wide || inMain;

  return (
    <div className={folioFrameClass}>
      {showExplorer && (
        <aside
          aria-label="Folio"
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            wide ? "w-70 shrink-0 border-r border-white/10" : "flex-1",
          )}
        >
          <FolioExplorer />
        </aside>
      )}
      {showMain && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <MainPane />
        </div>
      )}
      <DialogHost />
    </div>
  );
}

export default function Folio() {
  const { identity } = useAuth();
  const userId = identity?.user_id ?? 0;
  const { data, isPending, error, refetch } = useNotesList(userId);

  useEffect(() => {
    if (!data || userId === 0) return;
    const timer = window.setTimeout(
      () => void pruneCache(userId, data.notes),
      2000,
    );
    return () => window.clearTimeout(timer);
  }, [data, userId]);

  if (isPending) return <FolioSkeleton />;
  if (error || !data) {
    return <Error content="notes" onRetry={() => void refetch()} />;
  }

  return (
    <FolioProvider userId={userId} list={data}>
      <FolioLayout />
    </FolioProvider>
  );
}
