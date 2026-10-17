export type InterviewQuestion = {
  id: string;
  company: "美团" | "百度";
  roleTags: Array<"产品" | "运营" | "设计" | "测试开发" | "用户研究">;
  category: "项目深挖" | "业务分析" | "产品设计" | "数据指标" | "AI产品" | "用户研究" | "测试技术" | "动机与协作";
  round: string;
  recruitmentSeason: string;
  year: 2024 | 2025 | 2026;
  question: string;
  followUps: string[];
  answerFramework: string[];
  signals: string[];
  source: {
    title: string;
    url: string;
    publishedAt: string;
  };
};

const MEITUAN_2024_OPS = "https://www.nowcoder.com/discuss/612366082120118272";
const MEITUAN_2024_PRODUCT = "https://www.nowcoder.com/discuss/635137980226617344";
const MEITUAN_2024_DESIGN = "https://www.nowcoder.com/feed/main/detail/6890865b01a043f7b32634a8e092074f";
const MEITUAN_2025_OPS = "https://www.nowcoder.com/discuss/701518725542891520";
const MEITUAN_2025_PRODUCT = "https://www.nowcoder.com/discuss/782666796108144640";
const MEITUAN_2026_PRODUCT = "https://www.nowcoder.com/feed/main/detail/6fa43107e40e4fdfa29a8eeee0e5847d";
const MEITUAN_2025_TEST = "https://www.codefather.cn/essay/1968943831409676289";
const MEITUAN_2025_AI = "https://www.nowcoder.com/feed/main/detail/fed219da4b2f4ccaa5a763ca301333bf";
const BAIDU_2024_PRODUCT = "https://www.nowcoder.com/discuss/640613666496262144";
const BAIDU_2024_STRATEGY = "https://www.nowcoder.com/discuss/623235718701211648";
const BAIDU_2025_AI = "https://www.nowcoder.com/discuss/787284347953942528";
const BAIDU_2025_RESEARCH = "https://www.nowcoder.com/discuss/797113416304300032";
const BAIDU_2025_PRODUCT = "https://www.nowcoder.com/discuss/927013555621068800";

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: "mt-2024-ops-project-metrics", company: "美团", roleTags: ["产品", "运营"], category: "项目深挖", round: "业务一面", recruitmentSeason: "2024 春招/暑期", year: 2024,
    question: "挑一个最有成就感的项目：目标为什么这样定，你具体做了什么，结果由哪些指标证明？",
    followUps: ["为什么选择这个项目？", "如果重做一次，你会改哪一段链路？"],
    answerFramework: ["先用一句话交代业务目标和你的职责", "按问题—判断—行动—结果讲清关键决策", "给出基线、目标、结果和你的贡献比例"],
    signals: ["目标感", "指标意识", "个人贡献可验证"],
    source: { title: "美团产品运营面经", url: MEITUAN_2024_OPS, publishedAt: "2024-04-23" },
  },
  {
    id: "mt-2024-product-cross-team", company: "美团", roleTags: ["产品", "运营"], category: "动机与协作", round: "业务一面", recruitmentSeason: "2024 暑期", year: 2024,
    question: "当合作团队目标并不一致时，你会如何推动一个需求按期上线？",
    followUps: ["最难合作的人是谁，分歧根源是什么？", "哪些事项可以妥协，哪些不能？"],
    answerFramework: ["先对齐共同业务结果和决策人", "拆出依赖、风险、时间点与责任人", "用数据或小范围验证降低争议"],
    signals: ["影响力", "风险管理", "跨团队推进"],
    source: { title: "美团产品暑期实习面经", url: MEITUAN_2024_PRODUCT, publishedAt: "2024-06-25" },
  },
  {
    id: "mt-2024-product-refund", company: "美团", roleTags: ["产品", "运营"], category: "业务分析", round: "业务一面", recruitmentSeason: "2024 暑期", year: 2024,
    question: "用户因多次卡券退款体验差而投诉，你如何兼顾用户权益、商家成本和平台规则设计解决方案？",
    followUps: ["如果你是商家，会反对方案的哪一点？", "怎样验证方案没有诱发套利？"],
    answerFramework: ["区分正常退款、异常使用和平台故障", "按用户、商家、平台列出目标与约束", "设计规则、申诉、灰度和监控指标"],
    signals: ["多方权衡", "异常场景", "方案闭环"],
    source: { title: "美团产品暑期实习面经", url: MEITUAN_2024_PRODUCT, publishedAt: "2024-06-25" },
  },
  {
    id: "mt-2024-product-critique", company: "美团", roleTags: ["产品", "运营", "设计"], category: "产品设计", round: "业务一面", recruitmentSeason: "2024 暑期", year: 2024,
    question: "选择一个你常用的美团业务，指出一个体验问题并给出可落地的优化方案。",
    followUps: ["问题是真实用户痛点还是个人偏好？", "上线后看什么指标？"],
    answerFramework: ["限定用户、场景和任务", "用证据描述问题频率与影响", "给出最小方案、风险与验证指标"],
    signals: ["用户视角", "产品判断", "验证意识"],
    source: { title: "美团产品暑期实习面经", url: MEITUAN_2024_PRODUCT, publishedAt: "2024-06-25" },
  },
  {
    id: "mt-2024-design-portfolio", company: "美团", roleTags: ["设计", "产品"], category: "项目深挖", round: "作品集面", recruitmentSeason: "2024 暑期", year: 2024,
    question: "从作品集中挑一个项目，说明你遇到的核心设计难题、关键取舍和最终验证结果。",
    followUps: ["哪些方案被否决，为什么？", "研究结论如何转化为交互或视觉决策？"],
    answerFramework: ["交代目标用户和业务限制", "展示探索过程而非只展示终稿", "用可用性测试或业务数据验证"],
    signals: ["设计推理", "取舍能力", "验证闭环"],
    source: { title: "美团交互设计岗暑期实习面经", url: MEITUAN_2024_DESIGN, publishedAt: "2024-03-29" },
  },
  {
    id: "mt-2025-ops-growth", company: "美团", roleTags: ["运营", "产品"], category: "业务分析", round: "业务一面", recruitmentSeason: "2025 春招", year: 2025,
    question: "为一个本地生活业务设计拉新方案，你会如何选人群、渠道、激励和衡量指标？",
    followUps: ["如何避免只带来低质量补贴用户？", "预算减少一半时保留什么？"],
    answerFramework: ["明确拉新目标与高价值人群", "拆解触达—转化—首单—留存漏斗", "同时关注获客成本、留存与增量性"],
    signals: ["增长漏斗", "成本意识", "用户质量"],
    source: { title: "美团产品运营校招面经", url: MEITUAN_2025_OPS, publishedAt: "2024-12-25" },
  },
  {
    id: "mt-2025-ops-business-understanding", company: "美团", roleTags: ["运营", "产品"], category: "动机与协作", round: "主管面", recruitmentSeason: "2025 春招", year: 2025,
    question: "你为什么选择产品运营，且为什么想做当前业务，而不是只想进一家大公司？",
    followUps: ["你最常使用这个业务的哪个功能？", "你的经历和该业务有什么可迁移之处？"],
    answerFramework: ["岗位动机、业务兴趣、能力证据分别回答", "结合真实使用经历提出观察", "说明短期贡献和长期成长方向"],
    signals: ["动机真实性", "业务理解", "自我认知"],
    source: { title: "美团产品运营校招面经", url: MEITUAN_2025_OPS, publishedAt: "2024-12-25" },
  },
  {
    id: "mt-2025-product-project", company: "美团", roleTags: ["产品"], category: "项目深挖", round: "业务一面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "讲一个你主导推进的产品项目：遇到什么阻力，怎么做决策，创新点是否真正产生效果？",
    followUps: ["你本人不可替代的贡献是什么？", "结果不及预期时做了什么？"],
    answerFramework: ["用时间线讲关键节点", "突出关键判断和协作动作", "用前后数据与反事实说明贡献"],
    signals: ["主导性", "问题解决", "结果可信"],
    source: { title: "美团产品经理岗面经", url: MEITUAN_2025_PRODUCT, publishedAt: "2025-08-07" },
  },
  {
    id: "mt-2025-product-model-metrics", company: "美团", roleTags: ["产品", "测试开发"], category: "数据指标", round: "业务一面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "如果项目里用了模型，你怎样定义离线与线上指标，并解释精确率、召回率之间的取舍？",
    followUps: ["业务更怕误判还是漏判？", "模型指标提升但业务指标没变怎么办？"],
    answerFramework: ["先说明业务损失函数", "给出离线评测集与线上实验", "解释指标变化到业务结果的因果链"],
    signals: ["指标理解", "业务映射", "实验意识"],
    source: { title: "美团产品经理岗面经", url: MEITUAN_2025_PRODUCT, publishedAt: "2025-08-07" },
  },
  {
    id: "mt-2025-ai-scheduling", company: "美团", roleTags: ["产品", "运营"], category: "AI产品", round: "专业面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "恶劣天气叠加订单高峰时，怎样用 AI 优化骑手调度，同时控制安全与公平风险？",
    followUps: ["缺少实时数据时如何降级？", "怎样避免效率目标压过骑手安全？"],
    answerFramework: ["明确供需、履约、安全三类目标", "列出输入信号、策略和人工兜底", "设计仿真、灰度与安全红线指标"],
    signals: ["AI场景化", "系统权衡", "安全意识"],
    source: { title: "美团AI产品经理面经", url: MEITUAN_2025_AI, publishedAt: "2025-10-16" },
  },
  {
    id: "mt-2025-test-case", company: "美团", roleTags: ["测试开发"], category: "测试技术", round: "技术一面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "给一个订单或设备绑定功能，你会怎样系统地设计测试点并确定优先级？",
    followUps: ["如何覆盖接口异常和状态流转？", "上线前时间不足先测什么？"],
    answerFramework: ["按主流程、边界、异常、权限、并发拆分", "说明数据准备和环境依赖", "用风险×影响确定回归优先级"],
    signals: ["测试建模", "风险排序", "端到端意识"],
    source: { title: "美团测开日常实习面经", url: MEITUAN_2025_TEST, publishedAt: "2025-09-19" },
  },
  {
    id: "mt-2025-test-sql-algo", company: "美团", roleTags: ["测试开发"], category: "测试技术", round: "技术一面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "如何用 SQL 找到订单数最多的客户？如果并列第一，结果应该怎么处理？",
    followUps: ["大表上怎样优化？", "如何验证查询结果正确？"],
    answerFramework: ["先按客户聚合计数", "用排序/窗口函数处理并列", "补充索引、样例数据和边界验证"],
    signals: ["SQL基础", "边界意识", "可验证性"],
    source: { title: "美团测开日常实习面经", url: MEITUAN_2025_TEST, publishedAt: "2025-09-19" },
  },
  {
    id: "mt-2026-product-login", company: "美团", roleTags: ["产品", "设计"], category: "产品设计", round: "业务二面", recruitmentSeason: "2026 届暑期", year: 2026,
    question: "一个小程序为什么需要登录页？请从用户价值、业务目标和风险控制判断是否真的需要。",
    followUps: ["能否先体验后登录？", "你会看哪些数据决定去留？"],
    answerFramework: ["先区分必须登录与延迟登录场景", "评估身份、个性化、交易和合规需要", "比较转化损失与业务收益"],
    signals: ["需求本质", "转化权衡", "场景意识"],
    source: { title: "美团用户产品二面面经", url: MEITUAN_2026_PRODUCT, publishedAt: "2025-04-29" },
  },
  {
    id: "mt-2026-product-method", company: "美团", roleTags: ["产品", "运营"], category: "项目深挖", round: "业务二面", recruitmentSeason: "2026 届暑期", year: 2026,
    question: "几段实习之后，你形成了什么可复用的方法，而不是只积累了工作清单？",
    followUps: ["这个方法何时失效？", "给一个你据此改变决策的例子。"],
    answerFramework: ["提炼一个具体方法", "讲清形成它的两次以上实践", "说明适用边界和下一次改进"],
    signals: ["复盘能力", "抽象能力", "迁移能力"],
    source: { title: "美团用户产品二面面经", url: MEITUAN_2026_PRODUCT, publishedAt: "2025-04-29" },
  },
  {
    id: "bd-2024-product-segmentation", company: "百度", roleTags: ["产品", "用户研究"], category: "产品设计", round: "业务面", recruitmentSeason: "2024 暑期", year: 2024,
    question: "你怎样按用户群体做需求分析、确定需求优先级，并判断某个功能是否真正创造用户价值？",
    followUps: ["不同用户目标冲突怎么办？", "没有历史数据如何判断优先级？"],
    answerFramework: ["基于任务与行为而非人口属性分群", "用价值、覆盖、成本和风险排序", "定义行为与结果指标验证用户价值"],
    signals: ["用户分层", "优先级方法", "价值验证"],
    source: { title: "百度产品经理实习面经", url: BAIDU_2024_PRODUCT, publishedAt: "2024-07-10" },
  },
  {
    id: "bd-2024-strategy-experiment", company: "百度", roleTags: ["产品", "运营"], category: "数据指标", round: "业务面", recruitmentSeason: "2024 春招", year: 2024,
    question: "讲一个产品实验：假设怎么提出，实验怎样设计，效果用什么指标判断？",
    followUps: ["如何排除同期活动影响？", "主指标涨了但护栏指标跌了怎么办？"],
    answerFramework: ["明确问题、假设和最小改动", "说明分流、周期、样本和显著性", "同时报告主指标、护栏与长期影响"],
    signals: ["实验设计", "因果思维", "指标完整"],
    source: { title: "百度商业产品经理面经", url: BAIDU_2024_STRATEGY, publishedAt: "2024-05-23" },
  },
  {
    id: "bd-2024-product-cloud-ai", company: "百度", roleTags: ["产品", "用户研究"], category: "AI产品", round: "业务面", recruitmentSeason: "2024 暑期", year: 2024,
    question: "如果岗位与云和 AI 相关，你如何解释云服务与大模型的关系，并举出一个可落地的产品场景？",
    followUps: ["为什么必须用大模型？", "成本、延迟和准确性如何权衡？"],
    answerFramework: ["用通俗语言解释技术能力边界", "从用户任务而非技术出发选场景", "补充数据、评测、成本和兜底"],
    signals: ["技术理解", "场景判断", "可行性意识"],
    source: { title: "百度产品经理实习面经", url: BAIDU_2024_PRODUCT, publishedAt: "2024-07-10" },
  },
  {
    id: "bd-2025-ai-evaluation", company: "百度", roleTags: ["产品", "用户研究"], category: "AI产品", round: "专业面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "为一款大模型产品建立评测框架，你会如何把模型能力、任务完成和用户体验放进同一套指标？",
    followUps: ["评测集如何避免污染？", "人工评价与自动指标冲突怎么办？"],
    answerFramework: ["按场景拆任务与失败类型", "组合离线、人工和线上行为指标", "说明样本、权重、版本对比与回归机制"],
    signals: ["评测体系", "AI理解", "指标权衡"],
    source: { title: "百度AI产品经理面经", url: BAIDU_2025_AI, publishedAt: "2025-08-19" },
  },
  {
    id: "bd-2025-ai-global", company: "百度", roleTags: ["产品", "运营", "用户研究"], category: "业务分析", round: "专业面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "一款 AI 产品出海时，海外用户可能更在意哪些问题？你会怎样做本地化验证？",
    followUps: ["哪些需求不能只靠翻译解决？", "首个市场如何选择？"],
    answerFramework: ["从任务、文化、法规、竞品和支付拆解", "选一个细分市场做假设", "用本地访谈、可用性测试和灰度数据验证"],
    signals: ["全球化视角", "研究设计", "商业判断"],
    source: { title: "百度AI产品经理面经", url: BAIDU_2025_AI, publishedAt: "2025-08-19" },
  },
  {
    id: "bd-2025-research-operationalize", company: "百度", roleTags: ["用户研究", "产品"], category: "用户研究", round: "专业面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "怎样把 AI 助手的‘智能感’和‘拟人感’转化为可以研究和衡量的指标？",
    followUps: ["两个概念可能互相冲突吗？", "问卷分数怎样与真实行为互证？"],
    answerFramework: ["先做概念定义与维度拆解", "为每个维度设计主观量表和客观行为指标", "通过预测效度和业务结果验证指标"],
    signals: ["操作化能力", "量表意识", "效度思维"],
    source: { title: "百度用户研究面经", url: BAIDU_2025_RESEARCH, publishedAt: "2025-09-15" },
  },
  {
    id: "bd-2025-research-trust", company: "百度", roleTags: ["用户研究", "产品"], category: "用户研究", round: "专业面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "请设计一项混合方法研究，解释用户对 AI 助手的信任如何形成和变化。",
    followUps: ["定性和定量分别回答什么？", "如何把访谈洞察转成可检验假设？"],
    answerFramework: ["先用探索性访谈建立信任模型", "再用问卷/日志验证关系和分群差异", "用纵向跟踪观察信任校准"],
    signals: ["混合方法", "研究闭环", "纵向视角"],
    source: { title: "百度用户研究面经", url: BAIDU_2025_RESEARCH, publishedAt: "2025-09-15" },
  },
  {
    id: "bd-2025-research-cognitive-load", company: "百度", roleTags: ["用户研究", "设计"], category: "用户研究", round: "专业面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "除问卷和访谈外，如何更客观地评估复杂 AI 界面带来的认知负荷？",
    followUps: ["哪些测量会干扰任务本身？", "低耗时是否一定代表低负荷？"],
    answerFramework: ["组合任务表现、行为观察与生理信号", "定义基线、任务难度和对照条件", "做三角互证并讨论测量局限"],
    signals: ["研究方法储备", "实验控制", "谨慎解释"],
    source: { title: "百度用户研究面经", url: BAIDU_2025_RESEARCH, publishedAt: "2025-09-15" },
  },
  {
    id: "bd-2025-research-experiment", company: "百度", roleTags: ["用户研究", "产品"], category: "用户研究", round: "专业面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "设计实验验证：会表达不确定性的 AI，是否比总是自信回答的 AI 更能获得长期信任？",
    followUps: ["自变量和因变量是什么？", "用户口头更信任却更少使用，怎样解释？"],
    answerFramework: ["随机分组并控制答案质量与任务难度", "同时测信任量表、依赖行为、纠错和复访", "把态度—行为差异作为机制线索而非直接判错"],
    signals: ["实验设计", "变量控制", "结果解释"],
    source: { title: "百度用户研究面经", url: BAIDU_2025_RESEARCH, publishedAt: "2025-09-15" },
  },
  {
    id: "bd-2025-product-medical-ai", company: "百度", roleTags: ["产品", "用户研究"], category: "业务分析", round: "业务面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "如何通过行业研究找到医疗 AI 的高价值场景，并判断一个智能体机会是否值得做？",
    followUps: ["如何处理准确性与责任边界？", "第一个 MVP 选什么？"],
    answerFramework: ["从高频高损任务和关键角色切入", "评估价值、可行性、合规和数据获得性", "用人机协同 MVP 验证效率与质量"],
    signals: ["行业研究", "风险意识", "MVP判断"],
    source: { title: "百度产品经理岗面经整理", url: BAIDU_2025_PRODUCT, publishedAt: "2025-10-29" },
  },
  {
    id: "bd-2025-product-empathy", company: "百度", roleTags: ["产品", "用户研究", "设计"], category: "产品设计", round: "业务面", recruitmentSeason: "2025 秋招", year: 2025,
    question: "怎样让 AI 对话更有同理心，同时避免迎合、误导和越界建议？",
    followUps: ["同理心如何衡量？", "高风险话题怎样兜底？"],
    answerFramework: ["区分情绪识别、表达和行动建议", "定义可接受与禁止行为", "用专家标注、用户研究和安全指标联合评测"],
    signals: ["用户同理心", "安全边界", "评测设计"],
    source: { title: "百度产品经理岗面经整理", url: BAIDU_2025_PRODUCT, publishedAt: "2025-10-29" },
  },
];

export const INTERVIEW_BANK_LAST_UPDATED = "2026-09-22";

