export const DISPATCH_ROUTE_NAME = 'DispatchWorkbench';
export const DISPATCH_ROUTE_PATH = '/dispatch';

export const dispatchRoutes = [
  {
    path: DISPATCH_ROUTE_PATH,
    name: DISPATCH_ROUTE_NAME,
    component: () => import('./views/DispatchWorkbench.vue'),
    meta: {
      shell: true,
      module: 'dispatch',
      navKey: 'dispatch',
      moduleLabel: '履约配送',
      title: '配送调度',
      description: '订单、司机、路线与派单状态工作台',
      requiresDisUser: true,
      slice: 1,
    },
  },
];

export default dispatchRoutes;
