"use client";
import { WorkspaceError } from "@/components/workspace-error";
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="zh-CN"><body style={{ margin: 0 }}><WorkspaceError reset={reset} /></body></html>;
}
