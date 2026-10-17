import { notFound } from "next/navigation";
import JobWorkspace from "@/components/job-workspace";
import { findPipelineStage } from "@/lib/pipeline-stages";

export default async function PipelineStagePage({ params }: { params: Promise<{ stage: string }> }) {
  const stage = findPipelineStage((await params).stage);
  if (!stage) notFound();
  return <JobWorkspace initialView="求职进度" pipelineStage={stage.slug} />;
}
