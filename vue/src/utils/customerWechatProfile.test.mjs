import assert from 'node:assert/strict';

import {
  applyCustomerWechatProfile,
  loadCustomerWechatProfile,
  saveCustomerWechatProfile,
} from './customerWechatProfile.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const storage = new MemoryStorage();
saveCustomerWechatProfile(312, {
  conversationKind: 'group',
  groupMode: 'ALL_MEMBER_MESSAGES',
}, storage);

assert.deepEqual(loadCustomerWechatProfile(312, storage), {
  conversationKind: 'group',
  groupMode: 'ALL_MEMBER_MESSAGES',
});
assert.deepEqual(applyCustomerWechatProfile(312, { enabled: 0 }, storage), {
  enabled: 0,
  conversationKind: 'group',
  groupMode: 'ALL_MEMBER_MESSAGES',
  profileConfigured: true,
});
assert.deepEqual(
  applyCustomerWechatProfile(312, {
    enabled: 1,
    bound: true,
    conversationKind: 'direct',
    accountFingerprint: 'account',
    conversationFingerprint: 'conversation',
  }, storage),
  {
    enabled: 0,
    bound: false,
    conversationKind: 'group',
    groupMode: 'ALL_MEMBER_MESSAGES',
    accountFingerprint: 'account',
    conversationFingerprint: 'conversation',
    profileConfigured: true,
  },
);

saveCustomerWechatProfile(312, null, storage);
assert.equal(loadCustomerWechatProfile(312, storage), null);

console.log('customer WeChat profile persistence passed');
