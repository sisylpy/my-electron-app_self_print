/**
 * 拣货单打印编排：取数 → 生成 A4 HTML → 用独立 A4 打印机静默打印 → 固定规格自动出库。
 *
 * 与配送单打印链路完全分离：打印机、纸型、模板都是独立的，
 * 只在同一个 printer-config.json 里多存 a4Printer / pickListMode 两个字段。
 */

import { buildPickListA4Html } from './pickListA4Template';
import {
  loadPickListGroups,
  mergeGroupsForBatch,
  collectOrders,
  finishFixedSpecOrders,
} from '@/modules/order/services/pickListService';

function electronApi() {
  return typeof window !== 'undefined' ? window.electronAPI : null;
}

/** 读取拣货单打印配置：{ a4Printer, pickListMode } */
export async function getPickListPrintConfig() {
  const api = electronApi();
  if (!api?.getPickListPrintConfig) return { a4Printer: '', pickListMode: 'goods' };
  const result = await api.getPickListPrintConfig();
  if (!result?.success) return { a4Printer: '', pickListMode: 'goods' };
  return {
    a4Printer: result.config?.a4Printer || '',
    pickListMode: result.config?.pickListMode === 'shelf' ? 'shelf' : 'goods',
  };
}

export async function savePickListPrintConfig({ a4Printer, pickListMode }) {
  const api = electronApi();
  if (!api?.savePickListPrintConfig) throw new Error('桌面打印配置不可用');
  const result = await api.savePickListPrintConfig({ a4Printer, pickListMode });
  if (!result?.success) throw new Error(result?.error || '保存打印配置失败');
  return {
    a4Printer: result.config?.a4Printer || '',
    pickListMode: result.config?.pickListMode === 'shelf' ? 'shelf' : 'goods',
  };
}

async function sendToA4Printer(html) {
  const api = electronApi();
  if (!api?.printPickListA4) throw new Error('桌面 A4 打印通道不可用，请更新安装包');
  const result = await api.printPickListA4(html);
  if (!result?.success) throw new Error(result?.error || '打印失败');
  return result;
}

/** 打印后对固定规格订单默认出库；失败不影响已打印结果 */
async function autoFinish(groups, mode, pickerUserId) {
  if (!pickerUserId) return { total: 0, failed: 0 };
  const orders = collectOrders(groups, mode);
  return finishFixedSpecOrders(orders, { pickerUserId });
}

/**
 * 单客户拣货单打印。
 */
export async function printCustomerPickList({
  nxDepIds,
  gbDepIds,
  nxDisId,
  supplierId,
  customerName,
  mode,
  pickerUserId,
}) {
  const { groups, mode: usedMode } = await loadPickListGroups({
    mode,
    nxDepIds,
    gbDepIds,
    nxDisId,
    supplierId,
  });
  if (!groups || groups.length === 0) {
    throw new Error('该客户暂无待出货商品');
  }
  const html = buildPickListA4Html({
    kind: 'customer',
    mode: usedMode,
    customerName,
    groups,
  });
  const result = await sendToA4Printer(html);
  const finish = await autoFinish(groups, usedMode, pickerUserId);
  return { ...result, mode: usedMode, finish };
}

/**
 * 批量拣货单打印：多个客户的待出货商品按商品合并后一次打印。
 * customers: [{ nxDepId, gbDepId, name }]
 */
export async function printBatchPickList({
  customers,
  nxDisId,
  supplierId,
  mode,
  pickerUserId,
}) {
  const collected = [];
  let usedMode = mode;
  const collect = (groups, m) => {
    collected.push({ groups, mode: m });
  };

  for (const customer of customers) {
    const res = await loadPickListGroups({
      mode,
      nxDepIds: customer.nxDepId ? String(customer.nxDepId) : '0',
      gbDepIds: customer.gbDepId ? String(customer.gbDepId) : '0',
      nxDisId,
      supplierId,
    });
    if (!res.groups || res.groups.length === 0) continue;
    // 批量单需要按客户展示，把客户名写回订单行
    res.groups.forEach((group) => {
      const mark = (order) => {
        if (!order.depName) order.depName = customer.name || '';
      };
      if (res.mode === 'goods') {
        (group.items || []).forEach((item) => (item.orders ? item.orders.forEach(mark) : mark(item)));
      } else {
        (group.layers || []).forEach((layer) => {
          (layer.items || []).forEach((item) => (item.orders ? item.orders.forEach(mark) : mark(item)));
        });
      }
    });
    collect(res.groups, res.mode);
    usedMode = res.mode;
  }

  if (collected.length === 0) {
    throw new Error('所选客户暂无待出货商品');
  }

  // 所有客户统一按实际生效的模式合并
  const groups = mergeGroupsForBatch(collected.map((item) => item.groups).flat(), usedMode);
  const html = buildPickListA4Html({
    kind: 'batch',
    mode: usedMode,
    groups,
  });
  const result = await sendToA4Printer(html);
  const finish = await autoFinish(groups, usedMode, pickerUserId);
  return { ...result, mode: usedMode, finish };
}
