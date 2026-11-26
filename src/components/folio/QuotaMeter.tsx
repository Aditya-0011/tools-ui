import type { NoteQuota } from "@/lib/folio/types";
import { formatBytesPair, formatCount } from "@/lib/folio/paths";
import { cn } from "@/lib/utils";

function ratio(used: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(1, used / max);
}

export function QuotaMeter({ quota }: { quota: NoteQuota }) {
  const fill = Math.max(
    ratio(quota.used_notes, quota.max_notes),
    ratio(quota.used_bytes, quota.max_bytes),
  );
  const tone =
    fill >= 0.95
      ? "bg-red-500"
      : fill >= 0.8
        ? "bg-amber-500"
        : "bg-violet-500";
  const label = `${formatCount(quota.used_notes)} / ${formatCount(quota.max_notes)} notes · ${formatBytesPair(quota.used_bytes, quota.max_bytes)}`;

  return (
    <div className="relative shrink-0 border-t border-white/10 px-4 py-2.5">
      <div
        role="meter"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fill * 100)}
        aria-valuetext={label}
        className="absolute inset-x-0 -top-px h-px overflow-hidden"
      >
        <div
          className={cn(
            "h-full origin-left transition-transform duration-300 ease-out",
            tone,
          )}
          style={{ transform: `scaleX(${fill})` }}
        />
      </div>
      <p
        className={cn(
          "truncate text-xs tabular-nums",
          fill >= 0.95
            ? "text-red-400"
            : fill >= 0.8
              ? "text-amber-300"
              : "text-muted-foreground",
        )}
      >
        {label}
      </p>
    </div>
  );
}
