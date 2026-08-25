const Bills = () => import('@/views/Bills.vue');
const OrderWorkbenchV2 = () => import('./views/OrderWorkbenchV2.vue');

export const ORDER_INTAKE_ROUTE_NAME = 'OrderIntake';
export const ORDER_TASKS_ROUTE_NAME = 'OrderTasks';
export const ORDER_WORKBENCH_V2_ROUTE_NAME = 'OrderWorkbenchV2';

/**
 * 第一阶段复用 Bills 中已经稳定运行的录单与任务视图。
 * meta 只负责选择视图，不复制 OCR、Excel 或订单业务逻辑。
 */
export const orderRoutes = [
  {
    path: '/orders',
    redirect: { name: ORDER_WORKBENCH_V2_ROUTE_NAME },
  },
  {
    path: '/orders/workbench-v2',
    name: ORDER_WORKBENCH_V2_ROUTE_NAME,
    component: OrderWorkbenchV2,
    meta: {
      shell: true,
      module: 'order',
      navKey: 'order-workbench-v2',
      moduleLabel: '订单中心',
      title: '订单工作台',
      description: 'AI 下单、识别待确认、出货进度与分批打印',
      requiresDisUser: true,
    },
  },
  {
    path: '/orders/intake',
    name: ORDER_INTAKE_ROUTE_NAME,
    component: Bills,
    meta: {
      shell: true,
      module: 'order',
      navKey: 'order-intake',
      moduleLabel: '订单中心',
      title: 'AI 录单',
      description: 'OCR、Excel、图片与手工录入',
      billsView: 'all',
      billsTab: 1,
      requiresDisUser: true,
    },
  },
  {
    path: '/orders/tasks',
    name: ORDER_TASKS_ROUTE_NAME,
    component: Bills,
    meta: {
      shell: true,
      module: 'order',
      navKey: 'order-tasks',
      moduleLabel: '订单中心',
      title: '订单任务',
      description: '查看并继续处理今日录单任务',
      billsView: 'task',
      requiresDisUser: true,
    },
  },
];

export default orderRoutes;
