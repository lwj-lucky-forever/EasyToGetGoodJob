"use client";

export function WorkspaceError({ reset }: { reset?: () => void }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1f5f9", padding: 24, color: "#0f172a", fontFamily: "system-ui, sans-serif" }}>
      <section role="alert" style={{ width: "100%", maxWidth: 480, padding: 32, background: "white", border: "1px solid #e2e8f0", borderRadius: 24 }}>
        <p style={{ color: "#4f46e5", fontWeight: 700 }}>实习投递管理</p>
        <h1 style={{ fontSize: 24, lineHeight: 1.4 }}>页面遇到问题，请重试</h1>
        <p style={{ fontSize: 16, lineHeight: 1.8, color: "#475569" }}>页面未能完成加载。本次错误不会删除已保存的岗位；如果正在编辑，刷新前请先保留尚未保存的内容。</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
          <button type="button" onClick={() => reset ? reset() : window.location.reload()} style={{ padding: "12px 18px", border: 0, borderRadius: 12, background: "#4f46e5", color: "white", fontSize: 16, cursor: "pointer" }}>重新尝试</button>
          <a href="/jobs" target="_top" style={{ padding: "12px 18px", border: "1px solid #cbd5e1", borderRadius: 12, color: "#334155", textDecoration: "none", fontSize: 16 }}>重新打开工作区</a>
        </div>
      </section>
    </main>
  );
}
