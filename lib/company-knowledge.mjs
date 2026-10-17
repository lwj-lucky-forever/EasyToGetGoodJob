/** Common employers and consumer-facing brands seen in Chinese internship JDs. */
export const KNOWN_COMPANIES = [
  { canonical: "字节跳动", aliases: ["字节跳动", "ByteDance", "抖音集团", "抖音", "飞书", "TikTok", "番茄小说"] },
  { canonical: "阿里巴巴", aliases: ["阿里巴巴集团", "阿里巴巴", "淘天集团", "淘宝天猫", "淘宝", "天猫", "阿里云", "钉钉", "菜鸟", "饿了么", "盒马", "高德地图", "高德"] },
  { canonical: "腾讯", aliases: ["腾讯科技", "腾讯集团", "腾讯", "Tencent", "微信", "腾讯音乐", "腾讯视频"] },
  { canonical: "美团", aliases: ["北京三快在线科技有限公司", "美团点评", "美团", "Meituan"] },
  { canonical: "百度", aliases: ["北京百度网讯科技有限公司", "百度集团", "百度", "Baidu"] },
  { canonical: "滴滴", aliases: ["北京小桔科技有限公司", "滴滴出行", "滴滴", "DiDi"] },
  { canonical: "京东", aliases: ["北京京东世纪贸易有限公司", "京东集团", "京东科技", "京东物流", "京东", "JD.com"] },
  { canonical: "拼多多", aliases: ["拼多多", "Pinduoduo", "PDD", "Temu"] },
  { canonical: "小红书", aliases: ["行吟信息科技", "小红书", "REDnote"] },
  { canonical: "快手", aliases: ["北京快手科技有限公司", "快手科技", "快手", "Kuaishou"] },
  { canonical: "华为", aliases: ["华为技术有限公司", "华为终端", "华为", "Huawei"] },
  { canonical: "小米", aliases: ["小米集团", "小米科技", "小米", "Xiaomi"] },
  { canonical: "网易", aliases: ["网易集团", "网易互娱", "网易雷火", "网易游戏", "网易", "NetEase"] },
  { canonical: "哔哩哔哩", aliases: ["哔哩哔哩", "bilibili", "B站"] },
  { canonical: "携程", aliases: ["携程集团", "携程旅行", "携程", "Trip.com"] },
  { canonical: "蚂蚁集团", aliases: ["蚂蚁科技集团", "蚂蚁集团", "蚂蚁金服", "支付宝"] },
  { canonical: "顺丰", aliases: ["顺丰控股", "顺丰科技", "顺丰速运", "顺丰"] },
  { canonical: "联想", aliases: ["联想集团", "联想", "Lenovo"] },
  { canonical: "新浪", aliases: ["新浪集团", "新浪", "微博"] },
  { canonical: "搜狐", aliases: ["搜狐集团", "搜狐"] },
  { canonical: "知乎", aliases: ["北京智者天下科技有限公司", "知乎"] },
  { canonical: "得物", aliases: ["上海识装信息科技有限公司", "得物App", "得物"] },
  { canonical: "贝壳找房", aliases: ["贝壳找房", "贝壳", "链家"] },
  { canonical: "Boss直聘", aliases: ["BOSS直聘", "看准科技"] },
  { canonical: "同程旅行", aliases: ["同程旅行", "同程"] },
  { canonical: "去哪儿", aliases: ["去哪儿旅行", "去哪儿网", "去哪儿"] },
  { canonical: "唯品会", aliases: ["唯品会", "Vipshop"] },
  { canonical: "爱奇艺", aliases: ["爱奇艺", "iQIYI"] },
  { canonical: "科大讯飞", aliases: ["科大讯飞", "讯飞"] },
  { canonical: "商汤科技", aliases: ["商汤科技", "商汤", "SenseTime"] },
  { canonical: "小马智行", aliases: ["小马智行", "Pony.ai"] },
  { canonical: "文远知行", aliases: ["文远知行", "WeRide"] },
  { canonical: "理想汽车", aliases: ["北京车和家信息技术有限公司", "理想汽车"] },
  { canonical: "蔚来", aliases: ["蔚来汽车", "蔚来", "NIO"] },
  { canonical: "小鹏汽车", aliases: ["小鹏汽车", "小鹏", "XPeng"] },
  { canonical: "比亚迪", aliases: ["比亚迪股份有限公司", "比亚迪", "BYD"] },
  { canonical: "吉利汽车", aliases: ["吉利控股", "吉利汽车", "吉利"] },
  { canonical: "长城汽车", aliases: ["长城汽车", "Great Wall Motor"] },
  { canonical: "微软", aliases: ["微软中国", "微软", "Microsoft"] },
  { canonical: "亚马逊", aliases: ["亚马逊中国", "亚马逊", "Amazon", "AWS"] },
  { canonical: "谷歌", aliases: ["谷歌中国", "谷歌", "Google"] },
  { canonical: "苹果", aliases: ["苹果公司", "Apple"] },
  { canonical: "英伟达", aliases: ["英伟达", "NVIDIA"] },
  { canonical: "特斯拉", aliases: ["特斯拉", "Tesla"] },
] ;

/** @type {ReadonlyArray<readonly [RegExp, string]>} */
const COMPANY_DOMAINS = [
  [/^xiaomi\.jobs\.f\.mioffice\.cn$/, "小米"],
  [/(?:^|\.)zhaopin\.meituan\.com$|(?:^|\.)meituan\.com$/, "美团"],
  [/(?:^|\.)talent\.baidu\.com$|(?:^|\.)baidu\.com$/, "百度"],
  [/(?:^|\.)talent\.didiglobal\.com$|(?:^|\.)didiglobal\.com$/, "滴滴"],
  [/(?:^|\.)jobs\.bytedance\.com$|(?:^|\.)bytedance\.com$/, "字节跳动"],
  [/(?:^|\.)join\.qq\.com$|(?:^|\.)tencent\.com$/, "腾讯"],
  [/(?:^|\.)talent\.alibaba\.com$|(?:^|\.)alibaba\.com$/, "阿里巴巴"],
  [/(?:^|\.)campus\.jd\.com$|(?:^|\.)jd\.com$/, "京东"],
  [/(?:^|\.)career\.huawei\.com$|(?:^|\.)huawei\.com$/, "华为"],
  [/(?:^|\.)hr\.xiaomi\.com$|(?:^|\.)xiaomi\.com$/, "小米"],
  [/(?:^|\.)campus\.163\.com$|(?:^|\.)netease\.com$/, "网易"],
  [/(?:^|\.)jobs\.xiaohongshu\.com$|(?:^|\.)xiaohongshu\.com$/, "小红书"],
  [/(?:^|\.)zhaopin\.kuaishou\.cn$|(?:^|\.)kuaishou\.com$/, "快手"],
];

function latinBoundaryMatch(text, alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
}

function aliasAppears(text, alias) {
  return /[a-z]/i.test(alias) ? latinBoundaryMatch(text, alias) : text.includes(alias);
}

export function canonicalCompanyName(value) {
  const normalized = value.replace(/[【】\[\]]/g, "").replace(/(?:校园)?招聘$|诚聘$/g, "").trim();
  if (!normalized) return "";
  for (const company of KNOWN_COMPANIES) {
    if (company.aliases.some((alias) => normalized.toLowerCase() === alias.toLowerCase())) return company.canonical;
  }
  return normalized;
}

export const normalizeKnownCompany = canonicalCompanyName;

/** @returns {string} */
export function inferKnownCompany(text, sourceUrl = "") {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (sourceUrl) {
    try {
      const host = new URL(sourceUrl).hostname.toLowerCase();
      const domainMatch = COMPANY_DOMAINS.find(([matcher]) => matcher.test(host));
      if (domainMatch) return domainMatch[1];
    } catch { /* Ignore incomplete or malformed source URLs. */ }
  }
  if (!normalized) return "";
  let best = null;
  for (const company of KNOWN_COMPANIES) {
    for (const alias of company.aliases) {
      if (!aliasAppears(normalized, alias)) continue;
      const index = normalized.toLowerCase().indexOf(alias.toLowerCase());
      const candidate = { canonical: company.canonical, index: index < 0 ? Number.MAX_SAFE_INTEGER : index, aliasLength: alias.length };
      if (!best || candidate.index < best.index || (candidate.index === best.index && candidate.aliasLength > best.aliasLength)) best = candidate;
    }
  }
  return best?.canonical ?? "";
}
