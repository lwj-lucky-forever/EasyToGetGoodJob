import { WORKSPACE_PATHS, type WorkspaceView } from "@/lib/workspace-routes";

export function SiteNavigation({ current = "首页", onViewChange }: {
  current?: WorkspaceView | "首页";
  onViewChange?: (view: WorkspaceView) => void;
}) {
  return <nav aria-label="主导航" className="site-navigation">
    <a href="/" aria-current={current === "首页" ? "page" : undefined}>首页</a>
    {(Object.keys(WORKSPACE_PATHS) as WorkspaceView[]).map(view =>
      <a key={view} href={WORKSPACE_PATHS[view]} aria-current={current === view ? "page" : undefined}
        onClick={onViewChange ? event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onViewChange(view);
        } : undefined}>{view === "日程" ? "日程安排" : view}</a>)}
  </nav>;
}
