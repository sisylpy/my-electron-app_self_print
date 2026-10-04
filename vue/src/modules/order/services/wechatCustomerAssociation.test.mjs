import assert from 'node:assert/strict';
import {
  buildWechatCustomerAssociationDirectory,
  ensureWechatCustomerBinding,
  findWechatCustomerProfileMatches,
  resolveWechatCustomerAssociation,
  WECHAT_GROUP_MODE_REQUIRED,
} from './wechatCustomerAssociation.js';

const oldCustomer = {
  customer: { nxDepartmentId: 7, nxDepartmentWechatDisplayName: '金调料' },
  binding: {
    enabled: 1,
    displayName: '金调料',
    accountFingerprint: 'fp:account123',
    conversationFingerprint: 'fp:conversation123',
    conversationKind: 'direct',
  },
};
const newCustomer = {
  customer: { nxDepartmentId: 8, nxDepartmentWechatDisplayName: ' 金调料 ' },
  binding: { enabled: 0, displayName: '金调料' },
};
const directory = buildWechatCustomerAssociationDirectory([oldCustomer, newCustomer]);

assert.deepEqual(
  findWechatCustomerProfileMatches(
    [oldCustomer.customer, newCustomer.customer],
    '金调料'
  ).map(customer => customer.nxDepartmentId),
  [7, 8]
);
assert.deepEqual(
  findWechatCustomerProfileMatches([oldCustomer.customer], 'Fangfang'),
  []
);

assert.deepEqual(directory.allowedTitles, ['金调料']);
const profileOnlyDirectory = buildWechatCustomerAssociationDirectory([
  {
    customer: { nxDepartmentId: 18, nxDepartmentWechatDisplayName: '调料群' },
    error: new Error('技术绑定暂时不可用'),
  },
  {
    customer: { nxDepartmentId: 19, nxDepartmentWechatDisplayName: '' },
    binding: { enabled: 0 },
  },
]);
assert.deepEqual(profileOnlyDirectory.allowedTitles, ['调料群']);
assert.equal(
  resolveWechatCustomerAssociation(profileOnlyDirectory, '调料群').customer.nxDepartmentId,
  18
);
assert.equal(
  resolveWechatCustomerAssociation(directory, '金调料').customer.nxDepartmentId,
  newCustomer.customer.nxDepartmentId
);
assert.throws(
  () => resolveWechatCustomerAssociation(
    buildWechatCustomerAssociationDirectory([
      newCustomer,
      { customer: { nxDepartmentId: 9, nxDepartmentWechatDisplayName: '金调料' }, binding: { enabled: 0 } },
    ]),
    '金调料'
  ),
  /关联了多个客户/
);

let savedPayload = null;
const associationTimings = [];
const rebound = await ensureWechatCustomerBinding({
  row: resolveWechatCustomerAssociation(directory, '金调料'),
  selectedTitle: '金调料',
  directory,
  onTiming: event => associationTimings.push(event),
  electronAPI: {
    wechatReader: {
      listAccounts: async () => ({
        ok: true,
        result: [{ id: 'fp:account123', isCurrentLogin: true, hasAccessMaterial: true }],
      }),
      findConversation: async () => ({
        ok: true,
        result: {
          matches: [{ id: 'fp:conversation123', displayName: '金调料', kind: 'direct' }],
        },
      }),
    },
    customerWechatOrders: {
      saveBinding: async (payload) => {
        savedPayload = payload;
        return { ok: true, data: { ...payload, enabled: 1 } };
      },
    },
  },
});

assert.equal(savedPayload.customerId, 8);
assert.equal(savedPayload.conversationFingerprint, 'fp:conversation123');
assert.equal(rebound.bound, true);
assert.deepEqual(
  associationTimings.map(event => event.stage),
  ['reader-list-accounts', 'reader-find-conversation', 'server-save-binding']
);
assert.ok(associationTimings.every(event => Number.isFinite(event.durationMs)));

const groupRow = {
  customer: { nxDepartmentId: 18, nxDepartmentWechatDisplayName: '调料群' },
  binding: { enabled: 0 },
};
const groupDirectory = buildWechatCustomerAssociationDirectory([groupRow]);
const groupApi = {
  wechatReader: {
    listAccounts: async () => ({
      ok: true,
      result: [{ id: 'fp:account123', isCurrentLogin: true, hasAccessMaterial: true }],
    }),
    findConversation: async () => ({
      ok: true,
      result: {
        matches: [{ id: 'fp:group123456', displayName: '调料群', kind: 'group' }],
      },
    }),
  },
  customerWechatOrders: {
    saveBinding: async (payload) => ({ ok: true, data: { ...payload, enabled: 1 } }),
  },
};
await assert.rejects(
  ensureWechatCustomerBinding({
    row: groupRow,
    selectedTitle: '调料群',
    directory: groupDirectory,
    electronAPI: groupApi,
  }),
  error => error?.code === WECHAT_GROUP_MODE_REQUIRED
);
const groupBinding = await ensureWechatCustomerBinding({
  row: groupRow,
  selectedTitle: '调料群',
  directory: groupDirectory,
  groupMode: 'MENTION_SELF_ONLY',
  electronAPI: groupApi,
});
assert.equal(groupBinding.bound, true);
assert.equal(groupBinding.groupMode, 'MENTION_SELF_ONLY');

console.log('WeChat customer association passed');
