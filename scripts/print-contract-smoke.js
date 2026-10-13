const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
let failures = 0;

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function checkPattern(source, pattern, message) {
  if (pattern.test(source)) {
    console.log(`PASS ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

function checkAbsent(source, pattern, message) {
  if (!pattern.test(source)) {
    console.log(`PASS ${message}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

const templateContracts = [
  {
    profile: 'FULL_STANDARD',
    file: 'vue/src/components/Applys/ApplyPanel.vue',
    rows: 30,
    size: /size:\s*240mm\s+279mm/,
    wait: /physicalPrintTime\s*=\s*1500/
  },
  {
    profile: 'FULL_FIFTY',
    file: 'vue/src/components/Applys/ApplyFiftyPanel.vue',
    rows: 60,
    size: /size:\s*240mm\s+279mm/,
    wait: /physicalPrintTime\s*=\s*4000/
  },
  {
    profile: 'HALF_WHOLE',
    file: 'vue/src/components/Applys/ApplyHalfWholePanel.vue',
    rows: 12,
    size: /size:\s*240mm\s+140mm/,
    wait: /walkTime\s*=\s*400/
  },
  {
    profile: 'HALF_STANDARD',
    file: 'vue/src/components/Applys/ApplyHalfPanel.vue',
    rows: 26,
    size: /size:\s*240mm\s+140mm/,
    wait: /walkTime\s*=\s*400/
  },
  {
    profile: 'THIRD_WHOLE',
    file: 'vue/src/components/Applys/ApplyThirtyWholePanel.vue',
    rows: 5,
    size: /size:\s*240mm\s+93mm/,
    wait: /walkTime\s*=\s*400/,
    legacyWidth: /physicalPageWidth\s*=\s*241/
  },
  {
    profile: 'THIRD_STANDARD',
    file: 'vue/src/components/Applys/ApplyThirtyPanel.vue',
    rows: 12,
    size: /size:\s*240mm\s+93mm/,
    wait: /walkTime\s*=\s*400/
  }
];

const paperProfiles = read('vue/src/modules/print/config/paperProfiles.js');
for (const contract of templateContracts) {
  const source = read(contract.file);
  const label = path.basename(contract.file);
  checkPattern(source, new RegExp(`pageRowsCount:\\s*${contract.rows}\\b`), `${label} 分页行数保持 ${contract.rows}`);
  checkPattern(source, contract.size, `${label} 纸张尺寸保持现场值`);
  checkPattern(source, contract.wait, `${label} 逐页走纸等待保持现场值`);
  checkPattern(
    source,
    /\.footerPage\s+\.summary\s+\.text-right\s*\{[\s\S]*?width:\s*100%;[\s\S]*?text-align:\s*right;/,
    `${label} 预览合计金额保持整行右对齐`
  );
  checkPattern(source, /['"]orderIds['"][\s\S]*?this\.orderIds/,
    `${label} 支持仅保存订单列表中勾选的打印任务`);
  if (contract.legacyWidth) {
    checkPattern(source, contract.legacyWidth, `${label} 保留 241mm 历史兼容宽度`);
  }
  checkPattern(
    paperProfiles,
    new RegExp(`${contract.profile}:[\\s\\S]*?pageRowsCount:\\s*${contract.rows}\\b`),
    `${label} 已登记到集中纸型合同`
  );
}

const preload = read('src/preload.js');
for (const methodName of [
  'sendPrintRequest',
  'sendPrintRequestGb',
  'sendPrintRequestGbBatch',
  'sendPrintRequestWithCallback',
  'sendPrintRequestGbWithCallback',
  'sendPrintRequestGbBatchWithCallback',
  'sendPrintCalibrationPage',
  'previewReturnDocument',
  'printReturnDocument',
  'getDefaultPrinter',
  'savePrinterProfile',
  'loadPrinterProfile'
]) {
  checkPattern(preload, new RegExp(`\\b${methodName}\\s*:`), `preload 保留打印契约 ${methodName}`);
}

const main = read('src/main.js');
const printConfig = read('src/print/config.js');
const returnTemplate = read('vue/src/modules/returns/services/returnDocumentTemplate.js');
const returnWorkbench = read('vue/src/modules/returns/views/ReturnPrintWorkbench.vue');
const deliveryPrintTemplateRegistry = read('vue/src/modules/print/services/deliveryPrintTemplateRegistry.js');
const todayOrders = read('vue/src/components/TodayOrders.vue');
const bills = read('vue/src/views/Bills.vue');
const orderFlowInbox = read('vue/src/modules/order/components/workbench/OrderFlowInbox.vue');
const returnPrintHandlerStart = main.indexOf("ipcMain.handle('print-return-document'");
const returnPrintHandlerEnd = main.indexOf('\n}\n\nasync function createWindow', returnPrintHandlerStart);
const returnPrintHandler = returnPrintHandlerStart >= 0 && returnPrintHandlerEnd > returnPrintHandlerStart
  ? main.slice(returnPrintHandlerStart, returnPrintHandlerEnd)
  : '';
checkPattern(printConfig, /function\s+getDriverManagedDpiOptions\(\)\s*\{[\s\S]*?return\s+\{\};\s*\}/,
  '正式打印继续由驱动决定 DPI');
checkPattern(printConfig, /silentMarginsType:\s*0/, '正式打印保留系统默认边距策略');
checkPattern(printConfig, /hiddenWindowZoomFactor:\s*1\.0/, '隐藏打印窗口缩放保持 1.0');
checkPattern(main, /createSilentPrintOptions\(/, '主进程统一使用打印参数工厂');
checkPattern(main, /shouldSave/, '多页打印保留最后一页保存语义');
checkPattern(main, /await\s+requestPrintedOrderSave\(/, '打印成功回执会等待订单保存完成');
checkPattern(main, /assertSuccessfulWriteResponse\(response,\s*'订单保存'\)/,
  '订单保存会校验 HTTP 200 内的业务错误码');
checkPattern(main, /saveFailed:\s*true/, '订单保存失败会回传给打印页面');
checkPattern(main, /retryable:\s*!printed/, '订单已出纸但保存失败时不会提示重复打印');
checkPattern(main, /ipcMain\.handle\('preview-return-document'/, '退货单预览使用桌面主进程受控窗口');
checkPattern(main, /previewWindow\.webContents\.setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/,
  '退货单预览窗口继续禁止派生弹窗');
checkPattern(
  returnPrintHandler,
  /printContentToWindowWithCallback\([\s\S]*?'return-document'[\s\S]*?false,[\s\S]*?true,[\s\S]*?\[\],[\s\S]*?pageSize/,
  '退货单复用配送单正式打印链路，不再单独调用驱动'
);
checkAbsent(
  returnPrintHandler,
  /webContents\.print\(|includeLegacyMargins/,
  '退货单 IPC 入口不再维护独立方向或边距参数'
);
checkPattern(
  main,
  /resolve\(\{[\s\S]*?printerName:\s*finalPrinterName\s*\|\|\s*defaultPrinter\s*\|\|\s*''[\s\S]*?\}\)/,
  '配送单共享打印链路返回驱动实际使用的打印机名称'
);
checkPattern(returnTemplate, /PAPER_PROFILES\.FULL_STANDARD/, '退货单复用全张纸型合同');
checkPattern(returnTemplate, /PAPER_PROFILES\.HALF_WHOLE/, '退货单复用半张纸型合同');
checkPattern(returnTemplate, /PAPER_PROFILES\.THIRD_WHOLE/, '退货单复用三分之一张纸型合同');
checkPattern(returnTemplate, /columns:\s*1/, '退货单保留客户一列布局');
checkPattern(returnTemplate, /columns:\s*2/, '退货单保留客户两列布局');
checkPattern(returnTemplate, /customerPrintName/, '退货单按客户打印格式选择纸型');
checkPattern(returnTemplate, /@page\{size:\$\{profile\.widthMm\}mm \$\{profile\.heightMm\}mm/, '退货单不再写死 A4');
checkPattern(returnTemplate, /data-print-width-mm="\$\{profile\.widthMm\}"/, '退货单把物理纸宽传给 Windows 打印通道');
checkPattern(returnTemplate, /data-print-height-mm="\$\{profile\.heightMm\}"/, '退货单把物理纸高传给 Windows 打印通道');
checkPattern(printConfig, /printOptions\.pageSize\s*=\s*\{/, '静默打印支持显式连续纸尺寸');
checkPattern(
  returnWorkbench,
  /const preparedHtml = await documentHtml\(await payloadFor\(job\)\);[\s\S]*?retryPrint[\s\S]*?printJob\([^\n]*preparedHtml\)/,
  '审核重打在状态变化前固定同一份打印 HTML'
);
checkPattern(returnTemplate, /loadPrinterProfile|printerProfile/, '退货单模板支持复用打印中心现场校准参数');
checkPattern(returnTemplate, /border:2px solid #000/, '退货单使用适合针式打印的纯黑加粗主边框');
checkPattern(returnTemplate, /@page\{size:\$\{profile\.widthMm\}mm \$\{profile\.heightMm\}mm;margin:0\}/,
  '退货单使用零页边距并在模板内复用打印中心安全边距');
checkPattern(
  deliveryPrintTemplateRegistry,
  /ApplyPanel:[\s\S]*?ApplyFiftyPanel:[\s\S]*?ApplyHalfPanel:[\s\S]*?ApplyHalfWholePanel:[\s\S]*?ApplyThirtyPanel:[\s\S]*?ApplyThirtyWholePanel:/,
  '配送单六种客户打印格式由统一注册表维护'
);
checkPattern(todayOrders, /DELIVERY_PRINT_TEMPLATE_LOADERS as applyComponentMap/,
  '订单列表批量打印复用打印中心模板注册表');
checkPattern(bills, /DELIVERY_PRINT_TEMPLATE_LOADERS as applyComponentMap/,
  '打印中心复用统一模板注册表');
checkPattern(orderFlowInbox, /v-else-if="stageFilter === 'progress' \|\| stageFilter === 'price'"[\s\S]*?<div v-else class="order-flow__workspace is-orders">[\s\S]*?batch-print-mode/,
  '全部和可打印订单列表恢复选择后生成打印模式');
checkPattern(todayOrders, /v-if="batchPrintMode"[\s\S]*?:disabled="!isPrintableOrder\(order\)"/,
  '订单列表为不可打印订单显示禁用选择框');
checkPattern(todayOrders, /printComponentProps = \{[\s\S]*?depPrintName: this\.effectiveDepPrintName[\s\S]*?orderIds:/,
  '订单列表按客户打印格式和选中订单生成配送单');

if (failures > 0) {
  console.error(`Print contract smoke failed: ${failures}`);
  process.exit(1);
}

console.log('Print contract smoke passed.');
