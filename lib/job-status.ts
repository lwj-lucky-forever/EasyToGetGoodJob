// Preserve stored/API values so existing jobs and backups need no migration.
export const JOB_STATUSES = ["未投递", "准备中", "已投递", "笔试", "面试", "Offer", "暂停"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const PIPELINE_STATUSES = JOB_STATUSES.slice(0, 6);
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  未投递: "待投递", 准备中: "准备中", 已投递: "已投递", 笔试: "笔试", 面试: "面试", Offer: "Offer", 暂停: "未通过",
};
export function jobStatusLabel(status: JobStatus) {
  return JOB_STATUS_LABELS[status];
}
