import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";

import { ChevronLeft } from "lucide-react";

import { quietActionClass } from "@/lib/styles";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";

export function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Back"
      className={cn(quietActionClass, "-ml-2 shrink-0 md:hidden")}
      onClick={() => {
        if (location.key !== "default") void navigate(-1);
        else void navigate(fallback);
      }}
    >
      <ChevronLeft aria-hidden="true" />
    </Button>
  );
}

export function PaneBar({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/10 px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      {actions && (
        <div className="flex shrink-0 items-center gap-1 pointer-coarse:gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
