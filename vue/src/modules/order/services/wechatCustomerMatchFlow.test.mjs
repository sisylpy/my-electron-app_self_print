import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const modalSource = await readFile(
  new URL('../components/workbench/WechatOrderImportModal.vue', import.meta.url),
  'utf8',
);
const workbenchSource = await readFile(
  new URL('../views/OrderWorkbenchV2.vue', import.meta.url),
  'utf8',
);

assert.match(modalSource, /确认这个微信名称的类型/);
assert.match(modalSource, />微信好友</);
assert.match(modalSource, />微信群</);
assert.match(modalSource, />专属群</);
assert.match(modalSource, />混合群</);
assert.match(modalSource, /!customerMatchSelectionValid/);
assert.match(modalSource, /conversationKind: selectedMatchConversationKind\.value/);
assert.match(modalSource, /groupMode: selectedMatchConversationKind\.value === CONVERSATION_GROUP/);

assert.match(workbenchSource, /请选择微信好友或微信群/);
assert.match(workbenchSource, /请选择微信群是专属群还是混合群/);
assert.match(workbenchSource, /requestedConversationKind: profile\.conversationKind/);
assert.match(workbenchSource, /requestedGroupMode: profile\.groupMode/);
assert.match(workbenchSource, /await customerApi\.updateCustomer\(updatedCustomer\)/);
assert.match(workbenchSource, /saveCustomerWechatProfile\(selectedCustomerId/);
assert.match(workbenchSource, /wechatCustomerMatchOpen\.value = false/);
assert.match(workbenchSource, /客户关联已保存；\$\{message\}/);

console.log('WeChat customer match flow passed');
