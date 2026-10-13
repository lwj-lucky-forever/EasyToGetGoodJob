export type BrowserToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

export type BrowserToolContext = {
  registerTool: (tool: BrowserToolDefinition, options?: { signal?: AbortSignal }) => void | Promise<void>;
  unregisterTool?: (name: string) => void | Promise<void>;
};

export function getOptionalBrowserContext(): BrowserToolContext | undefined {
  try {
    return typeof document === "undefined" ? undefined :
      (document as Document & { modelContext?: BrowserToolContext }).modelContext;
  } catch {
    return undefined;
  }
}

// Optional browser integrations must never escape into React's error boundary.
// Promise.resolve(registerTool(...)) does NOT catch synchronous throws.
export function registerOptionalBrowserTools(context: BrowserToolContext | undefined, definitions: BrowserToolDefinition[]) {
  const lifecycle = new AbortController();
  const registered = new Set<string>();
  const unregister = (name: string) => {
    void Promise.resolve().then(() => context?.unregisterTool?.(name)).catch(() => undefined);
  };
  for (const tool of definitions) {
    void Promise.resolve().then(async () => {
      if (lifecycle.signal.aborted || typeof context?.registerTool !== "function") return;
      await context.registerTool(tool, { signal: lifecycle.signal });
      if (lifecycle.signal.aborted) unregister(tool.name);
      else registered.add(tool.name);
    }).catch(() => undefined);
  }
  return () => {
    try { lifecycle.abort(); } catch { /* Ignore optional integration cleanup failures. */ }
    for (const name of registered) unregister(name);
  };
}
