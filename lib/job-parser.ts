import { inferKnownCompany, normalizeKnownCompany } from "./company-knowledge.mjs";
import { COMPETENCY_HEADINGS, COMPETENCY_SECTION, fillJobCompetencies } from "./job-competencies.ts";

export const JOB_NATURES = ["待确认", "日常实习", "暑期实习", "校招", "兼职", "其他"] as const;

export type JobNature = (typeof JOB_NATURES)[number];

export type ParsedJobFields = {
  company: string;
  role: string;
  location: string;
  nature: string;
  responsibilities: string;
  requirements: string;
  competencies: string;
  sourceUrl: string;
  applicationDeadline: string;
  rawText: string;
};

type ParsedTextKey = Exclude<keyof ParsedJobFields, "rawText">;
type ContentKey = "responsibilities" | "requirements" | "competencies";

const FIELD_MATCHERS: Array<[ParsedTextKey, RegExp]> = [
  ["company", /^(?:公司|企业|单位|公司名称|企业名称|招聘主体|组织名称)\s*[：:]\s*(.+)$/i],
  ["role", /^(?:岗位|职位|岗位名称|职位名称|招聘岗位|实习岗位|应聘职位|job\s*title)\s*[：:]\s*(.+)$/i],
  ["location", /^(?:工作地点|办公地点|工作城市|办公地址|所在城市|工作区域|地点|地址|location)\s*[：:]\s*(.+)$/i],
  ["nature", /^(?:岗位性质|职位性质|实习性质|招聘性质|用工性质|职位类型|岗位类型|招聘类型|性质)\s*[：:]\s*(.+)$/i],
  ["applicationDeadline", /^(?:投递|申请|报名|招聘)?\s*(?:截止日期|截止时间|截止至|截止到|截至)\s*[：:]?\s*(.+)$/i],
  ["sourceUrl", /^(?:投递链接|岗位链接|招聘链接|申请链接|网申链接|详情链接|链接)\s*[：:]\s*(.+)$/i],
];

const SECTION_MATCHERS: Array<[ContentKey, RegExp]> = [
  ["responsibilities", /^(?:工作内容|岗位职责|职位职责|工作职责|职位描述|岗位描述|工作描述|职责描述|岗位内容|主要职责|你的工作|你将负责|你会负责|你需要做|你将做什么|what\s+you(?:'|’)ll\s+do|responsibilit(?:y|ies))\s*[：:]?\s*(.*)$/i],
  ["requirements", /^(?:岗位基本要求|职位基本要求|基本任职要求|基本要求|岗位要求|任职要求|职位要求|招聘要求|应聘要求|任职资格|任职条件|岗位条件|招聘条件|资格要求|基本条件|我们希望你|我们期待你|希望你具备|你需要具备|你应当具备|优先条件|加分项|加分条件|qualifications?|requirements?|what\s+we(?:'|’)re\s+looking\s+for)\s*[：:]?\s*(.*)$/i],
  ["competencies", COMPETENCY_SECTION],
];

const STOP_SECTION = /^(?:岗位亮点|职位亮点|薪资待遇|薪资范围|福利待遇|员工福利|公司介绍|团队介绍|关于我们|投递方式|申请方式|联系方式|招聘流程|其他说明|温馨提示|工作时间|发布日期|发布时间|更新时间|创建时间|职位编号|岗位编号|职位ID|岗位ID|职位类别|岗位类别|招聘人数|工作经验|学历要求|所属部门|所属团队|招聘对象|招聘批次|信息来源)\s*[：:]?\s*/i;

const METADATA_HEADING_WORDS = [
  "发布日期", "发布时间", "更新时间", "创建时间", "投递截止日期", "投递截止时间", "申请截止日期", "申请截止时间",
  "截止日期", "截止时间", "职位性质", "岗位性质", "实习性质", "招聘性质", "用工性质", "职位类型", "岗位类型", "招聘类型",
  "职位类别", "岗位类别", "招聘人数", "工作经验", "学历要求", "所属部门", "所属团队", "招聘对象", "招聘批次",
  "薪资待遇", "薪资范围", "工作地点", "办公地点", "工作城市", "职位编号", "岗位编号", "职位ID", "岗位ID", "投递链接", "招聘链接",
] as const;

const METADATA_HEADINGS = /^((?:岗位信息|职位信息|招聘信息|发布日期|发布时间|更新时间|职位性质|岗位性质|实习性质|招聘性质|职位类型|岗位类型|招聘类型|所属部门|招聘部门|事业群|业务线|职位类别|岗位类别|工作地点|办公地点|工作城市|职位编号|岗位编号|招聘人数|薪资范围|薪资待遇|学历要求|专业要求|经验要求|语言要求))\s*[：:]?\s*(.*)$/i;
const IGNORED_METADATA_HEADINGS = /^(?:岗位信息|职位信息|招聘信息|发布日期|发布时间|更新时间|所属部门|招聘部门|事业群|业务线|职位类别|岗位类别|职位编号|岗位编号|招聘人数|薪资范围|薪资待遇)$/i;
const REQUIREMENT_METADATA_HEADINGS = /^(?:学历要求|专业要求|经验要求|语言要求)$/i;
const NATURE_METADATA_HEADINGS = /^(?:职位性质|岗位性质|实习性质|招聘性质|职位类型|岗位类型|招聘类型)$/i;
const LOCATION_METADATA_HEADINGS = /^(?:工作地点|办公地点|工作城市)$/i;

const REQUIREMENT_CUES = /(?:要求|需要|具备|熟悉|熟练|能够|善于|擅长|优先|本科|硕士|研究生|学历|专业|经验|能力|责任心|自驱|主动|抗压|每周.{0,5}[天日]|实习.{0,8}(?:月|天)|连续实习|到岗|毕业|英语|英文|Excel|SQL|Python|Office|沟通|协作|逻辑|思维|学习能力)/i;
const RESPONSIBILITY_CUES = /^(?:负责|参与|协助|支持|跟进|推动|推进|输出|制定|搭建|调研|分析|维护|运营|完成|承接|配合|整理|设计|策划|监控|优化)/;

function cleanLine(line: string) {
  return line
    .replace(/^\s*(?:[-–—•·▪◦]|\d+[.、)）]|[（(]?\d+[）)])\s*/, "")
    .replace(/^\s*[【\[〖「『]\s*/, "")
    .replace(/\s*[】\]〗」』]\s*$/, "")
    .replace(/[\t\u00a0]+/g, " ")
    .trim();
}

function prepareText(rawText: string) {
  const headingWords = [
    "工作内容", "岗位职责", "职位职责", "工作职责", "职位描述", "岗位描述", "工作描述", "主要职责",
    "岗位基本要求", "职位基本要求", "基本任职要求", "基本要求", "岗位要求", "任职要求", "职位要求", "招聘要求",
    "任职资格", "任职条件", "岗位条件", "资格要求", "基本条件", "加分项", "优先条件", ...COMPETENCY_HEADINGS,
    "工作地点", "办公地点", "工作城市", ...METADATA_HEADING_WORDS,
    "岗位信息", "职位信息", "招聘信息", "发布日期", "发布时间", "更新时间", "所属部门", "招聘部门", "事业群", "业务线",
    "职位类别", "岗位类别", "职位编号", "岗位编号", "招聘人数", "薪资范围", "学历要求", "专业要求", "经验要求", "语言要求",
  ].join("|");
  const sectionWords = [
    "工作内容", "岗位职责", "职位职责", "工作职责", "职位描述", "岗位描述", "工作描述", "主要职责",
    "岗位基本要求", "职位基本要求", "基本任职要求", "基本要求", "岗位要求", "任职要求", "职位要求", "招聘要求",
    "任职资格", "任职条件", "岗位条件", "资格要求", "基本条件", "加分项", "优先条件", ...COMPETENCY_HEADINGS,
  ].join("|");
  return rawText
    .replace(/\r/g, "")
    .replace(/[\u00a0\u2007\u202f]/g, " ")
    .replace(new RegExp(`\\s+(?=(?:【|\\[)(?:${headingWords})(?:】|\\]))`, "gi"), "\n")
    .replace(new RegExp(`\\s+(?=(?:【|\\[)?(?:${headingWords})(?:】|\\])?\\s*[：:])`, "gi"), "\n")
    .replace(new RegExp(`([^\\n])(?=(?:【|\\[)?(?:${METADATA_HEADING_WORDS.join("|")})(?:】|\\])?\\s*[：:])`, "gi"), "$1\n")
    .replace(new RegExp(`\\s{2,}(?=(?:【|\\[)?(?:${METADATA_HEADING_WORDS.join("|")})(?:】|\\])?(?:\\s|[：:]|$))`, "gi"), "\n")
    .replace(new RegExp(`\\s{2,}(?=(?:【|\\[)?(?:${headingWords})(?:】|\\])?(?:\\s|$))`, "gi"), "\n")
    .replace(new RegExp(`\\s{2,}(?=(?:【|\\[)?(?:${sectionWords})(?:】|\\])?(?:\\s|$))`, "gi"), "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeNature(value: string, fullText: string): JobNature | "" {
  const source = `${value}\n${fullText}`;
  if (/暑期实习|暑期项目|暑期生|summer\s+intern(?:ship)?/i.test(source)) return "暑期实习";
  if (/兼职|part[\s-]?time/i.test(source)) return "兼职";
  if (/(?:日常|长期|滚动|常规)实习|日常实习生|^实习$/im.test(source)) return "日常实习";
  if (/校招|校园招聘|应届(?:生|毕业生)|毕业生项目|graduate\s+program|正式岗位|全职岗位/i.test(source) && !/实习|intern/i.test(source)) return "校招";
  if (/实习生|实习岗位|intern(?:ship)?|每周\s*(?:至少)?\s*[3-6三四五六]\s*[天日]|(?:连续|至少|不少于|可)实习.{0,8}(?:月|天)|尽快到岗|可到岗/i.test(source)) return "日常实习";
  if (/其他/.test(value)) return "其他";
  return "";
}

function splitSemanticLines(text: string) {
  return text
    .replace(/\s+(?=(?:\d+[.、)）]|[（(]\d+[）)]))/g, "\n")
    .split(/\n+/)
    .map(cleanLine)
    .flatMap((line) => line.length > 160 ? line.split(/[；;]/).map(cleanLine) : [line])
    .filter((line) => line.length >= 4 && line.length <= 500);
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.replace(/[\s，。；;、]/g, "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferCompanyAndRole(lines: string[], result: Partial<ParsedJobFields>, sourceUrl = "") {
  const usefulLines = lines.map(cleanLine).filter(Boolean);
  if (!result.company || !result.role) {
    for (const line of usefulLines.slice(0, 8)) {
      const pair = line.match(/^(.{2,24}?)[\s｜|·—-]+(.{2,42}(?:实习生|产品经理|运营|分析师|工程师|设计师|助理|专员).*)$/i);
      if (pair) {
        if (!result.company) result.company = normalizeKnownCompany(pair[1]);
        if (!result.role) result.role = pair[2].trim();
        break;
      }
    }
  }
  if (!result.company) result.company = inferKnownCompany(usefulLines.slice(0, 30).join("\n"), sourceUrl) || undefined;
  if (!result.company) {
    const companyLine = usefulLines.slice(0, 8).find((line) => /(?:招聘|诚聘|校园招聘)$/.test(line) && line.length <= 32);
    if (companyLine && !/^\d{4}届?(?:校园)?招聘$/.test(companyLine)) result.company = normalizeKnownCompany(companyLine);
  }
  if (!result.role) {
    const roleLine = usefulLines.slice(0, 12).find((line) =>
      line.length <= 60 &&
      /(?:实习生|产品经理|产品运营|用户运营|内容运营|策略运营|数据分析师|项目助理|设计师|工程师)/i.test(line) &&
      !/(?:岗位要求|工作内容|岗位职责|招聘要求)/.test(line),
    );
    if (roleLine) result.role = roleLine.replace(/^(?:招聘岗位|实习岗位|岗位|职位)\s*[：:]?\s*/, "").trim();
  }
}

function inferLocation(text: string) {
  const contextual = text.match(/(?:工作|办公|base|坐标|岗位)\s*(?:地点|地址|城市|地)?\s*(?:在|位于|为|：|:)?\s*((?:北京|上海|广州|深圳|杭州|成都|南京|武汉|西安|苏州|天津|重庆|长沙|厦门|青岛)(?:市)?(?:[·\s·-]*(?:朝阳|海淀|东城|西城|丰台|浦东|徐汇|闵行|南山|福田|余杭|滨江|高新)[区]?)?)/i);
  return contextual?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

export function parseJobText(rawText: unknown): Partial<ParsedJobFields> {
  const source = typeof rawText === "string" ? rawText.replace(/\u0000/g, "").slice(0, 50_000) : "";
  const text = prepareText(source);
  if (!text) return {};

  const result: Partial<ParsedJobFields> = { rawText: text };
  const buckets: Record<ContentKey, string[]> = { responsibilities: [], requirements: [], competencies: [] };
  let activeSection: ContentKey | null = null;
  let pendingMetadata: "nature" | "location" | "requirement" | "ignore" | null = null;
  let pendingRequirementHeading = "";
  const lines = text.split("\n");

  for (const originalLine of lines) {
    const line = cleanLine(originalLine);
    if (!line) continue;

    if (pendingMetadata) {
      if (!METADATA_HEADINGS.test(line) && !SECTION_MATCHERS.some(([, matcher]) => matcher.test(line))) {
        if (pendingMetadata === "nature") result.nature = line;
        else if (pendingMetadata === "location") result.location = line;
        else if (pendingMetadata === "requirement") buckets.requirements.push(`${pendingRequirementHeading || "要求"}：${line}`);
        pendingMetadata = null;
        pendingRequirementHeading = "";
        continue;
      }
      pendingMetadata = null;
      pendingRequirementHeading = "";
    }

    const fieldMatch = FIELD_MATCHERS.find(([, matcher]) => matcher.test(line));
    if (fieldMatch) {
      const [key, matcher] = fieldMatch;
      const value = line.match(matcher)?.[1]?.trim() ?? "";
      if (value) result[key] = (key === "company" ? normalizeKnownCompany(value) : value) as never;
      activeSection = null;
      continue;
    }

    const metadataMatch = line.match(METADATA_HEADINGS);
    if (metadataMatch) {
      const heading = metadataMatch[1]?.trim() ?? "";
      const inlineValue = metadataMatch[2]?.trim() ?? "";
      activeSection = null;
      if (NATURE_METADATA_HEADINGS.test(heading)) {
        if (inlineValue) result.nature = inlineValue;
        else pendingMetadata = "nature";
      } else if (LOCATION_METADATA_HEADINGS.test(heading)) {
        if (inlineValue) result.location = inlineValue;
        else pendingMetadata = "location";
      } else if (REQUIREMENT_METADATA_HEADINGS.test(heading)) {
        if (inlineValue) buckets.requirements.push(`${heading}：${inlineValue}`);
        else { pendingMetadata = "requirement"; pendingRequirementHeading = heading; }
      } else if (IGNORED_METADATA_HEADINGS.test(heading)) {
        pendingMetadata = inlineValue ? null : "ignore";
      }
      continue;
    }

    const sectionMatch = SECTION_MATCHERS.find(([, matcher]) => matcher.test(line));
    if (sectionMatch) {
      const [key, matcher] = sectionMatch;
      activeSection = key;
      const firstLine = line.match(matcher)?.[1]?.trim();
      if (firstLine) buckets[key].push(cleanLine(firstLine));
      continue;
    }

    if (STOP_SECTION.test(line)) {
      activeSection = null;
      continue;
    }
    if (activeSection) buckets[activeSection].push(line);
  }

  for (const key of Object.keys(buckets) as ContentKey[]) {
    const content = uniqueLines(buckets[key]).join("\n");
    if (content) result[key] = content;
  }

  const semanticLines = splitSemanticLines(text).filter((line) =>
    !FIELD_MATCHERS.some(([, matcher]) => matcher.test(line)) &&
    !SECTION_MATCHERS.some(([, matcher]) => matcher.test(line)) &&
    !STOP_SECTION.test(line),
  );
  if (!result.requirements) {
    const inferred = uniqueLines(semanticLines.filter((line) => REQUIREMENT_CUES.test(line) && !RESPONSIBILITY_CUES.test(line)));
    if (inferred.length) result.requirements = inferred.slice(0, 24).join("\n");
  }
  if (!result.responsibilities) {
    const inferred = uniqueLines(semanticLines.filter((line) => RESPONSIBILITY_CUES.test(line) && !REQUIREMENT_CUES.test(line)));
    if (inferred.length) result.responsibilities = inferred.slice(0, 20).join("\n");
  }

  if (!result.sourceUrl) result.sourceUrl = text.match(/https?:\/\/[^\s，。；;】\]]+/i)?.[0];
  if (result.company) result.company = normalizeKnownCompany(result.company);
  inferCompanyAndRole(lines, result, result.sourceUrl ?? "");
  if (!result.location) result.location = inferLocation(text) || undefined;
  const nature = normalizeNature(result.nature ?? "", `${result.role ?? ""}\n${text}`);
  if (nature) result.nature = nature;
  else delete result.nature;

  return fillJobCompetencies(result);
}

export function mergeParsedJob<T extends Partial<ParsedJobFields>>(draft: T, parsed: Partial<ParsedJobFields>): T {
  const next = { ...draft } as T;
  for (const key of ["company", "role", "location", "responsibilities", "requirements", "competencies", "sourceUrl", "applicationDeadline"] as const) {
    if (!String(next[key] ?? "").trim() && parsed[key]) next[key] = parsed[key] as T[typeof key];
  }
  if ((!next.nature || next.nature === "待确认") && parsed.nature) next.nature = parsed.nature as T["nature"];
  return fillJobCompetencies(next);
}
