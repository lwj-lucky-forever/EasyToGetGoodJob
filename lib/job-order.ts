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
