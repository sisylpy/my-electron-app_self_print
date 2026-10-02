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

console.log('WeChat image/text task routing passed');
