import { ShieldOff } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { CONSOLE_HOME_URL } from "@/lib/env";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function ToolAccessDenied({ title }: { title?: string }) {
  const { identity } = useAuth();
  const email = identity?.email ?? null;
  const subject = title ?? "any tools";

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-6 p-6 text-center text-white"
    >
      <div
        aria-hidden="true"
        className="flex size-20 items-center justify-center rounded-full bg-violet-500/10 shadow-[0_0_30px_-10px] ring-1 shadow-violet-500/20 ring-violet-500/20"
      >
        <ShieldOff className="size-10 text-violet-500" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-balance">
          {title ? `${title} isn’t available` : "No tools yet"}
        </h1>
        <p className="text-muted-foreground text-sm text-pretty break-words">
          {email ? `${email} doesn’t` : "Your account doesn’t"} have access to{" "}
          {subject} right now. Ask an admin to enable it for you in Console.
        </p>
      </div>
      {CONSOLE_HOME_URL && (
        <a
          href={CONSOLE_HOME_URL}
          className={cn(
            buttonVariants(),
            "rounded-md bg-violet-500 text-white hover:bg-violet-400",
          )}
        >
          Open Console
        </a>
      )}
    </div>
  );
}
