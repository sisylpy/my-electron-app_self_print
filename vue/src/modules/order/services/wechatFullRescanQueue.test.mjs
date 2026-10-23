import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modal = await readFile(
  new URL('../components/workbench/WechatOrderImportModal.vue', import.meta.url),
  'utf8',
);
const workbench = await readFile(
  new URL('../views/OrderWorkbenchV2.vue', import.meta.url),
  'utf8',
);

assert.match(workbench, /@scan-all="requestWechatFullRescan"/);
assert.match(modal, /busy \? '完成后再查一次' : '重新检查全部'/);
assert.match(modal, /:disabled="refreshing \|\| selectedImportBusy"/);
assert.match(workbench, /const wechatScanRerunRequested = ref\(false\)/);
assert.match(workbench, /function requestWechatFullRescan\(\)/);
assert.match(workbench, /wechatScanRerunRequested\.value = true/);
assert.match(workbench, /本轮结束后会自动再检查一遍/);

const scanAction = workbench.match(
  /async function scanAllBoundWechatOrders\(options = \{\}\) \{([\s\S]*?)\n\}\n\nfunction requestWechatFullRescan/,
)?.[1] || '';
assert.match(scanAction, /reportMcpWechatScanResult\(timingOutcome, timingSummary\)/);
assert.match(scanAction, /wechatScanBusy\.value = false/);
assert.match(scanAction, /if \(wechatScanRerunRequested\.value\)/);
assert.ok(
  scanAction.indexOf('reportMcpWechatScanResult(timingOutcome, timingSummary)')
    < scanAction.indexOf('wechatScanBusy.value = false'),
  'the UI must stay busy until scan finalization is complete',
);

console.log('wechat full rescan queue tests passed');
