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
  'getDefaultPrinter',
  'savePrinterProfile',
  'loadPrinterProfile'
]) {
  checkPattern(preload, new RegExp(`\\b${methodName}\\s*:`), `preload 保留打印契约 ${methodName}`);
}

const main = read('src/main.js');
const printConfig = read('src/print/config.js');
checkPattern(printConfig, /function\s+getDriverManagedDpiOptions\(\)\s*\{[\s\S]*?return\s+\{\};\s*\}/,
  '正式打印继续由驱动决定 DPI');
checkPattern(printConfig, /silentMarginsType:\s*0/, '正式打印保留系统默认边距策略');
checkPattern(printConfig, /hiddenWindowZoomFactor:\s*1\.0/, '隐藏打印窗口缩放保持 1.0');
checkPattern(main, /createSilentPrintOptions\(/, '主进程统一使用打印参数工厂');
checkPattern(main, /shouldSave/, '多页打印保留最后一页保存语义');

if (failures > 0) {
  console.error(`Print contract smoke failed: ${failures}`);
  process.exit(1);
}

console.log('Print contract smoke passed.');
