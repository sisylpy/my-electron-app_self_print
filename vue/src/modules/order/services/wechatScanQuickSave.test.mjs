import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workbench = await readFile(new URL('../views/OrderWorkbenchV2.vue', import.meta.url), 'utf8');
const modal = await readFile(new URL('../components/workbench/WechatOrderImportModal.vue', import.meta.url), 'utf8');
const panel = await readFile(new URL('../components/workbench/AiOrderPanel.vue', import.meta.url), 'utf8');

const quickSave = workbench.match(
  /async function saveWechatScanResult\(token\) \{[\s\S]*?\n\}\n\nasync function previewWechatScanImage/,
)?.[0] || '';
assert.match(quickSave, /reportItem\?\.saveReady/);
assert.match(quickSave, /task\?\.taskType !== 'text'/);
assert.match(quickSave, /runWechatImportAndSave/);
assert.match(quickSave, /await removeWechatImport\(normalizedToken\)/);

assert.match(modal, /v-if="!busy && item\.saveReady && !item\.saved"/);
assert.match(modal, /\$emit\('save-scan-result', item\.saveToken\)/);
assert.match(modal, /微信内容：\{\{ item\.textPreview \}\}/);
assert.match(modal, /v-if="item\.imagePreviews\?\.length"/);
assert.match(modal, /\$emit\('preview-scan-image', image\.token\)/);

const imagePreview = workbench.match(
  /async function previewWechatScanImage\(token\) \{[\s\S]*?\n\}\n\nfunction updateWechatScanResult/,
)?.[0] || '';
assert.match(imagePreview, /item\?\.taskType === 'image'/);
assert.match(imagePreview, /focusConversation: false/);
assert.match(imagePreview, /panel\.previewWechatImport\(task\.payload\)/);
assert.match(workbench, /imagePreviews: Array\.isArray\(result\?\.imagePreviews\)/);
assert.match(panel, /async function previewWechatImport\(payload\)/);
assert.match(panel, /defineExpose\(\{ dismissPendingWechatImport, previewWechatImport, runWechatImportAndSave \}\)/);

assert.match(panel, /suspendWechatImport/);
assert.match(panel, /if \(props\.batchSaveMode \|\| suspended\) return/);

console.log('WeChat scan quick-save wiring passed');
