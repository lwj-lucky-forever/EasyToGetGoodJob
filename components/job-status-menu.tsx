"use client";

import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { JOB_STATUSES, jobStatusLabel, type JobStatus } from "@/lib/job-status";
import { cn } from "@/lib/utils";

export function JobStatusMenu({ value, onValueChange, label = "更新岗位状态", className }: {
  value: JobStatus; onValueChange: (value: JobStatus) => void; label?: string; className?: string;
}) {
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label={`${label}：${jobStatusLabel(value)}`} title="点击更新状态" className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-slate-200/70 bg-slate-50 px-2 text-[11px] font-medium text-slate-500 transition-colors duration-150 hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400", className)}>
        {jobStatusLabel(value)}<ChevronDown className="size-3" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-36 rounded-xl p-1.5">
      <DropdownMenuRadioGroup value={value} onValueChange={(next) => onValueChange(next as JobStatus)}>
        {JOB_STATUSES.map((status) => <DropdownMenuRadioItem key={status} value={status} className="rounded-lg py-2">{jobStatusLabel(status)}</DropdownMenuRadioItem>)}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}
