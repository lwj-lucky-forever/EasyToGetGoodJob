import { mergeParsedJob, parseJobText } from "./job-parser.ts";
import {
  RESUME_VERSIONS,
  type PrepChecklistItem,
  type ResumeVersion,
  parseJsonArray,
  recommendResumeVersion,
  sanitizePrepChecklist,
  sanitizeProcessRecords,
} from "./job-workflow.ts";
import { RESUME_MATCH_TERMS, type ResumeSource } from "./resume-profiles.ts";

export type RequirementFit = "匹配" | "部分匹配" | "需补充" | "待确认";

export type RequirementAnalysis = {
  requirement: string;
  fit: RequirementFit;
  score: number;
  evidence: string;
  action: string;
  knowledge: string;
};

export type MatchAnalysis = {
  score: number;
  level: "高" | "中高" | "中等" | "较低";
  summary: string;
  requirements: RequirementAnalysis[];
  strengths: string[];
  priorities: string[];
  basis: string;
  resumeVersion: ResumeVersion;
  recommendedResumeVersion: ResumeVersion;
  version: number;
  analyzedAt: string;
  resumeSource: { name: ResumeVersion | null; updatedAt: string };
  inputKey: string;
};

const CURRENT_ANALYSIS_VERSION = 5;

export type JobForAnalysis = {
  role: string;
  responsibilities: string;
  requirements: string;
  competencies: string;
  rawText?: string;
  resumeVersion?: string;
};

// Rules offer general guidance; they never supply candidate facts or scores.
type Rule = { patterns: RegExp[]; action: string; knowledge: string };

const RULES: Rule[] = [
  {
    patterns: [/本科及以上|硕士|研究生|学历/],
    action: "核对岗位的学历门槛，并在简历中明确填写真实学历、专业、就读状态和毕业时间。",
    knowledge: "确认学历和专业限制；不确定是否符合时向招聘方核实。",
  },
  {
    patterns: [/计算机.*优先|计算机专业|设计.*优先|心理学.*优先|相关专业优先/],
    action: "核对专业限制；如有相关工具或项目经历，可补充真实成果作为证据。",
    knowledge: "补充互联网产品基础、软件研发流程和常用技术术语。",
  },
  {
    patterns: [/逻辑思维|结构化思维|分析能力|问题拆解|独立思考/],
    action: "从自己的真实经历中准备一个“复杂问题—拆解方法—验证结果”的STAR案例。",
    knowledge: "补充产品问题分析框架：5W2H、MECE、漏斗分析与根因分析。",
  },
  {
    patterns: [/文档撰写|写作能力|报告撰写|方案撰写|表达能力|汇报能力/],
    action: "如有文档或汇报经历，整理脱敏作品样例，说明受众和实际产出；没有则先完成练习。",
    knowledge: "补充PRD、需求说明书、会议纪要和项目复盘的标准写法。",
  },
  {
    patterns: [/AI|人工智能|大模型|Prompt|提示词|生成式|机器学习/],
    action: "准备一个可演示的AI应用练习，记录输入、输出、评价指标和迭代前后对比。",
    knowledge: "重点补充主流AI产品、RAG/Agent基础、模型评测、提示词设计及AI产品风险边界。",
  },
  {
    patterns: [/产品经理|产品思维|需求设计|需求分析|产品全流程|功能设计|跟进上线|产品规划/],
    action: "选择真实项目，按“用户/业务需求—功能方案—协同推进—验证结果”整理；缺少经历时先完成产品需求文档练习。",
    knowledge: "补充PRD、用户故事、原型、需求优先级、埋点指标、验收与迭代流程。",
  },
  {
    patterns: [/用户研究|用户调研|客户访谈|需求调研|用户需求/],
    action: "准备一次访谈案例，说明访谈对象、问题设计、洞察结论及其如何转化为方案。",
    knowledge: "补充用户访谈提纲、用户旅程、痛点排序和需求验证方法。",
  },
  {
    patterns: [/沟通能力|沟通协调|跨部门|团队协作|协作意识|客户对接|商务沟通|资源协调/],
    action: "准备一个多方意见不一致时推动落地的STAR案例，突出你如何同步信息、明确责任与跟进节点。",
    knowledge: "补充会议管理、项目干系人分析和跨团队推进机制。",
  },
  {
    patterns: [/责任心|自驱|抗压|执行力|主动性|学习能力|快速学习/],
    action: "用具体节点、工作量和结果证明执行力，避免只使用“认真负责”等抽象表述。",
    knowledge: "补充OKR拆解、优先级管理和周复盘方法。",
  },
  {
    patterns: [/数据分析|SQL|Python|统计|数据处理|数据驱动|指标体系|商业分析/],
    action: "制作一个可展示的数据分析项目，写清数据清洗、指标定义、结论和决策建议。",
    knowledge: "补充Excel高级函数、SQL常见查询、描述统计、A/B测试与业务指标体系。",
  },
  {
    patterns: [/代码能力|编程能力|算法|开发经验|计算机基础|数据结构|后端|前端/],
    action: "若岗位以产品/运营为主，强调技术理解和协作能力；若明确要求开发，应补充一个可运行项目后再投递。",
    knowledge: "按岗位方向补充数据结构、API、数据库、Git和基础软件开发流程。",
  },
  {
    patterns: [/Excel|PowerPoint|PPT|Office|办公软件/],
    action: "把复杂成果压缩成一页数据图表和一页结论页，作为作品集样例。",
    knowledge: "补充Excel透视表、XLOOKUP、Power Query及结构化汇报。",
  },
  {
    patterns: [/Axure|Figma|原型|墨刀|Sketch|交互设计/],
    action: "选择一个熟悉的使用场景，完成核心流程原型并附需求说明。",
    knowledge: "补充Figma或Axure、信息架构、交互状态和可用性原则。",
  },
  {
    patterns: [/运营|增长|活动策划|用户运营|内容运营|策略运营|推广|转化率|留存/],
    action: "如有活动或运营经历，补充目标、用户、触达、执行和反馈；缺少时先完成一份运营方案。",
    knowledge: "补充拉新—激活—留存—转化漏斗、活动复盘、内容策略和增长实验。",
  },
  {
    patterns: [/项目管理|项目推进|进度管理|落地能力|协调推进|按时交付/],
    action: "用里程碑、协作对象、风险和最终交付物描述项目推进，不只写“参与”。",
    knowledge: "补充甘特图、风险清单、RACI和敏捷迭代基础。",
  },
  {
    patterns: [/英语|英文|CET|雅思|TOEFL|海外|国际化/],
    action: "补充已有四六级或雅思成绩；没有可用分数时，强调英文资料阅读和国际交流场景。",
    knowledge: "补充岗位相关英文词汇、英文邮件和英文自我介绍。",
  },
  {
    patterns: [/航空|航天|无人机|eVTOL|飞行器|应急救援|仿真|MBSE|系统工程/],
    action: "优先突出与你投递行业最接近的项目，并量化模型、案例或指标规模。",
    knowledge: "持续补充目标企业产品、行业政策、适航与典型应用场景。",
  },
  {
    patterns: [/零售|本地生活|电商|供应链|充电宝|商场|连锁品牌|O2O/],
    action: "投递前拆解目标业务的用户、商户、履约流程和盈利模式，形成一页业务分析。",
    knowledge: "补充交易链路、供需匹配、商户运营、履约、GMV、转化率和单位经济模型。",
  },
  {
    patterns: [/实习.*3个月|不少于3个月|每周.*4天|到岗|出勤|全职实习|连续实习/],
    action: "确认实际时间安排，在简历或投递备注中写明每周到岗天数、可持续月数和最早到岗日期。",
    knowledge: "无需专业知识；核对岗位时间要求与自己的实际可用时间。",
  },
];

function cleanRequirement(line: string) {
  return line
    .replace(/^\s*(?:[-•·]|\d+[.、)）]|[（(]?\d+[）)])\s*/, "")
    .replace(/^(?:岗位基本要求|职位基本要求|基本任职要求|基本要求|岗位要求|任职要求|职位要求|招聘要求|任职资格|任职条件|资格要求|加分项)\s*[：:]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function requirementLines(job: JobForAnalysis) {
  const parsed = job.rawText ? parseJobText(job.rawText) : {};
  const normalized = mergeParsedJob(job, parsed);
  const primary = normalized.requirements
    .replace(/\s+(?=(?:\d+[.、)）]|[（(]\d+[）)]))/g, "\n")
    .split(/\n+|[；;]/)
    .map(cleanRequirement)
    .filter((line) => line.length >= 4 && !/^(?:岗位要求|基本要求|任职要求|任职资格|加分项)$/.test(line));
  if (primary.length) return primary.slice(0, 20);
  return `${normalized.competencies}\n${normalized.responsibilities}`
    .replace(/\s+(?=(?:\d+[.、)）]|[（(]\d+[）)]))/g, "\n")
    .split(/\n+|[；;]/)
    .map(cleanRequirement)
    .filter((line) => line.length >= 6)
    .map((line) => `由工作内容推导：${line}`)
    .slice(0, 12);
}

function hasTerm(content: string, term: string) {
  // Java is not JavaScript; AI is not email.
  if (/^[a-z]+$/i.test(term)) return new RegExp(`(?<![a-z0-9])${term}(?![a-z0-9])`, "i").test(content);
  return content.includes(term);
}

function positiveEvidence(content: string, term: string) {
  return content.split(/[\n。；;，,]+/).map((line) => line.trim()).filter((line) =>
    hasTerm(line, term) && !/(?:不熟悉|不了解|不会|未掌握|尚未|没有|缺乏|无经验|待学习|计划学习)/.test(line));
}

function degreeLevel(text: string) {
  return /博士/.test(text) ? 4 : /硕士|研究生/.test(text) ? 3 : /本科|学士/.test(text) ? 2 : /专科|大专/.test(text) ? 1 : 0;
}

function analyzeOne(requirement: string, resume: ResumeSource): RequirementAnalysis {
  const rules = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(requirement)));
  const action = [...new Set(rules.map((rule) => rule.action))].join("；") || `核对“${requirement}”，补充真实经历、具体职责和可验证成果。`;
  const knowledge = [...new Set(rules.map((rule) => rule.knowledge))].join("；") || `围绕“${requirement}”整理基础概念、工作方法和可展示的练习。`;
  const checks: { matched: boolean; evidence: string[] }[] = [];
  let needsConfirmation = false;
  const degree = degreeLevel(requirement);
  if (degree) {
    const lines = resume.content.split(/[\n。；;]+/).filter((line) => degreeLevel(line) && !/非学历|未取得|没有|未毕业于/.test(line));
    const required = /本科.*(?:或|及).*硕士/.test(requirement) ? 2 : degree;
    checks.push({ matched: Math.max(0, ...lines.map(degreeLevel)) >= required, evidence: lines });
  }
  const terms = RESUME_MATCH_TERMS.filter((term) => !/^(本科|硕士|研究生|博士|专科|学历)$/.test(term) && hasTerm(requirement, term));
  for (const term of terms) {
    const evidence = positiveEvidence(resume.content, term);
    checks.push({ matched: evidence.length > 0, evidence });
  }
  const timeChecks = [
    { pattern: /每周[^\d\n，。；;]{0,8}(\d+)\s*天/, label: /每周/ },
    { pattern: /(?:实习|持续)[^\d\n，。；;]{0,8}(\d+)\s*个?月/, label: /实习|持续/ },
  ];
  for (const { pattern, label } of timeChecks) {
    const expected = requirement.match(pattern);
    if (!expected) continue;
    const evidence = resume.content.split(/[\n。；;]+/).filter((line) => label.test(line) && pattern.test(line) && !/不能|无法|不超过|最多/.test(line));
    checks.push({ matched: evidence.some((line) => Number(line.match(pattern)?.[1]) >= Number(expected[1])), evidence });
    if (!evidence.length) needsConfirmation = true;
  }
  if (/到岗日期|最早到岗|工作经验|[一二三四五六七八九十\d]+年.*经验|毕业|在校|应届|CET|雅思|TOEFL|专业|优先|或|至少|不少于/.test(requirement)) needsConfirmation = true;
  const matched = checks.filter((check) => check.matched);
  const score = resume.content && checks.length ? Math.round(matched.length / checks.length * 100) : 0;
  const fit: RequirementFit = !resume.content || !checks.length || (needsConfirmation && !matched.length) ? "待确认"
    : score === 100 && !needsConfirmation ? "匹配" : score > 0 ? "部分匹配" : "需补充";
  const evidence = [...new Set(checks.flatMap((check) => check.evidence))].slice(0, 3);
  return {
    requirement, fit, score,
    evidence: !resume.content ? "尚未保存简历，请先上传并保存。"
      : evidence.length ? `当前简历原文：${evidence.map((line) => `“${line.slice(0, 240)}”`).join("；")}。${needsConfirmation ? "学历状态、专业、经验、时间或优先条件仍需人工核对。" : "关键词出现不代表熟练程度，请核对成果。"}`
        : "当前简历中未找到直接文字证据；未提及不代表不具备，请人工核对。",
    action, knowledge,
  };
}

export function analyzeJob(job: JobForAnalysis, resume: ResumeSource, inputKey = ""): MatchAnalysis {
  const recommendedResumeVersion = recommendResumeVersion(job);
  const resumeVersion = RESUME_VERSIONS.includes(job.resumeVersion as ResumeVersion) ? job.resumeVersion as ResumeVersion : "通用版";
  const requirements = requirementLines(job).map((requirement) => analyzeOne(requirement, resume));
  const score = requirements.length ? Math.round(requirements.reduce((sum, item) => sum + item.score, 0) / requirements.length) : 0;
  const level = score >= 82 ? "高" : score >= 68 ? "中高" : score >= 52 ? "中等" : "较低";
  const counts = (fit: RequirementFit) => requirements.filter((item) => item.fit === fit).length;
  const strengths = [...new Set(requirements.filter((item) => item.fit === "匹配").map((item) => item.evidence))].slice(0, 3);
  const priorities = [...new Set(requirements.filter((item) => item.fit !== "匹配").map((item) => item.knowledge))].slice(0, 4);
  return {
    score, level,
    summary: !resume.content ? "尚未保存简历，暂不能评估匹配度；当前 0 分表示未评估。"
      : !requirements.length ? "岗位要求信息不足，暂不能评估匹配度；请补充岗位要求。"
        : `共分析${requirements.length}条要求：${counts("匹配")}条文字匹配、${counts("部分匹配")}条部分匹配、${counts("需补充")}条需补充、${counts("待确认")}条待确认。分数是文字证据覆盖参考。`,
    requirements,
    strengths: strengths.length ? strengths : ["暂未找到充分的文字匹配证据，请核对简历并补充真实成果。"],
    priorities: !resume.content ? ["先上传简历、核对提取文字并保存，再查看匹配与准备建议。"] : priorities.length ? priorities : ["核对岗位要求，并准备能验证简历成果的作品或案例。"],
    basis: resume.name ? `实际使用“${resume.name}”${resume.name !== resumeVersion ? `（“${resumeVersion}”未保存，使用已有简历）` : ""}。按岗位要求与简历文字计算覆盖度，不调用 AI 模型，不推断未提供的个人经历。` : "没有可用的已保存简历，不使用示例个人信息。",
    resumeVersion, recommendedResumeVersion,
    resumeSource: { name: resume.name, updatedAt: resume.updatedAt },
    inputKey, version: CURRENT_ANALYSIS_VERSION, analyzedAt: new Date().toISOString(),
  };
}

// SHA-256 covers actual text, source revision, selected version and JD, not a filename.
export async function analysisInputKey(job: JobForAnalysis, resume: ResumeSource) {
  const input = JSON.stringify([CURRENT_ANALYSIS_VERSION, job.role, job.responsibilities, job.requirements, job.competencies, job.rawText ?? "", job.resumeVersion ?? "通用版", resume]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generatePrepChecklist(analysis: MatchAnalysis, previous: PrepChecklistItem[] = []) {
  const doneByText = new Map(previous.map((item) => [item.text, item.done]));
  const candidates = analysis.requirements.flatMap((item) => {
    if (item.fit === "匹配") return [];
    return [
      { text: item.action, category: "行动" as const },
      ...(item.knowledge.startsWith("无需专业知识") ? [] : [{ text: item.knowledge, category: "知识" as const }]),
    ];
  });
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = item.text.replace(/\s/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 12).map((item, index) => ({
    id: `v${analysis.version}-${item.category}-${index}`,
    text: item.text,
    category: item.category,
    done: doneByText.get(item.text) ?? false,
  }));
}

export function presentJob<T extends JobForAnalysis & { analysisJson?: string; matchScore?: number | null; matchLevel?: string; analyzedAt?: string | null; processRecordsJson?: string; prepChecklistJson?: string }>(job: T, resume: ResumeSource, inputKey: string, force = false) {
  const normalizedJob = mergeParsedJob(job, job.rawText ? parseJobText(job.rawText) : {});
  let analysis: MatchAnalysis | null = null;
  if (job.analysisJson) {
    try { analysis = JSON.parse(job.analysisJson) as MatchAnalysis; } catch { analysis = null; }
  }
  const stale = force || !analysis || analysis.version !== CURRENT_ANALYSIS_VERSION || analysis.inputKey !== inputKey;
  if (stale || !analysis) analysis = analyzeJob(normalizedJob, resume, inputKey);
  const storedChecklist = parseJsonArray(job.prepChecklistJson, sanitizePrepChecklist);
  const prepChecklist = stale || !storedChecklist.length ? generatePrepChecklist(analysis, storedChecklist) : storedChecklist;
  const processRecords = parseJsonArray(job.processRecordsJson, sanitizeProcessRecords);
  const { analysisJson: _analysisJson, processRecordsJson: _processRecordsJson, prepChecklistJson: _prepChecklistJson, ...safeJob } = normalizedJob;
  return { ...safeJob, matchScore: analysis.score, matchLevel: analysis.level, matchAnalysis: analysis, prepChecklist, processRecords };
}
