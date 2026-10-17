import { mergeParsedJob, parseJobText } from "./job-parser";
import {
  type PrepChecklistItem,
  type ResumeVersion,
  parseJsonArray,
  recommendResumeVersion,
  sanitizePrepChecklist,
  sanitizeProcessRecords,
} from "./job-workflow";
import { DEFAULT_RESUME_PROFILES, RESUME_MATCH_TERMS } from "./resume-profiles";

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
};

const CURRENT_ANALYSIS_VERSION = 4;

type JobForAnalysis = {
  role: string;
  responsibilities: string;
  requirements: string;
  competencies: string;
  rawText?: string;
  resumeVersion?: string;
};

type Rule = {
  patterns: RegExp[];
  fit: RequirementFit;
  score: number;
  evidence: string;
  action: string;
  knowledge: string;
};

const PROFILE_BOOSTS: Record<ResumeVersion, RegExp | null> = {
  通用版: null,
  产品版: /产品|需求|用户|功能|原型|PRD|竞品|交互|项目推进/,
  运营版: /运营|增长|活动|内容|推广|留存|转化|沟通|协调|执行/,
  数据分析版: /数据|SQL|Python|统计|分析|指标|Excel|机器学习/,
  航空专业版: /航空|航天|无人机|eVTOL|飞行器|应急救援|仿真|MBSE/,
};

const RULES: Rule[] = [
  {
    patterns: [/本科及以上|硕士|研究生|学历/], fit: "匹配", score: 100,
    evidence: "北航航空相关方向硕士在读，研究生成绩排名6/74。",
    action: "在简历教育经历首行突出“硕士在读、排名6/74”，投递时无需额外补足。",
    knowledge: "无需补充；面试前准备30秒教育背景介绍。",
  },
  {
    patterns: [/计算机.*优先|计算机专业|设计.*优先|心理学.*优先|相关专业优先/], fit: "部分匹配", score: 65,
    evidence: "专业并非计算机或设计，但具备Python、SQL、机器学习基础，并长期参与仿真与数智化项目。",
    action: "把技术工具和数智化项目放在专业名称之后，用项目证据弱化专业不完全对口的问题。",
    knowledge: "补充互联网产品基础、软件研发流程和常用技术术语。",
  },
  {
    patterns: [/逻辑思维|结构化思维|分析能力|问题拆解|独立思考/], fit: "匹配", score: 92,
    evidence: "完成效能评估指标体系、AHP+CRITIC权重设计、任务模型与MBSE规则梳理，具有明确的问题拆解证据。",
    action: "准备一个“复杂问题—拆解方法—验证结果”的STAR案例，优先使用灭火效能评估项目。",
    knowledge: "补充产品问题分析框架：5W2H、MECE、漏斗分析与根因分析。",
  },
  {
    patterns: [/文档撰写|写作能力|报告撰写|方案撰写|表达能力|汇报能力/], fit: "匹配", score: 94,
    evidence: "参与专利、研究报告、模型明细、课程材料和对外汇报，具备大量结构化写作与PPT表达经验。",
    action: "从专利、项目报告、课程PPT中整理2—3份脱敏作品样例，面试时说明受众与产出效果。",
    knowledge: "补充PRD、需求说明书、会议纪要和项目复盘的标准写法。",
  },
  {
    patterns: [/AI|人工智能|大模型|Prompt|提示词|生成式|机器学习/], fit: "部分匹配", score: 74,
    evidence: "学习过生成式AI与机器学习，曾用Prompt模板将非结构化救援案例转化为结构化任务信息。",
    action: "把Prompt模板整理成可演示案例，补充输入、输出、评价指标和迭代前后对比。",
    knowledge: "重点补充主流AI产品、RAG/Agent基础、模型评测、提示词设计及AI产品风险边界。",
  },
  {
    patterns: [/产品经理|产品思维|需求设计|需求分析|产品全流程|功能设计|跟进上线|产品规划/], fit: "部分匹配", score: 70,
    evidence: "有需求调研、任务流程建模、系统功能梳理和项目推进经历，但互联网产品从需求到上线的数据闭环证据仍偏少。",
    action: "将MBSE和应急系统经历改写为“用户/业务需求—功能方案—协同推进—验证结果”，并独立完成一份产品需求文档。",
    knowledge: "补充PRD、用户故事、原型、需求优先级、埋点指标、验收与迭代流程。",
  },
  {
    patterns: [/用户研究|用户调研|客户访谈|需求调研|用户需求/], fit: "匹配", score: 86,
    evidence: "参与救援案例与需求调研，并与航空器制造商、一线用户及教师企业多方沟通。",
    action: "准备一次访谈案例，说明访谈对象、问题设计、洞察结论及其如何转化为方案。",
    knowledge: "补充用户访谈提纲、用户旅程、痛点排序和需求验证方法。",
  },
  {
    patterns: [/沟通能力|沟通协调|跨部门|团队协作|协作意识|客户对接|商务沟通|资源协调/], fit: "匹配", score: 91,
    evidence: "有制造商和一线用户沟通、延世大学研学带队、学生兼职辅导员及MBSE课程助教经历。",
    action: "准备一个多方意见不一致时推动落地的STAR案例，突出你如何同步信息、明确责任与跟进节点。",
    knowledge: "补充会议管理、项目干系人分析和跨团队推进机制。",
  },
  {
    patterns: [/责任心|自驱|抗压|执行力|主动性|学习能力|快速学习/], fit: "匹配", score: 84,
    evidence: "持续承担科研项目、课程助教、研学带队及辅导员等多角色任务，能够在明确目标下推进交付。",
    action: "用具体节点、工作量和结果证明执行力，避免只使用“认真负责”等抽象表述。",
    knowledge: "补充OKR拆解、优先级管理和周复盘方法。",
  },
  {
    patterns: [/数据分析|SQL|Python|统计|数据处理|数据驱动|指标体系|商业分析/], fit: "匹配", score: 88,
    evidence: "具备Python、SQL基础，并使用AHP、CRITIC、仿真样本和指标体系开展定量效能评估。",
    action: "制作一个可展示的数据分析项目，写清数据清洗、指标定义、结论和决策建议。",
    knowledge: "补充Excel高级函数、SQL常见查询、描述统计、A/B测试与业务指标体系。",
  },
  {
    patterns: [/代码能力|编程能力|算法|开发经验|计算机基础|数据结构|后端|前端/], fit: "需补充", score: 45,
    evidence: "简历中有Python、SQL和机器学习基础，但尚缺少软件工程、算法题或完整开发项目证据。",
    action: "若岗位以产品/运营为主，强调技术理解和协作能力；若明确要求开发，应补充一个可运行项目后再投递。",
    knowledge: "按岗位方向补充数据结构、API、数据库、Git和基础软件开发流程。",
  },
  {
    patterns: [/Excel|PowerPoint|PPT|Office|办公软件/], fit: "匹配", score: 90,
    evidence: "长期完成项目报告、数据表格、汇报PPT和课程材料，办公软件应用场景丰富。",
    action: "把复杂成果压缩成一页数据图表和一页结论页，作为作品集样例。",
    knowledge: "补充Excel透视表、XLOOKUP、Power Query及结构化汇报。",
  },
  {
    patterns: [/Axure|Figma|原型|墨刀|Sketch|交互设计/], fit: "需补充", score: 42,
    evidence: "现有简历未提供主流互联网原型工具的明确作品证据。",
    action: "选择一个熟悉的应急或校园场景，完成核心流程原型并附需求说明。",
    knowledge: "补充Figma或Axure、信息架构、交互状态和可用性原则。",
  },
  {
    patterns: [/运营|增长|活动策划|用户运营|内容运营|策略运营|推广|转化率|留存/], fit: "部分匹配", score: 63,
    evidence: "具备活动组织、研学带队、内容材料和项目推进经验，但互联网运营指标与增长实验经历较少。",
    action: "把研学或课程组织经历改写为目标、用户、触达、执行和反馈闭环，并补做一份运营方案。",
    knowledge: "补充拉新—激活—留存—转化漏斗、活动复盘、内容策略和增长实验。",
  },
  {
    patterns: [/项目管理|项目推进|进度管理|落地能力|协调推进|按时交付/], fit: "匹配", score: 86,
    evidence: "有科研项目、专利、模型体系、课程助教和研学活动等多任务推进经历。",
    action: "用里程碑、协作对象、风险和最终交付物描述项目推进，不只写“参与”。",
    knowledge: "补充甘特图、风险清单、RACI和敏捷迭代基础。",
  },
  {
    patterns: [/英语|英文|CET|雅思|TOEFL|海外|国际化/], fit: "部分匹配", score: 62,
    evidence: "有韩国延世大学暑期学校国际交流与带队经历，目前正在准备雅思，但简历中缺少明确语言成绩证据。",
    action: "补充已有四六级或雅思成绩；没有可用分数时，强调英文资料阅读和国际交流场景。",
    knowledge: "补充岗位相关英文词汇、英文邮件和英文自我介绍。",
  },
  {
    patterns: [/航空|航天|无人机|eVTOL|飞行器|应急救援|仿真|MBSE|系统工程/], fit: "匹配", score: 97,
    evidence: "航空本硕背景与航空应急救援、无人机/eVTOL、MBSE、任务规划和仿真项目高度相关。",
    action: "优先突出与你投递行业最接近的项目，并量化模型、案例或指标规模。",
    knowledge: "持续补充目标企业产品、行业政策、适航与典型应用场景。",
  },
  {
    patterns: [/零售|本地生活|电商|供应链|充电宝|商场|连锁品牌|O2O/], fit: "需补充", score: 48,
    evidence: "当前经历以航空应急与科研项目为主，缺少零售、本地生活或电商业务的直接实践。",
    action: "投递前拆解目标业务的用户、商户、履约流程和盈利模式，形成一页业务分析。",
    knowledge: "补充交易链路、供需匹配、商户运营、履约、GMV、转化率和单位经济模型。",
  },
  {
    patterns: [/实习.*3个月|不少于3个月|每周.*4天|到岗|出勤|全职实习|连续实习/], fit: "待确认", score: 60,
    evidence: "简历无法证明实际可到岗日期、每周出勤天数和连续实习时长。",
    action: "确认课题与课程安排，在简历顶部或投递备注中明确“可连续实习3个月、每周到岗X天、最早到岗日期”。",
    knowledge: "无需专业知识；需要提前解决时间安排和导师沟通。",
  },
];

const PROFILE_TERMS = [
  "航空", "无人机", "eVTOL", "应急救援", "MBSE", "仿真", "任务规划", "效能评估",
  "Python", "SQL", "机器学习", "需求调研", "指标体系", "项目报告", "PPT", "沟通", "协调",
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

function resumeHasTerm(content: string, term: string) {
  if (term === "本科" || term === "学历") return /本科|硕士|研究生/.test(content);
  if (term === "AI" || term === "人工智能") return /AI|人工智能|大模型|机器学习/i.test(content);
  if (term === "沟通" || term === "协调" || term === "跨部门") return /沟通|协调|协作|对接|带队/.test(content);
  if (term === "写作" || term === "文档" || term === "报告") return /写作|文档|报告|专利|材料/.test(content);
  return content.toLowerCase().includes(term.toLowerCase());
}

function analyzeOne(requirement: string, resumeVersion: ResumeVersion, resumeContent: string): RequirementAnalysis {
  const requirementTerms = RESUME_MATCH_TERMS.filter((term) => requirement.toLowerCase().includes(term.toLowerCase()));
  const resumeTerms = requirementTerms.filter((term) => resumeHasTerm(resumeContent, term));
  const coverage = requirementTerms.length ? resumeTerms.length / requirementTerms.length : null;
  const matched = RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(requirement)));
  if (matched.length) {
    const profileBoost = PROFILE_BOOSTS[resumeVersion]?.test(requirement) ? 5 : 0;
    const ruleScore = Math.min(100, Math.round(matched.reduce((sum, rule) => sum + rule.score, 0) / matched.length) + profileBoost);
    const score = coverage === null ? ruleScore : Math.round(ruleScore * 0.7 + coverage * 100 * 0.3);
    const fits = matched.map((rule) => rule.fit);
    const ruleFit: RequirementFit = fits.includes("需补充") ? (score >= 58 ? "部分匹配" : "需补充")
      : fits.includes("待确认") ? "待确认"
        : fits.includes("部分匹配") ? "部分匹配" : "匹配";
    const fit: RequirementFit = coverage === 0 && ruleFit === "匹配" ? (score >= 55 ? "部分匹配" : "需补充")
      : coverage !== null && coverage < 0.6 && ruleFit === "匹配" ? "部分匹配" : ruleFit;
    return {
      requirement,
      fit,
      score,
      evidence: resumeTerms.length
        ? `所选简历文字中出现：${resumeTerms.join("、")}。请核对相关经历是否足以证明这项要求。`
        : "所选简历文字中未找到这项要求的直接关键词；请人工核对相关经历。",
      action: [...new Set(matched.map((rule) => rule.action))].join("；"),
      knowledge: [...new Set(matched.map((rule) => rule.knowledge))].join("；"),
    };
  }

  const overlaps = PROFILE_TERMS.filter((term) => requirement.toLowerCase().includes(term.toLowerCase()) && resumeContent.toLowerCase().includes(term.toLowerCase()));
  if (overlaps.length) {
    return {
      requirement,
      fit: "部分匹配",
      score: 64,
      evidence: `简历中已有${overlaps.join("、")}相关学习或项目经历，但需要补充更直接的成果证据。`,
      action: "从现有项目中选择最接近的任务，按STAR结构补充具体职责、方法和量化结果。",
      knowledge: `围绕“${requirement}”梳理行业定义、常用方法、评价指标与一个真实案例。`,
    };
  }

  return {
    requirement,
    fit: "需补充",
    score: 38,
    evidence: "现有简历中没有找到能直接证明这项要求的经历。",
    action: "先判断这是硬性门槛还是加分项；若为硬性门槛，完成最小学习项目后再投递，并把成果写入简历。",
    knowledge: `针对“${requirement}”补充基础概念、常用工具、典型工作流程和可展示的练习成果。`,
  };
}

export function analyzeJob(job: JobForAnalysis, actualResumeContent?: string): MatchAnalysis {
  const recommendedResumeVersion = recommendResumeVersion(job);
  const requestedResumeVersion = job.resumeVersion ?? "";
  const resumeVersion = Object.prototype.hasOwnProperty.call(DEFAULT_RESUME_PROFILES, requestedResumeVersion) ? requestedResumeVersion as ResumeVersion : recommendedResumeVersion;
  const resumeContent = actualResumeContent?.trim() || DEFAULT_RESUME_PROFILES[resumeVersion];
  const requirements = requirementLines(job).map((requirement) => analyzeOne(requirement, resumeVersion, resumeContent));
  const score = requirements.length
    ? Math.round(requirements.reduce((sum, item) => sum + item.score, 0) / requirements.length)
    : 55;
  const level = score >= 82 ? "高" : score >= 68 ? "中高" : score >= 52 ? "中等" : "较低";
  const matchedCount = requirements.filter((item) => item.fit === "匹配").length;
  const partialCount = requirements.filter((item) => item.fit === "部分匹配").length;
  const gapCount = requirements.filter((item) => item.fit === "需补充").length;
  const strengths = [...new Set(requirements.filter((item) => item.fit === "匹配").map((item) => item.evidence))].slice(0, 3);
  const priorities = [...new Set(requirements.filter((item) => item.fit === "需补充" || item.fit === "待确认").map((item) => item.knowledge))].slice(0, 4);

  return {
    score,
    level,
    summary: requirements.length
      ? `共分析${requirements.length}条要求：${matchedCount}条匹配、${partialCount}条部分匹配、${gapCount}条需要重点补充。`
      : "岗位要求信息不足，当前分数仅供参考；补充完整要求后可获得逐条分析。",
    requirements,
    strengths: strengths.length ? strengths : ["暂未从当前简历文字中找到明确对应的优势，请核对提取内容并补充项目成果。"],
    priorities: priorities.length ? priorities : ["根据岗位职责补充一个可展示的针对性作品，并量化现有项目成果。"],
    basis: `基于“${resumeVersion}”的实际简历文本进行匹配；简历中未明确写出的经历不会自动视为已具备。`,
    resumeVersion,
    recommendedResumeVersion,
    version: CURRENT_ANALYSIS_VERSION,
    analyzedAt: new Date().toISOString(),
  };
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

export function presentJob<T extends JobForAnalysis & { analysisJson?: string; matchScore?: number | null; matchLevel?: string; analyzedAt?: string | null; processRecordsJson?: string; prepChecklistJson?: string }>(job: T) {
  const normalizedJob = mergeParsedJob(job, job.rawText ? parseJobText(job.rawText) : {});
  let analysis: MatchAnalysis | null = null;
  if (job.analysisJson) {
    try { analysis = JSON.parse(job.analysisJson) as MatchAnalysis; } catch { analysis = null; }
  }
  if (!analysis || analysis.version !== CURRENT_ANALYSIS_VERSION) analysis = analyzeJob(normalizedJob);
  const storedChecklist = parseJsonArray(job.prepChecklistJson, sanitizePrepChecklist);
  const prepChecklist = storedChecklist.length ? storedChecklist : generatePrepChecklist(analysis);
  const processRecords = parseJsonArray(job.processRecordsJson, sanitizeProcessRecords);
  const { analysisJson: _analysisJson, processRecordsJson: _processRecordsJson, prepChecklistJson: _prepChecklistJson, ...safeJob } = normalizedJob;
  return { ...safeJob, matchScore: analysis.score, matchLevel: analysis.level, matchAnalysis: analysis, prepChecklist, processRecords };
}
