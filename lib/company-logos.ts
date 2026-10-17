import { canonicalCompanyName } from "./company-knowledge.mjs";

// Local copies of official website assets; provenance is in public/company-logos/sources.json.
const COMPANY_LOGOS: Readonly<Record<string, string>> = {
  "字节跳动": "bytedance.png", "百度": "baidu.ico", "小米": "xiaomi.ico",
  "美团": "meituan.ico", "阿里巴巴": "alibaba.jpg", "腾讯": "tencent-wordmark.png",
  "京东": "jd.ico", "滴滴": "didi.ico", "小红书": "xiaohongshu.ico",
  "华为": "huawei.svg", "拼多多": "pinduoduo.png", "快手": "kuaishou.ico",
  "网易": "netease.ico", "哔哩哔哩": "bilibili-icon.ico",
};

export function companyLogoSrc(company: string): string | undefined {
  const name = canonicalCompanyName(company);
  const file = Object.hasOwn(COMPANY_LOGOS, name) ? COMPANY_LOGOS[name] : undefined;
  return file ? `/company-logos/${file}` : undefined;
}
