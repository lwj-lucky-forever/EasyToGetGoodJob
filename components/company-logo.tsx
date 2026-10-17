"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { companyLogoSrc } from "@/lib/company-logos";
import { cn } from "@/lib/utils";

/** Decorative next to a company name; unknown companies retain the generic icon. */
export function CompanyLogo({ company, className }: { company: string; className?: string }) {
  const src = companyLogoSrc(company);
  const [failedSrc, setFailedSrc] = useState<string>();
  return <span aria-hidden="true" className={cn("inline-grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-indigo-500 shadow-sm", className)}>
    {src && failedSrc !== src ?
      // Small local brand assets include ICO/SVG; preserve the original image format.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={32} height={32} className="size-full object-contain" onError={() => setFailedSrc(src)} /> :
      <Building2 className="size-full max-h-5 max-w-5" />}
  </span>;
}
