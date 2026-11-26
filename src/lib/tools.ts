import { NotebookText, Stamp, type LucideIcon } from "lucide-react";

import { hasPermission, type Identity } from "@/lib/auth";

export type Tool = {
  slug: string;
  title: string;
  url: string;
  permission: string;
  icon: LucideIcon;
};

export const TOOLS: Tool[] = [
  {
    slug: "folio",
    title: "Folio",
    url: "/folio",
    permission: "tools.folio",
    icon: NotebookText,
  },
  {
    slug: "stencil",
    title: "Stencil",
    url: "/stencil",
    permission: "tools.stencil",
    icon: Stamp,
  },
];

export function toolsFor(identity: Identity | null): Tool[] {
  return TOOLS.filter((tool) => hasPermission(identity, tool.permission));
}

export function toolBySlug(slug: string): Tool {
  const tool = TOOLS.find((entry) => entry.slug === slug);
  if (!tool) throw new Error(`Unknown tool ${slug}`);
  return tool;
}
