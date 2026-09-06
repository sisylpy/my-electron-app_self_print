const ReturnPrintWorkbench = () => import('./views/ReturnPrintWorkbench.vue');

export const RETURN_PRINT_ROUTE_NAME = 'ReturnPrintWorkbench';

export const returnRoutes = [
  {
    path: '/returns/print',
    name: RETURN_PRINT_ROUTE_NAME,
    component: ReturnPrintWorkbench,
    meta: {
      shell: true,
      module: 'returns',
      navKey: 'return-print',
      moduleLabel: '订单工作',
      title: '退货单打印',
      description: '客户交接与仓库收货凭证打印队列',
      requiresDisUser: true,
    },
  },
];

export default returnRoutes;
