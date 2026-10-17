import type { ExtractedWebJob } from "../job-web-extract.ts";
import type { WebFetch } from "../job-web-fetch.ts";

export type JobAdapterContext = {
  url: URL;
  html?: string;
  /** Anonymous cookies obtained from this exact page host, never user credentials. */
  sessionCookie?: string;
  fetcher: WebFetch;
  stage: "embedded" | "api";
};

/** Return null when this stage has no usable data; throw on a definitive error. */
export type JobWebAdapter = {
  id: string;
  canHandle: (url: URL) => boolean;
  parse: (context: JobAdapterContext) => Promise<ExtractedWebJob | null>;
};
