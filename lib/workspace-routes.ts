export const WORKSPACE_PATHS = {
  岗位管理: "/jobs",
  求职进度: "/pipeline",
  日程: "/schedule",
  面试题库: "/interviews",
} as const;

export type WorkspaceView = keyof typeof WORKSPACE_PATHS;
