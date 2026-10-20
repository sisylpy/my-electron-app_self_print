/**
 * 拣货单（A4 打印）数据服务。
 *
 * 数据来源与 Boss 小程序 `utils/pickListPrinter.js` 完全一致：
 *  - 按商品（CATEGORY）：stockerGetCategoryListWithDepIds → stockerGetCategoryGoodsDetail
 *  - 按货架（SHELF）  ：stockerGetShelfListWithDepIds   → stockerGetShelfGoodsDetail
 *
 * 只负责取数与汇总，不做排版；A4 排版交给 pickListA4Template。
 */

import orderApi from './orderApi';

const WEIGH_UNITS = ['斤', '公斤', '千克', '克', '两', 'g', 'kg', 'Kg', 'KG', 'G'];

function isWeighUnit(unit) {
  if (!unit) return false;
  const value = String(unit).trim();
  return WEIGH_UNITS.indexOf(value) !== -1;
}

function orderUnit(order) {
  return order.nxDoStandard || order.nxDoPrintStandard || '';
}

function orderQty(order) {
  const q = order.nxDoQuantity;
  return q === undefined || q === null || q === '' ? 0 : Number(q);
}

/** 商品规格展示串，与货架页一致：4.9L*2桶 / 4.9L/桶 / 斤 */
function goodsSpec(order) {
  let w = order._standardWeight;
  let n = order._standard;
  let c = order._itemsPerCarton;
  w = w && w !== 'null' ? String(w).trim() : '';
  n = n ? String(n).trim() : '';
  c = (c !== null && c !== undefined && c !== '' && Number(c) > 0) ? String(Number(c)) : '';
  if (c && w) return w + '*' + c + n;
  if (c && n) return c + n;
  if (w && n && w !== n) return w + '/' + n;
  return n || w || '';
}

/**
 * 固定规格判定：单位不是称重单位，且与商品小包装规格或大包装规格一致。
 * 与小程序一致，这类商品打印后可直接默认出库。
 */
function isFixedSpecOrder(order) {
  const unit = orderUnit(order);
  if (!unit || isWeighUnit(unit)) return false;
  const small = order._standard ? String(order._standard).trim() : '';
  const carton = order._cartonUnit ? String(order._cartonUnit).trim() : '';
  return (small !== '' && unit === small) || (carton !== '' && unit === carton);
}

function orderCustomerName(order) {
  if (order.nxDoRequestDisId != null && order.nxDoRequestDisId !== -1 && order.nxDoRequestDistributerName) {
    return order.nxDoRequestDistributerName;
  }
  if (order.depName) return order.depName;
  if (order.gbDepName) return order.gbDepName;
  if (order.nxDepartmentEntity) {
    return order.nxDepartmentEntity.nxDepartmentAttrName || order.nxDepartmentEntity.nxDepartmentName || '';
  }
  if (order.gbDepartmentEntity) {
    return order.gbDepartmentEntity.gbDepartmentAttrName || order.gbDepartmentEntity.gbDepartmentName || '';
  }
  return '';
}

function trimNum(n) {
  const v = Number(n || 0);
  if (Number.isNaN(v)) return String(n);
  return v % 1 === 0 ? String(v) : String(Math.round(v * 100) / 100);
}

/** 把商品上的规格字段挂到订单行，供固定规格/规格展示使用 */
function attachGoods(order, goods) {
  order._goodsName = goods.nxDgGoodsName;
  order._goodsId = goods.nxDistributerGoodsId;
  order._standard = goods.nxDgGoodsStandardname;
  order._standardWeight = goods.nxDgGoodsStandardWeight;
  order._cartonUnit = goods.nxDgCartonUnit;
  order._itemsPerCarton = goods.nxDgItemsPerCarton;
  // 供模板决定出货列是否留空：称重商品留空手写，固定规格直接带数量
  order.__fixedSpec = isFixedSpecOrder(order);
  return order;
}

function unwrap(response) {
  // 打包桌面版返回 { status, data }；开发态 axios 返回 { data }
  return response?.data ?? {};
}

/**
 * 按商品（大类）加载待出货数据。
 * @returns {Promise<Array<{name: string, items: Array}>>}
 */
export async function loadCategoryGroups({ nxDepIds, gbDepIds, nxDisId, supplierId }) {
  const listRes = await orderApi.pickListCategories({ nxDepIds, gbDepIds, nxDisId, supplierId });
  const body = unwrap(listRes);
  if (Number(body.code) !== 0) {
    throw new Error(body.msg || '获取商品大类失败');
  }
  const categories = body.data?.categoryList || [];
  const groups = [];
  for (const cata of categories) {
    const detailRes = await orderApi.pickListCategoryGoods({
      categoryId: cata.nxDistributerFatherGoodsId,
      nxDepIds,
      gbDepIds,
      nxDisId,
      supplierId,
    });
    const detailBody = unwrap(detailRes);
    if (Number(detailBody.code) !== 0) continue;
    const data = detailBody.data || {};
    const items = [];
    (data.goodsList || []).forEach((goods) => {
      (goods.orders || []).forEach((order) => {
        if (orderQty(order) > 0) items.push(attachGoods(order, goods));
      });
    });
    if (items.length > 0) {
      groups.push({
        name: data.nxDfgFatherGoodsName || cata.nxDfgFatherGoodsName || '',
        items,
      });
    }
  }
  return groups;
}

/**
 * 按货架加载待出货数据（含层位与层内序号）。
 * @returns {Promise<Array<{name: string, sort: number, layers: Array<{layer: number|null, items: Array}>}>>}
 */
export async function loadShelfGroups({ nxDepIds, gbDepIds, nxDisId }) {
  const listRes = await orderApi.pickListShelves({ nxDepIds, gbDepIds, nxDisId });
  const body = unwrap(listRes);
  if (Number(body.code) !== 0) {
    throw new Error(body.msg || '获取货架失败');
  }
  const shelfList = (body.data?.shelfList || []).slice();
  shelfList.sort((a, b) => (a.nxDistributerGoodsShelfSort || 0) - (b.nxDistributerGoodsShelfSort || 0));
  if (shelfList.length === 0) return null; // 无货架，调用方回退按商品

  const shelves = [];
  for (const shelf of shelfList) {
    const detailRes = await orderApi.pickListShelfGoods({
      shelfId: shelf.nxDistributerGoodsShelfId,
      nxDepIds,
      gbDepIds,
      nxDisId,
    });
    const detailBody = unwrap(detailRes);
    if (Number(detailBody.code) !== 0) continue;
    const data = detailBody.data || {};
    const layerMap = new Map();
    (data.goodsList || []).forEach((sg) => {
      const goods = sg.goods || {};
      const layer = sg.nxDgsgShelfLayer == null ? null : sg.nxDgsgShelfLayer;
      const key = layer == null ? '_none' : String(layer);
      if (!layerMap.has(key)) layerMap.set(key, { layer, items: [] });
      (goods.orders || []).forEach((order) => {
        if (orderQty(order) <= 0) return;
        attachGoods(order, goods);
        order._layerSeq = sg.nxDgsgShelfLayerSeq != null ? sg.nxDgsgShelfLayerSeq : sg.nxDgsgSort;
        order._shelfId = shelf.nxDistributerGoodsShelfId;
        layerMap.get(key).items.push(order);
      });
    });
    const layers = Array.from(layerMap.values()).sort(
      (a, b) => (a.layer == null ? 9999 : a.layer) - (b.layer == null ? 9999 : b.layer)
    );
    if (layers.length === 0) continue;
    shelves.push({
      name: data.nxDistributerGoodsShelfName || shelf.nxDistributerGoodsShelfName || '',
      sort: shelf.nxDistributerGoodsShelfSort || 0,
      layers,
    });
  }
  return shelves;
}

/**
 * 按指定模式加载分组数据；货架模式无货架时自动回退按商品。
 */
export async function loadPickListGroups({ mode, nxDepIds, gbDepIds, nxDisId, supplierId }) {
  if (mode === 'shelf') {
    const shelves = await loadShelfGroups({ nxDepIds, gbDepIds, nxDisId });
    if (shelves && shelves.length > 0) return { mode: 'shelf', groups: shelves };
  }
  const groups = await loadCategoryGroups({ nxDepIds, gbDepIds, nxDisId, supplierId });
  return { mode: 'goods', groups };
}

/** 把客户名写入订单（批量单需要按客户展示） */
export function markCustomerName(orders, customerName) {
  (orders || []).forEach((order) => {
    if (!order.depName) order.depName = customerName || '';
  });
}

function addItemToMap(itemMap, order) {
  const unit = orderUnit(order);
  const key = `${order._goodsId || order._goodsName}|${unit}`;
  if (!itemMap.has(key)) {
    itemMap.set(key, {
      name: order._goodsName || '',
      goodsId: order._goodsId,
      unit,
      spec: goodsSpec(order),
      total: 0,
      subRows: [],
      isWeigh: !isFixedSpecOrder(order),
      layerSeq: order._layerSeq != null ? order._layerSeq : null,
      shelfId: order._shelfId || null,
      orders: [],
    });
  }
  const item = itemMap.get(key);
  item.total += orderQty(order);
  item.isWeigh = !isFixedSpecOrder(order);
  const cust = orderCustomerName(order);
  if (cust) item.subRows.push({ name: cust, qty: `${trimNum(orderQty(order))}${unit}` });
  item.orders.push(order);
}

/**
 * 批量拣货单：把多个客户的分组按商品合并，
 * 每个商品带 total（合计）与 subRows（各客户订货量）。
 */
export function mergeGroupsForBatch(groups, mode) {
  const merged = [];
  const groupIndex = new Map();

  (groups || []).forEach((group) => {
    if (!groupIndex.has(group.name)) {
      groupIndex.set(group.name, { name: group.name, sort: group.sort || 0, itemMap: new Map(), layerMap: new Map() });
      merged.push(groupIndex.get(group.name));
    }
    const target = groupIndex.get(group.name);
    if (mode === 'goods') {
      (group.items || []).forEach((order) => addItemToMap(target.itemMap, order));
    } else {
      (group.layers || []).forEach((layer) => {
        const key = layer.layer == null ? '_none' : String(layer.layer);
        if (!target.layerMap.has(key)) {
          target.layerMap.set(key, { layer: layer.layer, itemMap: new Map() });
        }
        (layer.items || []).forEach((order) => addItemToMap(target.layerMap.get(key).itemMap, order));
      });
    }
  });

  return merged.map((g) => {
    if (mode === 'goods') {
      const items = Array.from(g.itemMap.values())
        .sort((a, b) => (a.goodsId || 0) - (b.goodsId || 0));
      return { name: g.name, items };
    }
    const layers = Array.from(g.layerMap.values())
      .sort((a, b) => (a.layer == null ? 9999 : a.layer) - (b.layer == null ? 9999 : b.layer));
    layers.forEach((layer) => {
      layer.items = Array.from(layer.itemMap.values())
        .sort((a, b) => (a.goodsId || 0) - (b.goodsId || 0));
    });
    return { name: g.name, sort: g.sort, layers };
  });
}

/** 汇总分组下所有原始订单，供打印后自动出库使用 */
export function collectOrders(groups, mode) {
  const all = [];
  (groups || []).forEach((group) => {
    if (mode === 'goods') {
      (group.items || []).forEach((item) => {
        if (item.orders) all.push(...item.orders);
        else all.push(item);
      });
    } else {
      (group.layers || []).forEach((layer) => {
        (layer.items || []).forEach((item) => {
          if (item.orders) all.push(...item.orders);
          else all.push(item);
        });
      });
    }
  });
  return all;
}

/**
 * 打印成功后对固定规格订单默认完成出库（称重商品等待人工确认）。
 * 与小程序 autoFinishFixedSpec 口径一致，失败不影响已打印结果。
 */
export async function finishFixedSpecOrders(orders, { pickerUserId }) {
  const jobs = [];
  (orders || []).forEach((order) => {
    if (!isFixedSpecOrder(order)) return;
    const qty = orderQty(order);
    if (!qty || qty <= 0) return;
    jobs.push(orderApi.pickListFinishOrder({
      orderId: order.nxDepartmentOrdersId,
      orderWeight: String(trimNum(qty)),
      pickerUserId,
      shelfId: order._shelfId || undefined,
    }));
  });
  if (jobs.length === 0) return { total: 0, failed: 0 };
  const results = await Promise.allSettled(jobs);
  const failed = results.filter((r) => r.status === 'rejected').length;
  return { total: jobs.length, failed };
}

export { isWeighUnit, isFixedSpecOrder, orderUnit, orderQty, goodsSpec, trimNum };
