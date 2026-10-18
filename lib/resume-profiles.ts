import { RESUME_VERSIONS, type ResumeVersion } from "./job-workflow.ts";

export type ResumeProfile = { name: string; content: string; updatedAt: string };
export type ResumeSource = { name: ResumeVersion | null; content: string; updatedAt: string };

// Only user-saved text participates in matching. Empty versions are not sample resumes.
export function resolveResumeProfile(profiles: ResumeProfile[], version: string): ResumeSource {
  const saved = profiles.filter((profile) => RESUME_VERSIONS.includes(profile.name as ResumeVersion) && profile.content.trim());
  const selected = saved.find((profile) => profile.name === version)
    ?? saved.find((profile) => profile.name === "通用版")
    ?? [...saved].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name))[0];
  return selected
    ? { name: selected.name as ResumeVersion, content: selected.content.trim(), updatedAt: selected.updatedAt }
    : { name: null, content: "", updatedAt: "" };
}

export const RESUME_MATCH_TERMS = [
  "本科", "硕士", "研究生", "博士", "专科", "学历", "计算机", "设计", "心理学", "逻辑", "结构化", "分析", "写作", "文档", "报告", "PPT",
  "AI", "人工智能", "大模型", "Prompt", "机器学习", "产品", "需求", "用户", "PRD", "原型", "Figma", "Axure", "调研", "沟通", "协调",
  "跨部门", "责任心", "自驱", "抗压", "执行", "Python", "SQL", "Excel", "Office", "数据", "统计", "项目管理", "英语", "雅思",
  "航空", "航天", "无人机", "eVTOL", "应急救援", "仿真", "MBSE", "运营", "增长", "活动", "内容", "推广", "供应链", "电商", "零售",
  "Java", "JavaScript", "TypeScript", "React", "算法", "编程", "数据结构", "前端", "后端", "Git", "访谈", "竞品", "留存", "转化",
] as const;
