import type { ReactNode } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/auth";
import { toolBySlug } from "@/lib/tools";

import { ToolAccessDenied } from "@/components/ToolAccessDenied";

export function RequireTool({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const { identity } = useAuth();
  const tool = toolBySlug(slug);
  if (!hasPermission(identity, tool.permission)) {
    return <ToolAccessDenied title={tool.title} />;
  }
  return children;
}
