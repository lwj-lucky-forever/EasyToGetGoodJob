/** Extract only abilities supported by the selected job's duties or requirements. */
export const COMPETENCY_HEADINGS = ["重点考察能力", "重点考查能力", "重点考察", "考察能力", "核心能力", "关键能力", "重点能力", "能力素质", "胜任力", "能力项", "核心素质", "能力要求", "技能要求", "专业技能", "Key skills", "Core competencies", "Skills"];
export const COMPETENCY_SECTION = new RegExp(`^(?:${COMPETENCY_HEADINGS.join("|")})\\s*[:：]?\\s*(.*)$`, "i");

type JobContent = { responsibilities?: unknown; requirements?: unknown; competencies?: unknown };
const RULES = [
  { label: "用户研究与需求分析", pattern: /用户(?:研究|调研|访谈|需求)|需求(?:分析|调研|挖掘|梳理|收集|评估)|客户访谈|痛点分析|user research|user interviews?|requirements? analysis/i },
  { label: "产品设计与原型", pattern: /产品(?:设计|规划|方案|迭代|思维)|功能设计|原型|交互设计|需求文档|\b(?:PRD|Figma|Axure|Sketch)\b|product design|prototyp/i },
  { label: "数据处理与分析", pattern: /数据(?:分析|处理|清洗|挖掘|可视化)|分析.{0,8}数据|统计分析|指标体系|业务指标|\b(?:SQL|MySQL|Tableau|Power\s?BI|pandas)\b|A\/?B\s*(?:测试|实验)|data analy(?:sis|tics)/i },
  { label: "沟通与团队协作", pattern: /沟通|协调|跨部门|跨团队|团队协作|协作能力|合作能力|communication|collaboration|stakeholder/i },
  { label: "项目推进与交付", pattern: /项目(?:管理|推进|交付)|进度(?:管理|跟进)|推进.{0,10}(?:落地|上线)|按时交付|里程碑|project management|project delivery/i },
  { label: "逻辑思维与问题解决", pattern: /逻辑(?:思维|能力)|结构化(?:思维|分析)|独立思考|问题(?:分析|拆解|定位|解决)|解决.{0,10}问题|故障定位|problem.solving|critical thinking/i },
  { label: "内容策划与文字表达", pattern: /文案|撰写|写作|内容(?:策划|创作|生产|编辑)|文档(?:编写|编制)|文字表达|copywriting|content creation|technical writing/i },
  { label: "运营与增长", pattern: /运营|拉新|用户增长|增长策略|留存|转化率|活动策划|内容分发|用户触达|user acquisition|retention|growth strategy/i },
  { label: "业务理解与行业研究", pattern: /业务(?:理解|分析|洞察)|行业(?:研究|分析|认知)|竞品(?:分析|研究)|市场调研|商业模式|商业分析|market research|competitive analysis/i },
  { label: "编程与软件开发", pattern: /编程|编码|算法|数据结构|代码|(?:软件|系统|平台|前端|后端|服务端|客户端)(?:开发|工程)|开发.{0,8}(?:系统|平台|功能)|\b(?:Java|JavaScript|TypeScript|React|Vue|Go|Rust)\b|C\+\+|software development|programming/i },
  { label: "AI 与机器学习应用", pattern: /人工智能|大模型|机器学习|深度学习|提示词|生成式|\b(?:AI|LLM|RAG|Prompt|PyTorch|TensorFlow)\b/i },
  { label: "办公与效率工具", pattern: /办公软件|\b(?:Excel|PowerPoint|PPT|Office|Word)\b|透视表|办公自动化/i },
  { label: "英语与外语应用", pattern: /英语|英文|外语|雅思|托福|\b(?:English|IELTS|TOEFL|CET[- ]?[46])\b/i },
  { label: "学习与自驱", pattern: /学习能力|快速学习|主动学习|自驱|主动性|learning ability|quick learner|self.motivated/i },
  { label: "执行与责任意识", pattern: /执行力|执行能力|责任心|认真负责|抗压|结果导向|attention to detail|accountability/i },
] as const;

export function hasJobCompetencies(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && !/^(?:0|暂无|无|未识别|待识别|待确认|null|undefined|none|n\/a)$/i.test(value.trim());
}

function evidenceLines(value: unknown) {
  if (typeof value !== "string") return [];
  const lines: string[] = [];
  let excluded = false;
  for (const source of value.slice(0, 36_000).split(/\n/)) {
    let line = source.replace(/^\s*(?:[-•·]|\d+[、.)）])\s*/, "").trim();
    if (/^(?:公司介绍|团队介绍|关于我们|相关推荐|推荐职位|其他岗位|热门岗位|隐私政策|联系方式|网站导航|About us|Related jobs)\s*[:：]?/i.test(line)) { excluded = true; continue; }
    const heading = line.match(/^(?:岗位职责|工作职责|工作内容|任职要求|岗位要求|Responsibilities|Requirements)\s*[:：]?\s*(.*)$/i);
    if (heading) { excluded = false; line = heading[1]; }
    if (excluded || /^(?:登录|注册|Cookie|Copyright|用户协议|联系客服)/i.test(line)) continue;
    lines.push(...line.split(/[。；;!?！？]/).map((part) => part.replace(/\s+/g, " ").trim()).filter(Boolean));
  }
  return [...new Set(lines)];
}

function positiveMatch(line: string, pattern: RegExp) {
  return [...line.matchAll(new RegExp(pattern.source, "gi"))].some((match) => {
    const before = line.slice(Math.max(0, match.index! - 30), match.index).split(/[，,:：]/).at(-1) ?? "";
    const after = line.slice(match.index! + match[0].length);
    return !/(?:不要求|不需要|不涉及|不必|无须|无需|不用|不考察|不作要求|no need|not required)[^，,。；;]{0,16}$/i.test(before) && !/^\s*(?:(?:is|are)\s+)?(?:not required|无要求|非必需)/i.test(after);
  });
}

export function inferJobCompetencies(job: JobContent): string {
  const requirements = evidenceLines(job.requirements);
  const duties = evidenceLines(job.responsibilities);
  return RULES.map((rule, index) => {
    const required = requirements.filter((line) => positiveMatch(line, rule.pattern));
    const related = duties.filter((line) => positiveMatch(line, rule.pattern));
    return { label: rule.label, index, evidence: required[0] || related[0], score: Math.min(required.length, 4) * 3 + Math.min(related.length, 4) };
  }).filter((item) => item.evidence)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 8)
    .map((item) => `${item.label}：${item.evidence.length > 140 ? `${item.evidence.slice(0, 140)}…` : item.evidence}`)
    .join("\n");
}

export function fillJobCompetencies<T extends JobContent>(job: T): T {
  if (hasJobCompetencies(job.competencies)) return job;
  return { ...job, competencies: inferJobCompetencies(job) };
}
