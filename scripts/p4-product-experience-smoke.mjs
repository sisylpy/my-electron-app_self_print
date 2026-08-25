import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireVue = createRequire(path.join(root, 'vue', 'package.json'));

async function importStandaloneModule(relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(url);
}

function measure(label, operation) {
  const start = performance.now();
  const result = operation();
  return { label, durationMs: performance.now() - start, result };
}

function report(metric, thresholdMs) {
  assert.ok(
    metric.durationMs < thresholdMs,
    `${metric.label} 超时：${metric.durationMs.toFixed(1)}ms >= ${thresholdMs}ms`
  );
  console.log(`PASS ${metric.label}: ${metric.durationMs.toFixed(1)}ms`);
}

const originalLog = console.log;
const parser = await importStandaloneModule('vue/src/utils/pasteOrderParser.js');
const largeOrderText = Array.from(
  { length: 5000 },
  (_, index) => `商品${index + 1} ${(index % 20) + 1}斤`
).join('\n');

console.log = () => {};
const orderMetric = measure('5000行订单本地解析', () => parser.parseOrderFromText(
  largeOrderText,
  { depId: 1, depFatherId: 1, disId: 1, userId: 1 }
));
console.log = originalLog;
assert.equal(orderMetric.result.orders.length, 5000);
report(orderMetric, 1500);

const XLSX = requireVue('xlsx');
const excelRows = [
  ['商品名称', '数量', '规格', '备注'],
  ...Array.from({ length: 5000 }, (_, index) => [
    `商品${index + 1}`,
    (index % 20) + 1,
    '斤',
    index % 10 === 0 ? '测试备注' : '',
  ]),
];
const excelMetric = measure('5000行 Excel 生成与读取', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(excelRows), '订单');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const parsedWorkbook = XLSX.read(buffer, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(parsedWorkbook.Sheets['订单'], { defval: null });
});
assert.equal(excelMetric.result.length, 5000);
report(excelMetric, 2500);

const readModel = await importStandaloneModule(
  'vue/src/modules/dispatch/services/readModel.js'
);
function makePage(phase, totalStops, idOffset = 0) {
  const routeCount = 25;
  const cards = Array.from({ length: routeCount }, (_, routeIndex) => ({
    cardType: 'DRIVER_ROUTE',
    driverUserId: routeIndex + 1,
    driverName: `司机${routeIndex + 1}`,
    timeline: Array.from(
      { length: Math.ceil(totalStops / routeCount) },
      (_, stopIndex) => {
        const ordinal = routeIndex * Math.ceil(totalStops / routeCount) + stopIndex + 1;
        const id = idOffset + ordinal;
        return ordinal > totalStops ? null : {
          type: 'stop',
          taskId: id,
          depFatherId: id,
          customerName: `${phase}客户${id}`,
          taskVersion: 1,
          liveOrderIds: [id],
        };
      }
    ).filter(Boolean),
  }));
  return { sections: [{ cards }] };
}

const dispatchSnapshots = {
  dispatch: { pageViewModel: makePage('待派', 2000, 0) },
  loading: { pageViewModel: makePage('装车', 1500, 2000) },
  delivery: { pageViewModel: makePage('配送', 1500, 3500) },
};
const dispatchMetric = measure('5000站点调度读模型转换', () => (
  readModel.buildOrderCollections(dispatchSnapshots, [])
));
assert.equal(dispatchMetric.result.today.length, 5000);
report(dispatchMetric, 500);

const driverMetric = measure('500司机状态合并', () => readModel.buildDriverRows({
  driverCards: Array.from({ length: 500 }, (_, index) => ({
    driverUserId: index + 1,
    driverName: `司机${index + 1}`,
    dutyStatus: index % 2 === 0 ? 'ON_DUTY' : 'OFF_DUTY',
  })),
}, dispatchSnapshots));
assert.equal(driverMetric.result.length, 500);
report(driverMetric, 200);

const writeContract = await importStandaloneModule(
  'vue/src/modules/dispatch/services/writeContract.js'
);
const assignPayload = writeContract.buildAssignDriverPayload({
  stop: {
    taskId: 10,
    depFatherId: 20,
    sandboxStopKey: 'sandbox:20',
    taskVersion: 3,
    liveOrderIds: [1, 2, 2],
  },
  driver: { driverUserId: 30 },
  targetRoute: { routeVersion: 4, _stops: [] },
  routeDate: '2026-07-30',
  batchCode: 'MORNING',
});
assert.equal(assignPayload.expectedTaskVersion, 3);
assert.equal(assignPayload.expectedRouteVersion, 4);
assert.ok(!('disId' in assignPayload));
assert.ok(!('operatorUserId' in assignPayload));
for (const status of [401, 403, 409, 422]) {
  assert.ok(writeContract.dispatchErrorPresentation({ status }).message);
}
console.log('PASS 派单写合同、版本字段及 401/403/409/422 反馈');

let voiceStarts = 0;
let voiceStops = 0;
let voiceCleanups = 0;
globalThis.window = {
  electronAPI: {
    startVoiceRecognition: async () => { voiceStarts += 1; return { success: true }; },
    stopVoiceRecognition: async () => { voiceStops += 1; return { success: true }; },
    textToSpeech: async () => ({ success: true }),
    onVoiceRecognitionResult: () => () => { voiceCleanups += 1; },
    onVoiceRecognitionError: () => () => { voiceCleanups += 1; },
    onTTSResult: () => () => { voiceCleanups += 1; },
    onTTSError: () => () => { voiceCleanups += 1; },
  },
};
const voiceService = await importStandaloneModule(
  'vue/src/modules/order/services/voiceInputService.js'
);
assert.equal(voiceService.isVoiceRuntimeAvailable(), true);
await voiceService.startVoiceRecognition();
await voiceService.stopVoiceRecognition();
const voiceSubscriptions = voiceService.subscribeVoiceEvents({});
voiceService.disposeVoiceSubscriptions(voiceSubscriptions);
assert.equal(voiceStarts, 1);
assert.equal(voiceStops, 1);
assert.equal(voiceCleanups, 4);
delete globalThis.window;
console.log('PASS 语音录单启动、停止和监听清理合同');

const {
  PRINT_RUNTIME_CONFIG,
  createSilentPrintOptions,
} = require('../src/print/config.js');
const { assertPrintMetadata } = require('../src/print/validation.js');
const printOptions = createSilentPrintOptions('EPSON_LQ_730K');
assert.equal(printOptions.deviceName, 'EPSON_LQ_730K');
assert.equal(printOptions.marginsType, 0);
assert.equal(PRINT_RUNTIME_CONFIG.hiddenWindowZoomFactor, 1);
assert.ok(!('dpi' in printOptions));
assert.doesNotThrow(() => assertPrintMetadata({
  depFatherId: 1,
  depId: 2,
  tradeNo: 'P4-TEST',
  userId: 3,
  paperCount: 6,
  shouldSave: false,
}));
assert.throws(() => assertPrintMetadata({ paperCount: 10001 }));
console.log('PASS Epson 驱动 DPI、边距和打印参数校验合同');

const mcpPush = require('../src/mcp-print-push.js');
const sends = [];
const mockWebContents = {
  id: 901,
  isDestroyed: () => false,
  send: (channel, task) => sends.push({ channel, taskId: task.taskId }),
};
const queueMetric = measure('1000个 MCP 打印任务投递与回执', () => {
  for (let taskId = 1; taskId <= 1000; taskId += 1) {
    assert.equal(mcpPush.pushMcpPrintTaskToRenderer(mockWebContents, {
      taskId,
      type: 'nx_delivery',
    }), true);
    assert.equal(mcpPush.acknowledgeMcpPrintTask(mockWebContents.id, taskId), true);
  }
});
assert.equal(sends.length, 1000);
report(queueMetric, 500);

const appSource = fs.readFileSync(path.join(root, 'vue/src/App.vue'), 'utf8');
assert.match(
  appSource,
  /ENQUEUE_MCP_PRINT_TASK[\s\S]*DispatchWorkbench[\s\S]*return;[\s\S]*this\.\$route\.name !== 'Bills'/
);
console.log('PASS MCP 在派单页只入队，不抢占工作区');

const heapUsedMb = process.memoryUsage().heapUsed / 1024 / 1024;
assert.ok(heapUsedMb < 512, `压力测试堆内存过高：${heapUsedMb.toFixed(1)}MB`);
console.log(`PASS 压力测试进程堆内存: ${heapUsedMb.toFixed(1)}MB`);
console.log('P4 product experience smoke passed.');
