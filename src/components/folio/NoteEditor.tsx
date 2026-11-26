import { lazy, Suspense, useDeferredValue, useId, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";
import {
  editorClass,
  paneClass,
  paneHeaderClass,
  paneLabelClass,
  readingClass,
} from "@/lib/styles";
import { cn } from "@/lib/utils";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const Markdown = lazy(() => import("@/components/folio/Markdown"));

export function MarkdownSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading note"
      className="flex flex-col gap-3"
    >
      <Skeleton className="h-7 w-2/3 rounded-md bg-neutral-900" />
      <Skeleton className="h-4 w-full rounded-md bg-neutral-900" />
      <Skeleton className="h-4 w-11/12 rounded-md bg-neutral-900" />
      <Skeleton className="h-4 w-4/5 rounded-md bg-neutral-900" />
      <Skeleton className="mt-2 h-4 w-3/5 rounded-md bg-neutral-900" />
    </div>
  );
}

export function MarkdownView({ content }: { content: string }) {
  return (
    <Suspense fallback={<MarkdownSkeleton />}>
      <Markdown content={content} />
    </Suspense>
  );
}

const scrollClass =
  "min-h-0 flex-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent overflow-y-auto overscroll-contain";

function Preview({ text }: { text: string }) {
  const deferred = useDeferredValue(text);
  return deferred.trim() ? (
    <div className={readingClass}>
      <MarkdownView content={deferred} />
    </div>
  ) : (
    <p className="text-muted-foreground py-1 text-sm">
      Nothing to preview yet.
    </p>
  );
}

export function NoteEditor({
  title,
  text,
  readOnly,
  onChange,
}: {
  title: string;
  text: string;
  readOnly: boolean;
  onChange: (text: string) => void;
}) {
  const ids = useId();
  const split = useMediaQuery("(min-width: 1024px)");
  const [tab, setTab] = useState("write");

  const area = (labelled: boolean) => (
    <Textarea
      aria-label={labelled ? undefined : `Markdown for ${title}`}
      aria-labelledby={labelled ? `${ids}-write` : undefined}
      name="content"
      value={text}
      readOnly={readOnly}
      spellCheck
      autoCapitalize="sentences"
      onChange={(event) => onChange(event.target.value)}
      placeholder="# Start writing…"
      className={cn(editorClass, readOnly && "opacity-80")}
    />
  );

  if (split) {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-2">
        <section aria-labelledby={`${ids}-write`} className={paneClass}>
          <div className={paneHeaderClass}>
            <h2 id={`${ids}-write`} className={paneLabelClass}>
              Write
            </h2>
            {readOnly && (
              <p className="text-muted-foreground text-xs">Read only</p>
            )}
          </div>
          {area(true)}
        </section>
        <section
          aria-labelledby={`${ids}-preview`}
          className={cn(paneClass, "border-l border-white/10")}
        >
          <div className={paneHeaderClass}>
            <h2 id={`${ids}-preview`} className={paneLabelClass}>
              Preview
            </h2>
          </div>
          <div
            tabIndex={-1}
            className={cn(scrollClass, "-mr-4 py-1 pr-4 outline-none")}
          >
            <Preview text={text} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(String(value))}
      className="min-h-0 flex-1 gap-0"
    >
      <TabsList
        variant="line"
        className="w-full shrink-0 items-start justify-start gap-4 border-b border-white/10 px-4 group-data-[orientation=horizontal]/tabs:h-10"
      >
        <TabsTrigger
          value="write"
          className="flex-none px-0 after:bg-violet-500 data-active:text-white"
        >
          Write
        </TabsTrigger>
        <TabsTrigger
          value="preview"
          className="flex-none px-0 after:bg-violet-500 data-active:text-white"
        >
          Preview
        </TabsTrigger>
      </TabsList>
      <TabsContent value="write" keepMounted className="flex min-h-0 flex-col">
        <div className={cn(paneClass, "flex-1")}>{area(false)}</div>
      </TabsContent>
      <TabsContent value="preview" className="flex min-h-0 flex-col">
        <div className={cn(scrollClass, "px-4 py-3")}>
          <Preview text={text} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
