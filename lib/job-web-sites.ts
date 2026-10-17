/** Site identity is separate from the employer named in a job posting. */
export type JobSite = {
  id: string;
  name: string;
  platform: "official" | "feishu" | "moka" | "beisen" | "generic";
  company?: string;
};

// Identity hints, not a claim that every site's private/dynamic API is supported.
const EMPLOYER_SITES: Array<{ id: string; name: string; hosts: string[] }> = [
  { id: "bytedance", name: "字节跳动", hosts: ["jobs.bytedance.com", "jobs.toutiao.com"] },
  { id: "baidu", name: "百度", hosts: ["talent.baidu.com"] },
  { id: "xiaomi", name: "小米", hosts: ["hr.xiaomi.com", "xiaomi.jobs.f.mioffice.cn"] },
  { id: "meituan", name: "美团", hosts: ["zhaopin.meituan.com"] },
  { id: "alibaba", name: "阿里巴巴", hosts: ["talent.alibaba.com", "careers.alibaba.com", "talent.taotian.com", "campus-talent.alibaba.com", "talent-holding.alibaba.com"] },
  { id: "tencent", name: "腾讯", hosts: ["careers.tencent.com", "join.qq.com"] },
  { id: "jd", name: "京东", hosts: ["campus.jd.com", "zhaopin.jd.com", "careers.jd.com"] },
  { id: "didi", name: "滴滴", hosts: ["talent.didiglobal.com"] },
  { id: "xiaohongshu", name: "小红书", hosts: ["jobs.xiaohongshu.com", "job.xiaohongshu.com"] },
  { id: "huawei", name: "华为", hosts: ["career.huawei.com"] },
];

export function identifyJobSite(url: URL): JobSite {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const employer = EMPLOYER_SITES.find((site) => site.hosts.includes(host));
  const platform = host === "jobs.bytedance.com" || /^[a-z\d-]+\.jobs\.(?:f\.mioffice|feishu)\.cn$/.test(host) ? "feishu" :
    /(?:^|\.)mokahr\.com$/.test(host) ? "moka" : /(?:^|\.)(?:zhiye\.com|beisen\.com)$/.test(host) ? "beisen" : employer ? "official" : "generic";
  if (employer) return { id: employer.id, name: `${employer.name}招聘`, platform, company: employer.name };
  const names = { feishu: "飞书招聘平台", moka: "Moka 招聘平台", beisen: "北森招聘平台", official: "招聘官网", generic: host };
  return { id: platform, name: names[platform], platform };
}
