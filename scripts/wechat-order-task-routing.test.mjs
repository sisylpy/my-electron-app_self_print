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
  /async function selectWechatImport\(token\)\s*\{.*?await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: false \}\);/s,
  '切换任务卡只能切换右侧任务，不能重新操作微信窗口'
);
assert.match(
  workbench,
  /async function removeWechatImport\(token\)\s*\{.*?await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: false \}\);/s,
  '移除当前任务后进入下一项时不能重新操作微信窗口'
);
assert.match(
  workbench,
  /async function handleTaskAdded\(change\)\s*\{.*?await openActiveWechatImport\(\{ openWorkspace: false, focusConversation: false \}\);/s,
  '保存当前任务后自动进入下一项时不能重新操作微信窗口'
);

const refreshAction = workbench.match(
  /async function refreshActiveWechatImport\(options = \{\}\) \{([\s\S]*?)\n\}\n\nfunction mergeActiveWechatImport/,
)?.[1] || '';
assert.match(
  refreshAction,
  /const markReadWarning = await focusWechatImportConversation\(item\)/,
  '手动取得新增消息后必须再次激活同一微信会话以清除未读状态'
);
assert.ok(
  refreshAction.indexOf('if (!result.payload)') < refreshAction.indexOf('const markReadWarning'),
  '只能在新增订单内容成功取得后标记微信会话为已读'
);

console.log('WeChat image/text task routing passed');
