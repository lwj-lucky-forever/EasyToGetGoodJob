import { parse, parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import { COMPETENCY_SECTION } from "./job-competencies.ts";
import { parseJobText } from "./job-parser.ts";
import { normalizeImportedJob, type ImportedJob, type WebJobDetails } from "./job-import.ts";
import { inferKnownCompany, normalizeKnownCompany } from "./company-knowledge.mjs";
import { identifyJobSite } from "./job-web-sites.ts";

type Node = DefaultTreeAdapterTypes.Node;
export type JobRecord = Record<string, unknown>;
export type ExtractedWebJob = { parsed: ImportedJob; extractionMethod: string; warnings: string[] };
export const isListingTitle = (title: string) => /^(?:职位列表|岗位列表|招聘首页|加入我们|职位搜索|招聘职位|人才招聘|Careers|Job openings|Open positions|Search results|Job search)\s*$/i.test(title.trim());
export const asRecord = (value: unknown): JobRecord | null => value && typeof value === "object" && !Array.isArray(value) ? value as JobRecord : null;
const children = (node: Node): Node[] => "childNodes" in node ? node.childNodes : [];
const tag = (node: Node) => "tagName" in node ? node.tagName : "";
const attr = (node: Node, name: string) => "attrs" in node ? node.attrs.find((item) => item.name === name)?.value ?? "" : "";
function nodes(root: Node): Node[] {
  const output: Node[] = [];
  const queue = [root];
  while (queue.length && output.length < 35_000) {
    const node = queue.pop()!;
    output.push(node);
    queue.push(...children(node).slice().reverse());
  }
  return output;
}
const NOISE = /(?:^|[\s_-])(?:nav|menu|footer|sidebar|recommend(?:ed|ation)?|related|cookie|privacy|login|signin|signup|company-intro|team-intro|apply-button|social-links|customer-service)(?:$|[\s_-])/i;
const NOISE_LINE = /^(?:登录|注册|立即登录|立即申请|申请职位|投递简历|收藏职位|分享职位|返回列表|职位推荐|推荐职位|相关职位|其他职位|更多职位|热门职位|你可能还喜欢|隐私政策|隐私声明|用户协议|Cookie设置|联系我们|联系客服|关注我们|关于我们|版权所有|Copyright\b|Apply now$|Sign in$|Register$|Privacy policy\b|Terms of use\b|Follow us\b)/i;
function excluded(node: Node) {
  return /^(?:script|style|svg|noscript|template|nav|footer|aside|button|form)$/.test(tag(node)) ||
    ["navigation", "contentinfo", "menu", "dialog"].includes(attr(node, "role")) ||
    attr(node, "aria-hidden") === "true" || ("attrs" in node && node.attrs.some((a) => a.name === "hidden")) ||
    NOISE.test(`${attr(node, "id")} ${attr(node, "class")}`);
}
function nodeText(node: Node, clean = true): string {
  if (clean && excluded(node)) return "";
  if ("value" in node && node.nodeName === "#text") return node.value;
  const text = children(node).map((child) => nodeText(child, clean)).join("");
  return /^(?:br|p|div|li|section|article|h[1-6]|tr|dt|dd|td|th)$/.test(tag(node)) ? `${text}\n` : text;
}
const tidy = (text: string) => text.replace(/\u0000/g, "").replace(/\r/g, "").replace(/[\t\u00a0 ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
export const htmlJobText = (html: string) => tidy(nodeText(parseFragment(html)));
export function field(record: JobRecord, aliases: string[]) {
  for (const name of aliases) {
    const key = Object.keys(record).find((key) => key.toLowerCase() === name.toLowerCase());
    if (key && record[key] != null && record[key] !== "") return record[key];
  }
  return undefined;
}
export function valueText(value: unknown, depth = 0): string {
  if (value == null || depth > 5) return "";
  if (typeof value === "string") return htmlJobText(value);
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return [...new Set(value.map((v) => valueText(v, depth + 1)).filter(Boolean))].join("、");
  const row = asRecord(value);
  return row ? valueText(field(row, ["name", "zh_cn", "label", "value", "description", "cityName", "addressLocality"]), depth + 1) : "";
}
const textField = (row: JobRecord, keys: string[]) => valueText(field(row, keys));

function location(value: unknown): string {
  if (Array.isArray(value)) return [...new Set(value.map(location).filter(Boolean))].join("、");
  const row = asRecord(value);
  if (!row) return valueText(value);
  const address = asRecord(row.address) ?? row;
  const parts = ["addressCountry", "addressRegion", "addressLocality", "streetAddress"].map((key) => valueText(address[key])).filter(Boolean);
  return parts.length ? [...new Set(parts)].join(" · ") : valueText(row);
}
function dateText(value: unknown) {
  if (typeof value === "number" || (typeof value === "string" && /^\d{10,13}$/.test(value))) {
    const num = Number(value);
    const date = new Date(num < 1e12 ? num * 1000 : num);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  return valueText(value);
}

export function cleanJobContent(text: string) {
  const lines = text.split("\n");
  const output: string[] = [];
  let introduction = false;
  for (const line of lines) {
    const value = line.trim();
    if (/^(?:推荐职位|相关职位|其他职位|热门岗位|你可能还喜欢|You may also like|Related jobs|Recommended jobs|隐私政策|用户协议|Copyright\b)/i.test(value)) break;
    if (/^(?:团队介绍|公司介绍|品牌介绍|关于我们|About (?:us|the team|the company)|Team introduction)\s*[:：]?\s*$/i.test(value) || /^(?:团队介绍|公司介绍|品牌介绍|关于我们|About us|Team introduction)\s*[:：]/i.test(value)) { introduction = true; continue; }
    if (/^(?:岗位职责|职位职责|工作职责|工作内容|职位描述|岗位要求|职位要求|任职要求|任职资格|Responsibilities|Qualifications|Requirements)\s*[:：]?/i.test(value) ||
      /^\s*(?:(?:\d+[、.)）]|[-•])\s*)?(?:负责|参与|协助|设计|推动|跟踪|开发|维护|分析|You will|Develop|Build|Design)/i.test(value) ||
      /^(?:日常实习|暑期实习|实习说明|实习时长|每周出勤|招聘对象|薪资待遇|薪资范围)\s*[:：]/.test(value)) introduction = false;
    if (!introduction && !NOISE_LINE.test(value)) output.push(line);
  }
  return tidy(output.join("\n"));
}

/** Web-only normalization: keep the paste-JD parser's behavior unchanged. */
export function splitWebJobSections(description: string, requirements = "") {
  const text = cleanJobContent(description).replace(/(^|\n)\s*(职责要求|工作要求|能力要求)\s*[:：]?/g, "$1任职要求：");
  const parsed = parseJobText(text);
  const competencies = text.split("\n").some((line) => COMPETENCY_SECTION.test(line.trim())) ? parsed.competencies || "" : "";
  const headed = /(?:^|\n)\s*(?:岗位职责|职位职责|工作职责|工作内容|职位描述|岗位要求|职位要求|任职要求|任职资格|Responsibilities|Qualifications|Requirements)\s*[:：]?/im.test(text);
  const metadataLine = /^(?:日常实习|暑期实习|薪资|薪资待遇|薪资范围|实习时长|每周出勤|招聘对象|发布时间|发布日期|截止日期|截止时间|Salary)\s*[:：]/i;
  const explicit = cleanJobContent(requirements);
  if (explicit && !headed) return { responsibilities: tidy(text.split("\n").filter((line) => !metadataLine.test(line)).join("\n")), requirements: explicit, competencies };
  let duties = headed ? parsed.responsibilities || "" : "";
  let inferredRequirements = headed ? parsed.requirements || "" : "";
  if (!headed) {
    const dutyLines: string[] = [], requirementLines: string[] = [];
    for (const line of text.split("\n")) {
      const value = line.replace(/^\s*(?:\d+[、.)）]|[-•])\s*/, "");
      if (/^(?:负责|参与|协助|推动|开发|设计|维护|分析|跟踪|You will|Responsible for|Develop|Build|Design|Own\b)/i.test(value)) dutyLines.push(line);
      else if (/(?:学历|相关专业|实习期|每周.{0,15}[天日]|至少.{0,6}[个月年]|工作经验|熟悉|熟练|具备|bachelor|master.?s|years? of experience|must have|you have)/i.test(value)) requirementLines.push(line);
      else if (!metadataLine.test(value)) dutyLines.push(line);
    }
    duties = dutyLines.join("\n");
    inferredRequirements = requirementLines.join("\n");
  }
  return { responsibilities: tidy(duties), requirements: [...new Set([inferredRequirements, explicit].filter(Boolean))].join("\n"), competencies };
}

function salaryText(value: unknown): string {
  if (Array.isArray(value)) return value.map(salaryText).filter(Boolean).join("、");
  const row = asRecord(value);
  if (!row) return valueText(value);
  const amount = asRecord(row.value) ?? row;
  const min = valueText(amount.minValue), max = valueText(amount.maxValue);
  const range = min || max ? [min, max].filter(Boolean).join("–") : valueText(amount.value);
  return [valueText(row.currency), range, valueText(amount.unitText)].filter(Boolean).join(" ") || valueText(row);
}

export function jobRecordId(row: JobRecord) {
  return textField(row, ["postId", "id", "jobUnionId", "positionId", "jobId", "identifier"]);
}
const TITLE = ["title", "jobTitle", "jobName", "positionName", "postName", "name"];
const DUTIES = ["responsibilities", "jobDuty", "jobResponsibilities", "workContent", "jobDescription", "description", "jobContent", "content"];
const REQUIREMENTS = ["qualifications", "jobRequirement", "jobRequirements", "requirement", "requirements", "serviceCondition", "qualification"];
export function recordHasJob(row: JobRecord) {
  const types = Array.isArray(row["@type"]) ? row["@type"] : row["@type"] ? [row["@type"]] : [];
  if (types.length && !types.includes("JobPosting")) return false;
  const evidence = types.includes("JobPosting") || Boolean(jobRecordId(row)) ||
    Boolean(field(row, ["jobTitle", "jobName", "positionName", "workContent", "jobDuty", "responsibilities", "requirement", "requirements", "serviceCondition", "jobLocation", "employmentType"]));
  return Boolean(evidence && textField(row, TITLE) && (textField(row, DUTIES).length >= 20 || textField(row, REQUIREMENTS).length >= 20));
}

/** Select one detail object. Never flatten an entire hydration store or job list. */
export function selectJobRecord(payload: unknown, expectedId = "", schemaOnly = false, sourceUrl = ""): JobRecord | null {
  const candidates: JobRecord[] = [];
  let visited = 0;
  function visit(value: unknown, depth: number) {
    if (++visited > 12_000 || depth > 18 || !value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const item of value.slice(0, 200)) visit(item, depth + 1); return; }
    const row = value as JobRecord;
    const types = Array.isArray(row["@type"]) ? row["@type"] : [row["@type"]];
    if ((!schemaOnly || types.includes("JobPosting")) && recordHasJob(row)) candidates.push(row);
    for (const child of Object.values(row)) if (child && typeof child === "object") visit(child, depth + 1);
  }
  visit(payload, 0);
  if (expectedId) {
    const exact = candidates.filter((row) => jobRecordId(row) === expectedId || textField(row, ["url", "mainEntityOfPage"]).includes(expectedId));
    if (exact.length === 1) return exact[0];
    // A detail's explicit different ID is never a safe fallback (recommendations).
    const unidentified = candidates.filter((row) => !jobRecordId(row));
    if (candidates.length === 1 && unidentified.length === 1) return candidates[0];
    return null;
  }
  if (sourceUrl) {
    const exact = candidates.filter((row) => textField(row, ["url"]).replace(/#.*$/, "") === sourceUrl.replace(/#.*$/, ""));
    if (exact.length === 1) return exact[0];
  }
  return candidates.length === 1 ? candidates[0] : null;
}

export function expectedJobId(url: URL) {
  return url.pathname.match(/\/(?:position|detail|view)\/(?:INTERN\/|SOCIAL\/|GRADUATE\/)?([\da-z-]{4,100})(?:\/detail)?\/?$/i)?.[1] ||
    url.hash.match(/\/job\/([\da-z-]{4,100})/i)?.[1] ||
    ["jobId", "jobUnionId", "positionId", "postId"].map((key) => url.searchParams.get(key)).find(Boolean) || "";
}

export function recordToJob(row: JobRecord, sourceUrl: string, method: string, defaults: { company?: string; recruitmentType?: string } = {}): ExtractedWebJob {
  const role = textField(row, TITLE);
  const site = identifyJobSite(new URL(sourceUrl));
  const namedCompany = textField(row, ["hiringOrganization", "companyName", "company", "employer"]);
  const structuredCompany = /^(?:Moka|Moka 招聘平台|飞书招聘|北森|北森招聘)$/i.test(namedCompany) ? "" : normalizeKnownCompany(namedCompany);
  const company = site.company || structuredCompany || defaults.company || inferKnownCompany(role, "");
  const description = cleanJobContent(textField(row, DUTIES));
  const requirement = cleanJobContent(textField(row, REQUIREMENTS));
  const sections = splitWebJobSections(description, requirement);
  const competencies = cleanJobContent(textField(row, ["competencies", "keyCompetencies", "keySkills", "skillRequirements", "skills"])) || sections.competencies;
  const employmentType = textField(row, ["employmentType", "commitment"]);
  const recruitmentType = textField(row, ["recruit_type", "recruitTypeName", "recruitType", "recruitmentType", "jobTypeName"]) || defaults.recruitmentType || "";
  const scopedText = `${description}\n${requirement}`;
  const labelValue = (labels: string) => scopedText.match(new RegExp(`^(?:${labels})\\s*[:：]\\s*(.+)$`, "im"))?.[1]?.trim() || "";
  const requirementLines = sections.requirements.split("\n");
  const details: WebJobDetails = {
    employmentType, recruitmentType,
    datePosted: dateText(field(row, ["datePosted", "publish_time", "publishDate", "publishedAt", "publishTime"])) || labelValue("发布时间|发布日期"),
    education: textField(row, ["educationRequirements", "educationRequirement", "education", "degree"]),
    major: textField(row, ["majorRequirements", "majorRequirement", "major", "target_major_list"]),
    experience: textField(row, ["experienceRequirements", "workYears", "experience", "workExperience"]),
    internshipDuration: textField(row, ["internshipDuration", "internDuration"]) || requirementLines.filter((line) => /实习.{0,30}(?:个月|[月周])/.test(line)).join("\n"),
    weeklyAttendance: textField(row, ["weeklyAttendance", "daysPerWeek"]) || requirementLines.filter((line) => /每周.{0,20}[天日]/.test(line)).join("\n"),
    salary: salaryText(field(row, ["baseSalary", "salary", "salaryRange", "salaryDescription"])) || labelValue("薪资|薪资待遇|薪资范围|Salary"),
    department: textField(row, ["departmentName", "department", "bgShortName", "organizationName"]),
    otherInformation: [cleanJobContent(textField(row, ["jobHighlights", "jobHighlight", "highlights", "preferred", "jobPreferred"])), ...description.split("\n").filter((line) => /^(?:日常实习|暑期实习|实习说明|招聘对象)\s*[:：]/.test(line))].filter(Boolean).join("\n"),
  };
  details.education ||= sections.requirements.match(/(?:大专|本科|硕士|博士|研究生)(?:及以上|以上)?(?:学历|在读)?/u)?.[0] ?? "";
  details.major ||= sections.requirements.split(/[；;。\n]/).find((line) => /专业/.test(line))?.replace(/^\s*\d+[、.)）]\s*/, "").replace(/^.*?(?:学历|在读)[，,]\s*/, "").trim() ?? "";
  details.experience ||= requirementLines.filter((line) => /(?:工作|实习|相关).{0,12}经验|每周.{0,15}[天日]|实习(?:期|时长)|(?:连续|至少|不少于|低于).{0,12}[个月天]/.test(line)).join("\n");
  const extraRequirements = [details.education, details.major, details.experience, details.internshipDuration, details.weeklyAttendance, textField(row, ["skills"])].filter((item): item is string => Boolean(item) && !sections.requirements.includes(item!));
  const requirements = [...new Set([sections.requirements, ...extraRequirements])].filter(Boolean).join("\n");
  const jobLocation = location(field(row, ["jobLocation", "city_list", "locations", "cityList", "city_info", "workPlace", "workLocation", "location", "cityName", "jobCity"]));
  const deadline = dateText(field(row, ["validThrough", "applicationDeadline", "deadline", "expiredTime", "closedAt", "closeTime"])) || labelValue("投递截止日期|截止日期|截止时间");
  const blocks = [company && `公司：${company}`, `岗位：${role}`, jobLocation && `工作地点：${jobLocation}`,
    recruitmentType && `招聘类型：${recruitmentType}`, employmentType && `用工形式：${employmentType}`,
    details.datePosted && `发布时间：${details.datePosted}`, deadline && `投递截止日期：${deadline}`,
    details.salary && `薪资待遇：${details.salary}`, details.department && `所属部门：${details.department}`,
    sections.responsibilities && `岗位职责：\n${sections.responsibilities}`, requirements && `任职要求：\n${requirements}`,
    competencies && `重点考察能力：\n${competencies}`,
    details.otherInformation && `岗位补充信息：${details.otherInformation}`].filter(Boolean);
  const text = blocks.join("\n").slice(0, 50_000);
  const parsedText = parseJobText(text);
  const natureText = `${recruitmentType}\n${textField(row, ["job_subject", "jobType"])}\n${role}`;
  const nature = /暑期|summer.?intern/i.test(natureText) ? "暑期实习" : /实习|intern/i.test(natureText + employmentType) ? "日常实习" : /兼职|part.?time/i.test(employmentType) ? "兼职" : /校招|校园|graduate/i.test(recruitmentType) ? "校招" : /社招|社会招聘|society|experienced|social/i.test(recruitmentType) ? "其他" : "待确认";
  const parsed = normalizeImportedJob({ ...parsedText, company, role, location: jobLocation || parsedText.location, nature,
    responsibilities: sections.responsibilities, requirements, competencies, sourceUrl, rawText: text, applicationDeadline: deadline, webDetails: details });
  const warnings = site.company && structuredCompany && site.company !== structuredCompany ? [`站点属于${site.company}，页面招聘主体为${structuredCompany}，请核对公司。`] : [];
  return { parsed, extractionMethod: method, warnings };
}

/** Read a JSON literal from a known hydration assignment, never eval remote JS. */
function assignmentJson(script: string): unknown {
  const assignment = /(?:window\.)?(?:__INITIAL_DATA__|__INITIAL_STATE__|__PRELOADED_STATE__|__NEXT_DATA__|__NUXT__)\s*=\s*/g;
  const match = assignment.exec(script);
  if (!match) return null;
  const start = match.index + match[0].length;
  if (!/[{[]/.test(script[start] ?? "")) return null;
  let depth = 0, quoted = false, escaped = false;
  let literal = "";
  for (let i = start; i < script.length; i++) {
    const char = script[i];
    if (quoted) {
      literal += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    // Baidu serializes undefined alongside valid JSON. Replace only bare values.
    if (!quoted && script.startsWith("undefined", i) && /[:[,\s]/.test(script[i - 1]) && /[,}\]\s]/.test(script[i + 9] ?? "")) {
      literal += "null"; i += 8; continue;
    }
    literal += char;
    if (char === "{" || char === "[") depth++;
    if (char === "}" || char === "]") { if (--depth === 0) { try { return JSON.parse(literal); } catch { return null; } } }
  }
  return null;
}

function scriptPayloads(html: string, schemaOnly: boolean) {
  const scripts = nodes(parse(html)).filter((node) => tag(node) === "script");
  const payloads: unknown[] = [];
  for (const script of scripts) {
    const type = attr(script, "type").split(";")[0].trim().toLowerCase();
    if ((type === "application/ld+json") !== schemaOnly) continue;
    const raw = nodeText(script, false);
    try { payloads.push(/^(?:application\/(?:ld\+)?json|text\/json)$/.test(type) ? JSON.parse(raw) : assignmentJson(raw)); }
    catch { /* Invalid JSON is not executable job data. */ }
  }
  return payloads;
}

export const embeddedJobPayloads = (html: string) => scriptPayloads(html, false);

export function extractStructuredJob(html: string, sourceUrl: string, mode: "all" | "jsonld" | "embedded" = "all"): ExtractedWebJob | null {
  for (const schemaOnly of mode === "jsonld" ? [true] : mode === "embedded" ? [false] : [true, false]) {
    const row = selectJobRecord(scriptPayloads(html, schemaOnly), expectedJobId(new URL(sourceUrl)), schemaOnly, sourceUrl);
    if (row) return recordToJob(row, sourceUrl, schemaOnly ? "JSON-LD JobPosting" : "页面内嵌岗位详情");
  }
  return null;
}

function regionRecord(region: Node, allNodes: Node[]): JobRecord | null {
  const inside = nodes(region);
  const row: JobRecord = {};
  for (const node of inside) {
    const property = attr(node, "itemprop");
    if (["title", "description", "responsibilities", "qualifications", "hiringOrganization", "jobLocation", "employmentType", "datePosted", "validThrough", "educationRequirements", "experienceRequirements"].includes(property)) {
      row[property] = attr(node, "content") || tidy(nodeText(node));
    }
  }
  // Label/value tables and definition lists are semantic, not tied to one company.
  for (const parent of inside.filter((n) => ["tr", "dl"].includes(tag(n)))) {
    const cells = children(parent).filter((n) => /^(?:td|th|dt|dd)$/.test(tag(n)));
    for (let i = 0; i + 1 < cells.length; i++) {
      const label = tidy(nodeText(cells[i])).replace(/[：:]$/, "");
      const value = tidy(nodeText(cells[i + 1]));
      const map: Record<string, string> = { 职位名称: "title", 岗位名称: "title", 公司: "company", 公司名称: "company", 工作地点: "location", 工作职责: "description", 岗位职责: "description", 工作要求: "requirement", 任职要求: "requirement", 职责要求: "requirement", 招聘渠道: "recruitmentType", 招聘类型: "recruitmentType", 发布时间: "datePosted", 学历要求: "education", 专业要求: "major", 工作经验: "experience", 截止时间: "deadline", 薪资: "salary", 薪资待遇: "salary", 薪资范围: "salary", 实习时长: "internshipDuration", 每周出勤: "weeklyAttendance" };
      if (map[label] && value) row[map[label]] = value;
    }
  }
  const allTitles = allNodes.filter((n) => tag(n) === "h1" && !isListingTitle(tidy(nodeText(n))));
  const heading = inside.find((n) => tag(n) === "h1" && !isListingTitle(tidy(nodeText(n)))) ?? (allTitles.length === 1 ? allTitles[0] : undefined) ?? inside.find((n) => tag(n) === "h2" && !/^(?:岗位职责|职位职责|工作职责|岗位要求|任职要求|Responsibilities|Qualifications|Requirements)\s*[:：]?$/i.test(tidy(nodeText(n))));
  row.title ||= heading ? tidy(nodeText(heading)) : "";
  const regionText = tidy(nodeText(region));
  for (const [key, labels] of Object.entries({ salary: "薪资|薪资待遇|薪资范围|Salary", datePosted: "发布时间|发布日期", deadline: "投递截止日期|截止日期|截止时间", internshipDuration: "实习时长", weeklyAttendance: "每周出勤", recruitmentType: "招聘类型", company: "公司|公司名称" })) {
    row[key] ||= regionText.match(new RegExp(`^(?:${labels})\\s*[:：]\\s*(.+)$`, "im"))?.[1]?.trim();
  }
  return row.title ? row : null;
}

export function extractJobRegion(html: string, sourceUrl: string): ExtractedWebJob | null {
  const root = parse(html), all = nodes(root);
  function noiseAncestor(node: Node): boolean {
    if (excluded(node)) return true;
    return "parentNode" in node && node.parentNode ? noiseAncestor(node.parentNode) : false;
  }
  const candidates = all.filter((n) => !noiseAncestor(n) && (
    attr(n, "itemtype").includes("JobPosting") || /(?:job|position|post)[-_ ]?(?:detail|information|content)|detail[-_ ]?content/i.test(`${attr(n, "id")} ${attr(n, "class")}`) ||
    ["main", "article"].includes(tag(n)) || attr(n, "role") === "main"
  ));
  let best: { result: ExtractedWebJob; score: number } | null = null;
  const roles = new Set<string>();
  for (const region of candidates) {
    const text = tidy(nodeText(region));
    if (text.length < 50 || text.length > 40_000) continue;
    const row = regionRecord(region, all.filter((n) => !noiseAncestor(n))) ?? {};
    const parsed = parseJobText(text);
    const role = valueText(row.title) || parsed.role;
    const duties = valueText(row.description) || parsed.responsibilities;
    const requirements = valueText(row.requirement) || parsed.requirements;
    if (!role || isListingTitle(role) || (!duties && !requirements) || (text.match(/(?:岗位职责|工作职责|职位描述)\s*[:：]/g)?.length ?? 0) > 2) continue;
    roles.add(role);
    const result = recordToJob({ ...row, title: role, description: duties, requirement: requirements,
      location: row.location || parsed.location, company: row.company || parsed.company }, sourceUrl, "岗位详情区域");
    const metadataScore = ["salary", "datePosted", "deadline", "location", "education", "internshipDuration", "weeklyAttendance"].filter((key) => row[key]).length;
    const score = (row.description ? 8 : 0) + (row.requirement ? 8 : 0) + (duties ? 4 : 0) + (requirements ? 4 : 0) + metadataScore - text.length / 20_000;
    if (!best || score > best.score) best = { result, score };
  }
  if (roles.size > 1) return null;
  if (best) return best.result;
  // Last resort: a heading-bounded JD section, never the entire body/meta text.
  const headings = all.filter((n) => /^(?:h[1-6]|strong|b)$/.test(tag(n)) && /^(?:岗位职责|工作职责|职位描述|任职要求|岗位要求)\s*[:：]?$/.test(tidy(nodeText(n))));
  if (headings.length) {
    let region: Node | undefined = headings[0];
    for (let depth = 0; depth < 4 && region; depth++, region = "parentNode" in region ? region.parentNode ?? undefined : undefined) {
      if (["body", "html"].includes(tag(region))) break;
      const text = tidy(nodeText(region));
      const parsed = parseJobText(text);
      const title = all.find((n) => tag(n) === "h1" && !noiseAncestor(n));
      if (title && text.length >= 50 && (parsed.responsibilities || parsed.requirements)) return recordToJob({ title: tidy(nodeText(title)), description: parsed.responsibilities, requirement: parsed.requirements }, sourceUrl, "岗位标题与分节正文兜底");
    }
  }
  return null;
}
