export type OrderableJob = {
  id: number;
  company: string;
  companyOrder: number;
  jobOrder: number;
};

export type CompanyJobGroup<T extends OrderableJob> = {
  key: string;
  company: string;
  companyOrder: number;
  firstIndex: number;
  jobs: T[];
};

export function companyKey(company: string) {
  return company.trim().replace(/\s+/g, " ").toLocaleLowerCase() || "未命名公司";
}

function validOrder(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function groupJobsByCompany<T extends OrderableJob>(jobs: T[]): CompanyJobGroup<T>[] {
  const groups = new Map<string, CompanyJobGroup<T>>();
  jobs.forEach((job, index) => {
    const key = companyKey(job.company);
    const order = validOrder(job.companyOrder);
    const group = groups.get(key);
    if (group) {
      group.jobs.push(job);
      group.companyOrder = Math.min(group.companyOrder, order);
    } else {
      groups.set(key, { key, company: job.company.trim() || "未命名公司", companyOrder: order, firstIndex: index, jobs: [job] });
    }
  });
  return [...groups.values()]
    .sort((a, b) => a.companyOrder - b.companyOrder || a.firstIndex - b.firstIndex)
    .map((group) => ({
      ...group,
      jobs: group.jobs
        .map((job, index) => ({ job, index }))
        .sort((a, b) => validOrder(a.job.jobOrder) - validOrder(b.job.jobOrder) || a.index - b.index)
        .map(({ job }) => job),
    }));
}

export function numberGroupedJobs<T extends OrderableJob>(groups: CompanyJobGroup<T>[]) {
  return groups.flatMap((group, companyOrder) =>
    group.jobs.map((job, jobOrder) => ({ ...job, companyOrder, jobOrder })),
  );
}

export const MANUAL_ORDER_STORAGE_KEY = "EasyToGetGoodJob:manual-order:v1";
export type JobOrderMode = "match" | "custom";

/** Legacy rows have no manual-history flag. Preserve non-insertion ordering. */
export function hasStoredCustomOrder<T extends OrderableJob>(jobs: T[]) {
  const insertionGroups = groupJobsByCompany([...jobs].sort((a, b) => a.id - b.id).map((job) => ({ ...job, companyOrder: 0, jobOrder: 0 })));
  const savedGroups = groupJobsByCompany([...jobs].sort((a, b) => a.id - b.id));
  return savedGroups.some((group, index) => group.key !== insertionGroups[index]?.key ||
    group.jobs.some((job, jobIndex) => job.id !== insertionGroups[index]?.jobs[jobIndex]?.id));
}

/** Sorting is presentation-only until the existing reorder endpoint is called. */
export function orderJobGroups<T extends OrderableJob & { matchScore: number }>(jobs: T[], mode: JobOrderMode): CompanyJobGroup<T>[] {
  const groups = groupJobsByCompany([...jobs].sort((a, b) => a.id - b.id));
  if (mode === "custom") return groups;
  return groups.map((group) => ({ ...group, jobs: [...group.jobs].sort((a, b) => b.matchScore - a.matchScore || a.jobOrder - b.jobOrder || a.id - b.id) }))
    .sort((a, b) => (b.jobs[0]?.matchScore ?? 0) - (a.jobs[0]?.matchScore ?? 0) || a.companyOrder - b.companyOrder || a.firstIndex - b.firstIndex);
}
