import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inferJobCompetencies, fillJobCompetencies } from '../lib/job-competencies.ts';
import { parseJobText, mergeParsedJob } from '../lib/job-parser.ts';
import { normalizeImportedJob, safelyParseJobText, recognizedImportKeys } from '../lib/job-import.ts';
import { recordToJob } from '../lib/job-web-extract.ts';
import { readJobUrl } from '../lib/job-web-platforms.ts';

test('paste import infers grounded skills without a dedicated abilities section', () => {
  const jd = '公司：测试公司\n岗位：产品实习生\n岗位职责\n负责用户访谈和需求分析；使用 Figma 制作交互原型；跟进项目推进与上线\n岗位要求\n熟练使用 SQL 进行数据分析，具备沟通协调能力。';
  const parsed = safelyParseJobText(jd);
  for (const expected of ['用户研究与需求分析', '产品设计与原型', '数据处理与分析', '沟通与团队协作', '项目推进与交付']) assert.match(parsed.competencies, new RegExp(expected));
  assert.match(parsed.competencies, /熟练使用 SQL 进行数据分析/);
  assert.ok(recognizedImportKeys(parsed).includes('competencies'));
  assert.equal(parsed.company, '测试公司');
  assert.equal(parsed.role, '产品实习生');
  assert.match(parsed.requirements, /沟通协调/);
});

test('explicit Chinese/English capability headings take priority, including compact JD', () => {
  for (const heading of ['重点考察能力', '重点考查能力', '技能要求', 'Key skills', 'Core competencies']) {
    const parsed = parseJobText(`岗位：产品实习生\n岗位职责：负责用户调研\n${heading}：需求洞察、综合判断`);
    assert.equal(parsed.competencies, '需求洞察、综合判断');
  }
  assert.equal(parseJobText('公司：测试公司  岗位：实习生  重点考察能力：精确判断和独立表达').competencies, '精确判断和独立表达');
});

test('web normalization infers from scoped fields but not company, title or page noise', () => {
  const parsed = normalizeImportedJob({ company: 'AI 数据公司', role: '英语产品经理', responsibilities: '负责用户访谈与竞品分析', requirements: '本科在读，每周到岗4天', rawText: '导航：数据分析\n公司介绍：我们使用 AI 技术\n推荐职位：Java 工程师' });
  assert.match(parsed.competencies, /用户研究与需求分析|业务理解与行业研究/);
  assert.doesNotMatch(parsed.competencies, /AI 与机器学习|编程与软件开发|英语与外语|数据处理与分析/);
  assert.equal(inferJobCompetencies({ requirements: '本科在读，每周到岗4天，连续实习3个月' }), '');
});

test('different jobs produce different abilities, not the same generic tags', () => {
  const dev = inferJobCompetencies({ responsibilities: '负责使用 Java 开发后端服务，定位和解决线上问题', requirements: '掌握算法和数据结构' });
  const operation = inferJobCompetencies({ responsibilities: '负责内容运营，策划拉新活动并跟踪用户留存', requirements: '具备文案写作和沟通能力' });
  assert.match(dev, /编程与软件开发/);
  assert.doesNotMatch(dev, /运营与增长|产品设计与原型/);
  assert.match(operation, /运营与增长|内容策划与文字表达/);
  assert.doesNotMatch(operation, /编程与软件开发/);
});

test('negative conditions and unrelated introductions never become positive abilities', () => {
  const result = inferJobCompetencies({ requirements: '不要求掌握 SQL，不需要英语。熟悉 Figma 原型工具。Java is not required.', responsibilities: '公司介绍：我们拥有数据分析和 AI 团队\n推荐职位：内容运营' });
  assert.match(result, /产品设计与原型/);
  assert.doesNotMatch(result, /数据处理与分析|英语与外语|AI 与机器学习|运营与增长|编程与软件开发/);
  assert.match(inferJobCompetencies({ requirements: '岗位要求：熟练使用 SQL 进行数据分析' }), /数据处理与分析/);
});

test('manual capabilities survive merging; blank and zero legacy fields are filled without changing job state', () => {
  const manual = { role: '实习生', responsibilities: '负责用户研究', requirements: '熟练 SQL', competencies: '我手工填写的专项能力', status: '面试', jobOrder: 7 };
  assert.equal(fillJobCompetencies(manual), manual);
  assert.equal(mergeParsedJob(manual, parseJobText('岗位要求：熟悉数据分析')).competencies, manual.competencies);
  for (const value of ['', '0']) {
    const legacy = { ...manual, competencies: value };
    const updated = mergeParsedJob(legacy, {});
    assert.match(updated.competencies, /数据处理与分析|用户研究与需求分析/);
    assert.equal(updated.status, manual.status);
    assert.equal(updated.jobOrder, 7);
    assert.equal(legacy.competencies, value);
  }
});

test('JSON-LD skills and explicit HTML sections are retained in preview and clean rawText', async () => {
  const row = { '@type': 'JobPosting', title: '测试产品岗位', hiringOrganization: { name: '测试公司' }, description: '岗位职责：负责用户调研和需求分析，协助产品迭代上线。', qualifications: '本科在读，每周实习4天，连续3个月。', skills: ['需求洞察', 'SQL'] };
  const jsonld = await readJobUrl('https://careers.example.com/job/detail', async () => new Response(`<script type="application/ld+json">${JSON.stringify(row)}</script><nav>推荐职位：英语运营</nav>`, { headers: { 'content-type': 'text/html' } }));
  assert.equal(jsonld.parsed.competencies, '需求洞察、SQL');
  assert.match(jsonld.parsed.rawText, /重点考察能力/);
  assert.doesNotMatch(jsonld.parsed.competencies, /英语运营/);
  const explicit = recordToJob({ title: '产品实习生', description: '岗位职责：负责用户调研和产品功能规划。\n重点考察能力：需求洞察与系统思考', requirements: '本科在读，每周到岗4天，至少实习3个月。' }, 'https://careers.example.com/position/1234', 'test');
  assert.equal(explicit.parsed.competencies, '需求洞察与系统思考');
});

test('Baidu, ByteDance and Xiaomi adapters infer skills through the shared pipeline', async () => {
  const cases = [
    ['bytedance', '字节跳动', 'https://jobs.bytedance.com/campus/position/7476301700300933383/detail'],
    ['xiaomi', '小米', 'https://xiaomi.jobs.f.mioffice.cn/internship/position/7694244084009421092/detail'],
  ];
  for (const [fixture, company, url] of cases) {
    const payload = JSON.parse(await readFile(new URL(`./fixtures/job-web/${fixture}.json`, import.meta.url), 'utf8'));
    let requests = 0;
    const result = await readJobUrl(url, async () => ++requests === 1 ? new Response('<title>招聘</title>', { headers: { 'content-type': 'text/html' } }) : Response.json(payload));
    assert.equal(result.parsed.company, company);
    assert.ok(result.parsed.competencies, `${company} should have job-specific skills`);
    assert.ok(recognizedImportKeys(result.parsed).includes('competencies'));
  }
  const baiduRow = { name: '产品实习生', postId: '12345678', workContent: '负责用户访谈和需求分析，持续推进产品迭代上线。', serviceCondition: '本科及以上，具备沟通能力，熟悉 Figma 原型工具。' };
  const baidu = await readJobUrl('https://talent.baidu.com/jobs/detail/INTERN/12345678', async () => new Response(`<script>window.__INITIAL_DATA__=${JSON.stringify({ detailData: { postInfo: baiduRow } })};</script>`, { headers: { 'content-type': 'text/html' } }));
  assert.match(baidu.parsed.competencies, /用户研究与需求分析/);
  assert.match(baidu.parsed.competencies, /产品设计与原型/);
});

test('results are deduplicated and bounded; missing or malformed source does not invent a skill', () => {
  assert.equal(inferJobCompetencies({ requirements: null, responsibilities: 0 }), '');
  const result = inferJobCompetencies({ requirements: ('熟练 SQL，沟通能力，产品设计，用户调研，项目管理，英语，学习能力，责任心，文案写作，内容运营，AI 应用。\n').repeat(50) });
  assert.ok(result.split('\n').length <= 8);
  assert.equal(new Set(result.split('\n').map(line => line.split('：')[0])).size, result.split('\n').length);
  assert.ok(result.length < 1600);
});
