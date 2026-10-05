function secureBridge() {
  const bridge = window.electronAPI?.salesAnalysis;
  if (!bridge) throw new Error('销售分析仅支持在农心乐桌面端中使用');
  return bridge;
}

async function requireSuccess(promise, fallback) {
  const result = await promise;
  if (!result?.ok) throw new Error(result?.message || fallback);
  return result.data || {};
}

export default {
  overview(range) {
    return requireSuccess(secureBridge().loadOverview(range), '销售概览加载失败');
  },
  category(categoryId, range) {
    return requireSuccess(secureBridge().loadCategory(categoryId, range), '商品大类加载失败');
  },
  productCustomers(goodsId, range, limit = 5) {
    return requireSuccess(
      secureBridge().loadProductCustomers(goodsId, range, limit),
      '商品重要客户加载失败',
    );
  },
  categoryCustomers(categoryId, range, page = 1, pageSize = 20) {
    return requireSuccess(
      secureBridge().loadCategoryCustomers(categoryId, range, page, pageSize),
      '大类客户加载失败',
    );
  },
  categoryCustomerProducts(categoryId, customerId, range, page = 1, pageSize = 20) {
    return requireSuccess(
      secureBridge().loadCategoryCustomerProducts(
        categoryId, customerId, range, page, pageSize,
      ),
      '客户商品明细加载失败',
    );
  },
};
