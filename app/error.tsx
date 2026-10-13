"use client";
import { WorkspaceError } from "@/components/workspace-error";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <WorkspaceError reset={reset} />;
}
