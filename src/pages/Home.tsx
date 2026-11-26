import { Navigate } from "react-router";

import { useAuth } from "@/contexts/AuthContext";
import { toolsFor } from "@/lib/tools";

import { ToolAccessDenied } from "@/components/ToolAccessDenied";

export default function Home() {
  const { identity } = useAuth();
  const first = toolsFor(identity)[0];
  if (!first) return <ToolAccessDenied />;
  return <Navigate to={first.url} replace />;
}
