import { baiduAdapter } from "./baidu.ts";
import { feishuAdapter } from "./feishu.ts";
import { meituanAdapter } from "./meituan.ts";
import { mokaAdapter } from "./moka.ts";
import { xiaohongshuAdapter } from "./xiaohongshu.ts";
import { alibabaAdapter } from "./alibaba.ts";
import type { JobWebAdapter } from "./types.ts";

// Add a module and one registration here. The import pipeline needs no edits.
export const JOB_WEB_ADAPTERS: readonly JobWebAdapter[] = [baiduAdapter, feishuAdapter, meituanAdapter, mokaAdapter, xiaohongshuAdapter, alibabaAdapter];
