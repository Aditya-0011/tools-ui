import { Fragment, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Entry = { code: string; text: ReactNode };

const PLACEHOLDERS: Entry[] = [
  { code: "$0 … $n", text: "Column by position from 0. $12 is column 12." },
  { code: "${2}", text: "Same as $2; use it before a digit: ${1}0." },
  { code: "${name}", text: "Column by header name (Header on, any case)." },
  { code: "$ROW", text: "Row index from 0." },
  { code: "$ROWNUM", text: "Row number from 1." },
  { code: "$COUNT", text: "Number of data rows." },
  { code: "$$", text: "A literal $." },
];

const FUNCTIONS: Entry[] = [
  { code: "${0|upper}", text: "ada → ADA" },
  { code: "${0|lower}", text: "ADA → ada" },
  { code: "${0|trim}", text: "“ ada ” → “ada”" },
  { code: "${0|title}", text: "ada lovelace → Ada Lovelace" },
  { code: "${0|replace:-:_}", text: "a-b → a_b" },
  { code: "${0|padleft:5:0}", text: "42 → 00042" },
  { code: "${0|padright:6:.}", text: "ab → ab...." },
  { code: "${0|sqlquote}", text: "O'Neil → O''Neil" },
  { code: "${0|jsonstr}", text: 'say "hi" → say \\"hi\\"' },
  { code: "${0|default:n/a}", text: "(empty) → n/a" },
  { code: "${0|trim|upper}", text: "Chain with |, left to right." },
];

const SECTIONS: Entry[] = [
  { code: "$ONCE", text: "On its own line: lines below print once." },
  { code: "$EACH", text: "On its own line: lines below print per row." },
  { code: "$SEP{,}", text: "Prints “,” after every row but the last." },
  { code: "\\:  \\|  \\}", text: "Literal : | } inside function arguments." },
];

const EXAMPLES: { title: string; pattern: string; output: string }[] = [
  {
    title: "SQL insert",
    pattern:
      "$ONCE\nINSERT INTO t (id, name) VALUES\n$EACH\n($0, '${1|sqlquote}')$SEP{,}\n$ONCE\n;",
    output: "INSERT INTO t (id, name) VALUES\n(1, 'Ann'),\n(2, 'O''Neil')\n;",
  },
  {
    title: "JSON array",
    pattern: '$ONCE\n[\n$EACH\n  "${name|jsonstr}"$SEP{,}\n$ONCE\n]',
    output: '[\n  "Ann",\n  "Bob"\n]',
  },
];

function Group({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[0.6875rem] font-semibold tracking-wider text-neutral-400 uppercase">
        {title}
      </h3>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
        {entries.map((entry) => (
          <Fragment key={entry.code}>
            <dt>
              <code translate="no" className="font-mono text-violet-300">
                {entry.code}
              </code>
            </dt>
            <dd className="text-muted-foreground text-pretty">{entry.text}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}

export function CheatSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(26rem,92vw)] gap-0 overscroll-contain border-white/10 bg-neutral-950 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-white/10 px-4 py-3">
          <SheetTitle>Cheat sheet</SheetTitle>
          <SheetDescription className="text-xs">
            Placeholders, functions and sections for Stencil patterns.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent flex-col gap-6 overflow-y-auto px-4 py-4">
          <Group title="Placeholders" entries={PLACEHOLDERS} />
          <Group title="Functions" entries={FUNCTIONS} />
          <Group title="Sections & escapes" entries={SECTIONS} />
          <section className="flex flex-col gap-3">
            <h3 className="text-[0.6875rem] font-semibold tracking-wider text-neutral-400 uppercase">
              Examples
            </h3>
            {EXAMPLES.map((example) => (
              <div key={example.title} className="flex flex-col gap-1 text-xs">
                <p className="text-neutral-300">{example.title}</p>
                <pre
                  translate="no"
                  className="font-mono leading-relaxed whitespace-pre-wrap text-violet-300"
                >
                  {example.pattern}
                </pre>
                <p className="text-muted-foreground">gives</p>
                <pre className="font-mono leading-relaxed whitespace-pre-wrap text-neutral-400">
                  {example.output}
                </pre>
              </div>
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
