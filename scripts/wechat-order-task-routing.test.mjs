import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = relativePath => readFileSync(resolve(root, relativePath), 'utf8');

const source = read('vue/src/modules/order/components/workbench/WechatOrderSource.vue');
const controller = read('vue/src/modules/order/services/placeOrderController.js');
const panel = read('vue/src/modules/order/components/workbench/AiOrderPanel.vue');
const workbench = read('vue/src/modules/order/views/OrderWorkbenchV2.vue');
const modal = read('vue/src/modules/order/components/workbench/WechatOrderImportModal.vue');

assert.match(
  source,
  /emit\('messages-loaded',\s*\{\s*tasks:/s,
  '微信读取组件必须把已拆分任务交给上层，而不是直接混合导入'
);
assert.match(
  controller,
  /'wechat-tasks-loaded'/,
  '订单录入区必须公开微信任务事件'
);
assert.match(
  controller,
  /this\.\$emit\('wechat-tasks-loaded',\s*\{\s*tasks,/s,
  '订单录入区必须把所有拆分任务转交给工作台'
);
assert.match(
  panel,
  /@wechat-tasks-loaded="handleWechatTasksLoaded"/,
  '订单面板必须接收微信任务事件'
);
assert.match(
  panel,
  /emit\('wechat-tasks-loaded',\s*\{/s,
  '订单面板必须把微信任务传递给工作台'
);
assert.match(
  workbench,
  /@wechat-tasks-loaded="handleDirectWechatTasks"/,
  '工作台必须接收直接微信读取任务'
);
assert.match(
  workbench,
  /createWechatImportItemsFromTasks\(row, conversationTitle, tasks,/,
  '工作台必须直接使用已拆分任务创建任务卡'
);
assert.match(
  workbench,
  /enqueueWechatImportItems\(imports\)/,
  '工作台必须把直接读取的任务放入统一可切换队列'
);

assert.match(
  workbench,
  /async function selectWechatImport\(token\)\s*\{.*?await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: true \}\);/s,
  '切换任务卡时必须同步选中左侧微信会话'
);
assert.match(
  workbench,
  /async function removeWechatImport\(token\)\s*\{.*?await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: true \}\);/s,
  '移除当前任务后必须同步选中下一项对应的微信会话'
);
assert.match(
  modal,
  /v-if="activeItem\.taskType !== 'image'"[\s\S]*?获取新消息/,
  '图片识别任务不能显示仅适用于微信文字会话的“获取新消息”按钮'
);
assert.match(
  modal,
  /@click\.stop\.prevent="removeItem\(activeItem\)"/,
  '移除任务按钮必须独立消费点击，不能误触发图片内容区'
);
assert.match(
  workbench,
  /activeWechatImportPanelRef\.value\?\.dismissPendingWechatImport\?\.\(\)/,
  '移除当前任务前必须关闭并取消该任务的图片预览'
);
assert.match(
  controller,
  /if \(requestId !== null && !this\.isCurrentWechatOrderLoad\(requestId\)\) return;\s*this\.showImagePreviewModal = true;/,
  '已经失效的微信图片任务不能再次打开预览弹窗'
);
assert.match(
  modal,
  /taskLabel\(item\)/,
  '任务卡必须标明文字或图片任务，删除后切换下一项时不产生误解'
);
assert.match(
  workbench,
  /async function handleTaskAdded\(change\)\s*\{.*?await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: true \}\);/s,
  '保存当前任务后必须同步选中下一项对应的微信会话'
);

const refreshAction = workbench.match(
  /async function refreshActiveWechatImport\(options = \{\}\) \{([\s\S]*?)\n\}\n\nfunction mergeActiveWechatImport/,
)?.[1] || '';
assert.match(
  refreshAction,
  /const markReadWarning = await timeWechatOrderPhase\([\s\S]*?\(\) => focusWechatImportConversation\(item\)/,
  '手动取得新增消息后必须再次激活同一微信会话以清除未读状态'
);
assert.ok(
  refreshAction.indexOf('if (!result.payload)') < refreshAction.indexOf('const markReadWarning'),
  '只能在新增订单内容成功取得后标记微信会话为已读'
);

console.log('WeChat image/text task routing passed');
