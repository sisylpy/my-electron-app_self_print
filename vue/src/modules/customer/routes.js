const CustomerCenter = () => import('./views/CustomerCenter.vue');

export const CUSTOMER_ROUTE_NAME = 'CustomerCenter';

/**
 * 独立客户中心：客户档案、客户商品、售后、AI 推荐和历史订单。
 */
export const customerRoutes = [
  {
    path: '/customers',
    name: CUSTOMER_ROUTE_NAME,
    component: CustomerCenter,
    meta: {
      shell: true,
      module: 'customer',
      navKey: 'customer',
      moduleLabel: '客户中心',
      title: '客户中心',
      description: '客户档案、客户商品、售后问题与智能推荐',
      requiresDisUser: true,
    },
  },
];

export default customerRoutes;
