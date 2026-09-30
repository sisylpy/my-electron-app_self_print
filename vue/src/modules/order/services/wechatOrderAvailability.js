export function customerHasWechatContact(customer) {
  return Boolean(String(customer?.nxDepartmentWechatDisplayName || '').trim());
}
