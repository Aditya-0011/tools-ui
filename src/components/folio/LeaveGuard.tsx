import { useBlocker } from "react-router";

import { destructiveButtonClass, destructiveDialogClass } from "@/lib/styles";

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

export function LeaveGuard({
  when,
  onDiscard,
}: {
  when: boolean;
  onDiscard: () => void;
}) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );
  const open = blocker.state === "blocked";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && blocker.state === "blocked") blocker.reset();
      }}
    >
      <AlertDialogContent className={destructiveDialogClass}>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes in this note. Leaving discards them and
            releases the edit lock.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-md">
            Keep Editing
          </AlertDialogCancel>
          <AlertDialogAction
            className={destructiveButtonClass}
            onClick={() => {
              onDiscard();
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            Discard Changes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
