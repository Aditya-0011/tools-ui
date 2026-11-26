import { folioFrameClass } from "@/lib/styles";

import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/2", "w-3/5", "w-2/3"];

export function FolioSkeleton() {
  return (
    <div role="status" aria-live="polite" className={folioFrameClass}>
      <span className="sr-only">Loading notes…</span>
      <div
        aria-hidden="true"
        className="flex min-w-0 flex-1 flex-col md:w-70 md:flex-none md:border-r md:border-white/10"
      >
        <div className="flex h-11 items-center border-b border-white/10 px-4">
          <Skeleton className="h-3 w-12 rounded-sm bg-neutral-900" />
        </div>
        <div className="flex h-10 items-center border-b border-white/10 px-4">
          <Skeleton className="h-3 w-28 rounded-sm bg-neutral-900" />
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          {ROWS.map((width, index) => (
            <Skeleton
              key={index}
              className={`h-3.5 rounded-sm bg-neutral-900 ${width}`}
            />
          ))}
        </div>
      </div>
      <div
        aria-hidden="true"
        className="hidden min-w-0 flex-1 flex-col md:flex"
      >
        <div className="flex h-11 items-center border-b border-white/10 px-4">
          <Skeleton className="h-3.5 w-40 rounded-sm bg-neutral-900" />
        </div>
        <div className="flex flex-col gap-3 px-4 py-4">
          <Skeleton className="h-3.5 w-2/3 rounded-sm bg-neutral-900" />
          <Skeleton className="h-3.5 w-1/2 rounded-sm bg-neutral-900" />
          <Skeleton className="h-3.5 w-3/5 rounded-sm bg-neutral-900" />
        </div>
      </div>
    </div>
  );
}
