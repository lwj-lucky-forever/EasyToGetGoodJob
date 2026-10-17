"use client";

import { ArrowDown, ArrowUp, ClipboardCheck, ExternalLink, FileText, MoreHorizontal, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function JobCardActions({ role, sourceUrl, onDetail, onPrepare, onProcess, onEdit, onDelete, onMoveUp, onMoveDown, canMoveUp, canMoveDown, preparationLabel, processLabel, preparationCount, processCount }: {
  role: string; sourceUrl: string; onDetail: () => void; onPrepare: () => void; onProcess: () => void; onEdit: () => void; onDelete: () => void;
  onMoveUp: () => void; onMoveDown: () => void; canMoveUp: boolean; canMoveDown: boolean; preparationLabel: string; processLabel: string;
  preparationCount?: string; processCount?: number;
}) {
  return <div className="flex h-13 shrink-0 items-center justify-between gap-1 border-t border-slate-100/80 bg-gradient-to-b from-white to-slate-50/80 px-2.5">
    <div className="flex min-w-0 items-center gap-0.5">
      <Button variant="ghost" size="xs" onClick={onDetail} className="h-7 gap-1 rounded-md px-1.5 font-normal text-slate-500 hover:bg-indigo-50/70 hover:text-indigo-600"><FileText className="size-3.5" />详情</Button>
      <Button variant="ghost" size="xs" onClick={onPrepare} title={preparationLabel} className="h-7 gap-1 rounded-md px-1.5 font-normal text-slate-500 hover:bg-indigo-50/70 hover:text-indigo-600"><ClipboardCheck className="size-3.5" /><span>准备{preparationCount !== undefined && <span className="ml-1 tabular-nums text-slate-400">{preparationCount}</span>}</span></Button>
      <Button variant="ghost" size="xs" onClick={onProcess} title={processLabel} className="h-7 gap-1 rounded-md px-1.5 font-normal text-slate-500 hover:bg-indigo-50/70 hover:text-indigo-600"><NotebookPen className="size-3.5" /><span>流程{processCount !== undefined && <span className="ml-1 tabular-nums text-slate-400">{processCount}</span>}</span></Button>
    </div>
    <div className="ml-auto flex shrink-0 items-center gap-0.5 border-l border-slate-100 pl-2">
      <Button variant="ghost" size="icon-sm" onClick={onEdit} title="编辑岗位" aria-label={`编辑${role}`} className="size-7 rounded-md text-slate-400 hover:bg-indigo-50/70 hover:text-indigo-600"><Pencil className="size-3.5" /></Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`${role}的更多操作`} title="更多操作" className="size-7 rounded-md text-slate-400 hover:bg-indigo-50/70 hover:text-indigo-600"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36 rounded-lg border-slate-200/80 p-1.5 text-slate-600 shadow-md shadow-slate-900/5">
          <DropdownMenuItem onSelect={onMoveUp} disabled={!canMoveUp} className="rounded-lg"><ArrowUp className="size-4" />上移</DropdownMenuItem>
          <DropdownMenuItem onSelect={onMoveDown} disabled={!canMoveDown} className="rounded-lg"><ArrowDown className="size-4" />下移</DropdownMenuItem>
          {sourceUrl ? <DropdownMenuItem asChild className="rounded-lg"><a href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink className="size-4" />打开原链接</a></DropdownMenuItem> : <DropdownMenuItem disabled className="rounded-lg"><ExternalLink className="size-4" />打开原链接</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} variant="destructive" className="rounded-lg text-rose-600"><Trash2 className="size-4" />删除</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>;
}
