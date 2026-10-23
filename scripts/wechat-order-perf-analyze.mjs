#!/usr/bin/env node
/**
 * 微信订单读取性能分析脚本（Phase 2）
 *
 * 读取 GrainPrint 应用日志（userData/logs/app-*.log）中已有的
 * [wechat-order-timing] 计时记录，按 traceId 聚合每次完整读取操作，
 * 计算各阶段耗时、首屏可展示耗时、Reader 冷/热读取区别、请求次数，
 * 并导出 CSV 与归一化 JSONL。
 *
 * 不做任何业务改动；仅解析日志文件。
 *
 * 用法：
 *   node scripts/wechat-order-perf-analyze.mjs --log-dir <dir> [--out report.csv] [--jsonl perf.jsonl]
 *
 * 默认从 --log-dir 下所有 app-*.log 读取；未提供 --log-dir 时打印用法。
 * 注意：阶段（phase）在本系统中是“顺序相邻”的时间片（previousAt 推进），
 * 因此总耗时以 summary.totalMs 为准，绝不把各 phaseMs 简单相加当作总耗时。
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a.startsWith('--')) args.set(a.slice(2), process.argv[i + 1]);
}

const logDir = args.get('log-dir');
if (!logDir) {
  console.error('用法: node scripts/wechat-order-perf-analyze.mjs --log-dir <logs目录> [--out report.csv] [--jsonl perf.jsonl]');
  console.error('示例: node scripts/wechat-order-perf-analyze.mjs --log-dir "$HOME/Library/Application Support/GrainPrint/logs"');
  process.exit(2);
}

const outCsv = args.get('out') || 'wechat-order-perf-report.csv';
const outJsonl = args.get('jsonl') || 'wechat-order-perf.jsonl';

function listLogFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^app-.*\.log$/.test(f))
    .map((f) => join(dir, f))
    .sort();
}

/** 提取日志行末尾的 JSON meta（应用日志格式：... [scope] message {json}） */
function parseMeta(line) {
  const idx = line.indexOf('{');
  if (idx < 0) return null;
  try {
    return JSON.parse(line.slice(idx));
  } catch {
    return null;
  }
}

const files = listLogFiles(logDir);
if (!files.length) {
  console.error(`未在 ${logDir} 找到 app-*.log 文件`);
  process.exit(3);
}

const traces = new Map();
let phaseLineCount = 0;

// 单遍扫描：started 初始化、phase 行按序累积到 t.phases、summary 补充 outcome/totalMs。
// 不直接依赖 summary 里的 phases 数组，避免日志中 summary 未带 phases 时丢阶段。
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line.includes(' [wechat-order-timing] ')) continue;
    const meta = parseMeta(line);
    if (!meta || !meta.traceId) continue;
    if (!traces.has(meta.traceId)) {
      traces.set(meta.traceId, {
        traceId: meta.traceId,
        action: meta.action || '',
        outcome: '',
        totalMs: 0,
        phases: [],
        messageCount: 0,
        taskCount: undefined,
      });
    }
    const t = traces.get(meta.traceId);
    if (meta.action) t.action = meta.action;
    if (meta.stage) {
      phaseLineCount += 1;
      const entry = {
        stage: meta.stage,
        phaseMs: Number(meta.phaseMs) || 0,
        totalMs: Number(meta.totalMs) || 0,
        attempt: Number(meta.attempt) || 0,
        operationMs: meta.operationMs != null ? Number(meta.operationMs) : undefined,
        failed: Boolean(meta.failed),
        coldStart: meta.coldStart,
        coldStartMs: meta.coldStartMs,
        startRole: meta.startRole,
        startGeneration: meta.startGeneration,
        startGenerationDelta: meta.startGenerationDelta,
        truncated: meta.truncated,
      };
      // 通用搬运：把该阶段里所有「数值型」计数一并保留（完整性统计字段较多，
      // 逐个列举容易漏；这里只取数字，天然不会把消息文本带进来）。
      for (const [key, value] of Object.entries(meta)) {
        if (typeof value === 'number' && Number.isFinite(value)) entry[key] = value;
        else if (typeof value === 'boolean') entry[key] = value;
      }
      t.phases.push(entry);
      if (typeof meta.incomingCount === 'number') {
        t.messageCount = Math.max(t.messageCount, meta.incomingCount);
      }
    }
    if (meta.outcome) {
      t.outcome = meta.outcome;
      if (typeof meta.totalMs === 'number') t.totalMs = meta.totalMs;
      if (meta.taskCount != null) t.taskCount = meta.taskCount;
    }
  }
}

function phaseByStage(t, stage) {
  return (t.phases || []).find((p) => p.stage === stage);
}
function sumPhaseMs(t, stage) {
  return (t.phases || [])
    .filter((p) => p.stage === stage)
    .reduce((s, p) => s + (Number(p.phaseMs) || 0), 0);
}
function countPhase(t, stage) {
  return (t.phases || []).filter((p) => p.stage === stage).length;
}

/** 取某计数在所有阶段中的最大值（同一 trace 多轮读取时取最完整的一轮） */
function maxPhaseValue(t, key) {
  const values = (t.phases || [])
    .map((p) => p[key])
    .filter((v) => typeof v === 'number' && Number.isFinite(v));
  return values.length ? Math.max(...values) : 0;
}

/** 布尔型：任一阶段为真即为真（如 truncated 截断标记） */
function anyPhaseValue(t, key) {
  return (t.phases || []).some((p) => p[key] === true) ? 'true' : 'false';
}

function firstPaintMs(t) {
  const order = ['confirmation-page-visible', 'import-result', 'payload-build'];
  for (const stage of order) {
    const p = phaseByStage(t, stage);
    if (p && typeof p.totalMs === 'number') return p.totalMs;
  }
  const last = (t.phases || [])[ (t.phases || []).length - 1 ];
  return last && typeof last.totalMs === 'number' ? last.totalMs : t.totalMs;
}

const rows = [];
const jsonlRecords = [];
for (const t of traces.values()) {
  const cold = phaseByStage(t, 'reader-cold-start');
  const coldStart = Boolean(cold?.coldStart);
  const coldStartMs = Number(cold?.coldStartMs) || 0;
  const readerMessagesCount = countPhase(t, 'reader-messages');
  const readerMessagesMs = sumPhaseMs(t, 'reader-messages');
  const readerAttachmentsCount = countPhase(t, 'reader-attachments');
  const readerAttachmentsMs = sumPhaseMs(t, 'reader-attachments');
  const serverPrepareCount = countPhase(t, 'server-prepare-messages');
  const serverPrepareMs = sumPhaseMs(t, 'server-prepare-messages');
  const stabilityWaitCount = countPhase(t, 'reader-stability-wait');
  const stabilityWaitMs = sumPhaseMs(t, 'reader-stability-wait');
  const fp = firstPaintMs(t);

  const row = {
    traceId: t.traceId,
    operation: t.action,
    outcome: t.outcome,
    totalMs: Math.round(t.totalMs * 100) / 100,
    firstPaintMs: Math.round(fp * 100) / 100,
    readerColdStart: coldStart ? 'true' : 'false',
    readerStartRole: String(cold?.startRole || 'warm'),
    readerStartGenerationDelta: Number(cold?.startGenerationDelta) || 0,
    readerColdStartMs: Math.round(coldStartMs * 100) / 100,
    // ---- 完整性统计（全部为数量，不含任何消息内容）----
    rawMessageCount: maxPhaseValue(t, 'rawMessageCount'),
    selectedCount: maxPhaseValue(t, 'selectedCount'),
    excludedByType: maxPhaseValue(t, 'excludedByType'),
    excludedByUnreadable: maxPhaseValue(t, 'excludedByUnreadable'),
    excludedBySelf: maxPhaseValue(t, 'excludedBySelf'),
    excludedByMention: maxPhaseValue(t, 'excludedByMention'),
    excludedByUnparsableTime: maxPhaseValue(t, 'excludedByUnparsableTime'),
    pageFull: anyPhaseValue(t, 'pageFull'),
    pageLimit: maxPhaseValue(t, 'pageLimit'),
    oldestDeltaFromWindowStartMs: maxPhaseValue(t, 'oldestDeltaFromWindowStartMs'),
    newestGapToWindowEndMs: maxPhaseValue(t, 'newestGapToWindowEndMs'),
    submittedCount: maxPhaseValue(t, 'submittedCount'),
    serverPendingCount: maxPhaseValue(t, 'pendingCount'),
    serverProcessedCount: maxPhaseValue(t, 'processedCount'),
    pendingImageCount: maxPhaseValue(t, 'pendingImageCount'),
    imageSuccessCount: maxPhaseValue(t, 'imageSuccessCount'),
    imageDeferredCount: maxPhaseValue(t, 'imageDeferredCount'),
    imageFailedCount: maxPhaseValue(t, 'imageFailedCount'),
    confirmedMessageCount: maxPhaseValue(t, 'confirmedMessageCount'),
    readerMessagesCount,
    readerMessagesMs: Math.round(readerMessagesMs * 100) / 100,
    readerAttachmentsCount,
    readerAttachmentsMs: Math.round(readerAttachmentsMs * 100) / 100,
    serverPrepareCount,
    serverPrepareMs: Math.round(serverPrepareMs * 100) / 100,
    stabilityWaitCount,
    stabilityWaitMs: Math.round(stabilityWaitMs * 100) / 100,
    messageCount: t.messageCount,
  };
  rows.push(row);

  // 归一化 JSONL：每个阶段一条记录（统一性能日志格式）
  for (const p of (t.phases || [])) {
    jsonlRecords.push({
      traceId: t.traceId,
      operation: t.action,
      phase: p.stage,
      attempt: Number(p.attempt) || 0,
      durationMs: Math.round((Number(p.phaseMs) || 0) * 100) / 100,
      operationMs: p.operationMs != null ? Math.round(p.operationMs * 100) / 100 : undefined,
      totalMs: p.totalMs != null ? Math.round(p.totalMs * 100) / 100 : undefined,
      readerColdStart: coldStart,
      messageCount: t.messageCount,
      selectedCount: undefined,
      pendingCount: undefined,
      timestamp: '',
      errorCode: p.failed ? 'FAILED' : undefined,
    });
  }
}

// CSV 输出
const csvHeader = [
  'traceId', 'operation', 'outcome', 'totalMs', 'firstPaintMs',
  'readerColdStart', 'readerStartRole', 'readerStartGenerationDelta', 'readerColdStartMs',
  'readerMessagesCount', 'readerMessagesMs',
  'readerAttachmentsCount', 'readerAttachmentsMs',
  'serverPrepareCount', 'serverPrepareMs',
  'stabilityWaitCount', 'stabilityWaitMs', 'messageCount',
  // 完整性统计
  'rawMessageCount', 'selectedCount',
  'excludedByType', 'excludedByUnreadable', 'excludedBySelf',
  'excludedByMention', 'excludedByUnparsableTime',
  'pageFull', 'pageLimit', 'oldestDeltaFromWindowStartMs', 'newestGapToWindowEndMs',
  'submittedCount', 'serverPendingCount', 'serverProcessedCount',
  'pendingImageCount', 'imageSuccessCount', 'imageDeferredCount', 'imageFailedCount',
  'confirmedMessageCount',
];
const csvLines = [csvHeader.join(',')];
for (const r of rows) {
  csvLines.push(csvHeader.map((k) => {
    const v = r[k];
    if (v == null) return '';
    return typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v);
  }).join(','));
}
writeFileSync(outCsv, csvLines.join('\n') + '\n', 'utf8');
writeFileSync(outJsonl, jsonlRecords.map((r) => JSON.stringify(r)).join('\n') + (jsonlRecords.length ? '\n' : ''), 'utf8');

// 冷/热读取汇总
const coldRows = rows.filter((r) => r.readerColdStart === 'true');
const hotRows = rows.filter((r) => r.readerColdStart === 'false');
function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stats(arr, key) {
  if (!arr.length) return { n: 0, min: null, median: null, max: null, sum: null };
  const vals = arr.map((r) => r[key]).filter((v) => typeof v === 'number');
  return {
    n: vals.length,
    min: Math.round(Math.min(...vals) * 100) / 100,
    median: median(vals) != null ? Math.round(median(vals) * 100) / 100 : null,
    max: Math.round(Math.max(...vals) * 100) / 100,
    sum: Math.round(vals.reduce((s, v) => s + v, 0) * 100) / 100,
  };
}

console.log(`\n=== 微信订单读取性能分析 ===`);
console.log(`日志目录: ${logDir}`);
console.log(`扫描日志文件: ${files.length} 个 | phase 行: ${phaseLineCount} | 完整 trace: ${rows.length} 个`);
console.log(`CSV 已写出: ${outCsv}`);
console.log(`JSONL 已写出: ${outJsonl}`);
console.log(`\n--- 总耗时（totalMs, 来自 summary，非阶段相加）---`);
console.log('cold(冷启动):', JSON.stringify(stats(coldRows, 'totalMs')));
console.log('hot (热读取):', JSON.stringify(stats(hotRows, 'totalMs')));
console.log(`\n--- 首屏可展示耗时（firstPaintMs = confirmation-page-visible 等阶段 totalMs）---`);
console.log('cold:', JSON.stringify(stats(coldRows, 'firstPaintMs')));
console.log('hot :', JSON.stringify(stats(hotRows, 'firstPaintMs')));
console.log(`\n--- Reader 冷启动耗时（reader-cold-start.coldStartMs，仅 cold trace 有值）---`);
console.log('cold:', JSON.stringify(stats(coldRows, 'readerColdStartMs')));
console.log(`\n--- 服务器 prepareMessages 耗时 ---`);
console.log('cold:', JSON.stringify(stats(coldRows, 'serverPrepareMs')));
console.log('hot :', JSON.stringify(stats(hotRows, 'serverPrepareMs')));
console.log(`\n--- 等待微信消息稳定（reader-stability-wait，固定 650ms×次数）---`);
console.log('cold:', JSON.stringify(stats(coldRows, 'stabilityWaitMs')), 'count:', JSON.stringify(stats(coldRows, 'stabilityWaitCount')));
console.log('hot :', JSON.stringify(stats(hotRows, 'stabilityWaitMs')), 'count:', JSON.stringify(stats(hotRows, 'stabilityWaitCount')));
// 隐私护栏：性能记录只允许数量/耗时，绝不允许出现消息内容类字段。
const FORBIDDEN_KEYS = ['text', 'orderText', 'dataUrl', 'content', 'senderName', 'displayName'];
const violations = new Set();
for (const r of jsonlRecords) {
  for (const key of Object.keys(r)) {
    if (FORBIDDEN_KEYS.includes(key)) violations.add(key);
  }
}
console.log(`\n--- 隐私护栏 ---`);
console.log(violations.size
  ? `发现禁止字段（不应出现消息内容）：${Array.from(violations).join(', ')}`
  : 'OK：JSONL 中未出现消息文本/图片数据等隐私字段');

console.log(`\n--- 完整性统计（逐 trace，全部为数量）---`);
for (const r of rows) {
  console.log(
    `  ${r.traceId} [${r.operation}] raw=${r.rawMessageCount} selected=${r.selectedCount}`
    + ` submitted=${r.submittedCount} pending=${r.serverPendingCount} processed=${r.serverProcessedCount}`
    + ` img(pending/succ/defer/fail)=${r.pendingImageCount}/${r.imageSuccessCount}/${r.imageDeferredCount}/${r.imageFailedCount}`
    + ` confirmed=${r.confirmedMessageCount} pageFull=${r.pageFull} role=${r.readerStartRole}`
  );
}
console.log(`\n提示：rawMessageCount 是 Reader 返回条数；incomingCount/messageCount 是筛选后条数，`);
console.log(`二者不等是正常的。truncated=true 表示命中 200 条上限，该轮结果不完整。`);

console.log(`\n提示：弹窗在 importSelectedWechatConversation 的 finally（wechatSelectedImportBusy=false）关闭，`);
console.log(`首屏可展示（confirmation-page-visible）之后通常仅剩 2 帧 RAF（<32ms），如差值明显请检查 UI 渲染或截图时机。`);
