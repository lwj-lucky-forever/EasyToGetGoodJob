const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 30;

export async function readResumePdf(file: File): Promise<string> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("请选择 PDF 格式的简历");
  }
  if (file.size > MAX_PDF_BYTES) throw new Error("PDF 请控制在 10 MB 以内");

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const documentTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
  let document: Awaited<typeof documentTask.promise>;
  try {
    document = await documentTask.promise;
  } catch {
    throw new Error("无法读取这个 PDF；如果文件已加密，请先导出未加密版本");
  }

  try {
    if (document.numPages > MAX_PDF_PAGES) throw new Error("简历 PDF 请控制在 30 页以内");
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const { items } = await page.getTextContent();
      const lines: string[] = [];
      let line = "";
      for (const item of items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) { lines.push(line.trim()); line = ""; }
      }
      if (line.trim()) lines.push(line.trim());
      pages.push(lines.filter(Boolean).join("\n"));
    }
    const content = pages.filter(Boolean).join("\n\n").trim();
    if (content.length < 20) throw new Error("这个 PDF 没有可读取的文字，可能是扫描图片；请使用可复制文字的 PDF，或手动粘贴简历文本");
    if (content.length > 50_000) throw new Error("提取的文字超过 5 万字，请精简 PDF 后重试");
    return content;
  } finally {
    await documentTask.destroy();
  }
}
