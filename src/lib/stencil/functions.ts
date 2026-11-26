import { StencilError, type Span } from "@/lib/stencil/errors";

export type Transform = (value: string) => string;

type FunctionSpec = {
  usage: string;
  build: (args: string[], fail: (reason: string) => never) => Transform;
};

const MAX_PAD = 10000;

function countCodePoints(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < value.length) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
    count++;
  }
  return count;
}

function noArgs(transform: Transform): FunctionSpec["build"] {
  return (args, fail) => {
    if (args.length > 0) fail("takes no arguments");
    return transform;
  };
}

function padding(left: boolean): FunctionSpec["build"] {
  return (args, fail) => {
    if (args.length < 1 || args.length > 2) {
      fail("needs a width and an optional character");
    }
    const width = args[0].trim();
    if (!/^\d+$/.test(width) || Number(width) > MAX_PAD) {
      fail(`width must be a whole number from 0 to ${MAX_PAD}`);
    }
    const fill = args.length === 2 ? args[1] : " ";
    if (countCodePoints(fill) !== 1)
      fail("pad character must be exactly one character");
    const target = Number(width);
    return (value) => {
      if (value.length >= target && countCodePoints(value) >= target) {
        return value;
      }
      const pad = fill.repeat(target - countCodePoints(value));
      return left ? pad + value : value + pad;
    };
  };
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /(^|\s)(\p{L})/gu,
      (_, space: string, letter: string) => space + letter.toUpperCase(),
    );
}

export const FUNCTIONS: Record<string, FunctionSpec> = {
  upper: { usage: "upper", build: noArgs((value) => value.toUpperCase()) },
  lower: { usage: "lower", build: noArgs((value) => value.toLowerCase()) },
  trim: { usage: "trim", build: noArgs((value) => value.trim()) },
  title: { usage: "title", build: noArgs(titleCase) },
  replace: {
    usage: "replace:<from>:<to>",
    build: (args, fail) => {
      if (args.length !== 2) {
        fail(
          "needs two values, like replace:-:_ (write \\: for a literal colon)",
        );
      }
      const [from, to] = args;
      if (from === "") fail("needs text to find, like replace:-:_");
      return (value) => value.replaceAll(from, to);
    },
  },
  padleft: { usage: "padleft:<n>[:<char>]", build: padding(true) },
  padright: { usage: "padright:<n>[:<char>]", build: padding(false) },
  sqlquote: {
    usage: "sqlquote",
    build: noArgs((value) => value.replaceAll("'", "''")),
  },
  jsonstr: {
    usage: "jsonstr",
    build: noArgs((value) => JSON.stringify(value).slice(1, -1)),
  },
  default: {
    usage: "default:<value>",
    build: (args, fail) => {
      if (args.length !== 1) {
        fail(
          "needs one value, like default:n/a (write \\: for a literal colon)",
        );
      }
      const [fallback] = args;
      return (value) => (value === "" ? fallback : value);
    },
  },
};

export const FUNCTION_NAMES = Object.keys(FUNCTIONS);

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return row[b.length];
}

function suggest(name: string): string | null {
  let best: string | null = null;
  let bestScore = 3;
  for (const candidate of FUNCTION_NAMES) {
    const score = distance(name, candidate);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function buildFunction(
  rawName: string,
  args: string[],
  span: Span,
): Transform {
  const name = rawName.trim().toLowerCase();
  if (name === "") {
    throw new StencilError(
      "unknown-function",
      "Empty function name after |. Remove the extra | or add a function like |upper.",
      span,
    );
  }
  const spec = Object.hasOwn(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
  if (!spec) {
    const hint = suggest(name);
    throw new StencilError(
      "unknown-function",
      `Unknown function “${rawName.trim()}”.${hint ? ` Did you mean ${hint}?` : ""} Available: ${FUNCTION_NAMES.join(", ")}.`,
      span,
    );
  }
  return spec.build(args, (reason) => {
    throw new StencilError(
      "bad-arguments",
      `${name} ${reason}. Usage: ${spec.usage}.`,
      span,
    );
  });
}
