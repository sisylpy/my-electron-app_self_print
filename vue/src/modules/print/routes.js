import Bills from '@/views/Bills.vue';
import { PRINT_ROUTE_NAME, PRINT_ROUTE_PATH } from './constants';

/**
 * 打印入口保持兼容：
 * - /bills 是现有 Home、MCP 和历史链接使用的正式路径；
 * - /print 只是同一路由记录的可读别名，不创建第二个打印页面。
 */
export const printRoutes = [
  {
    path: PRINT_ROUTE_PATH,
    alias: '/print',
    name: PRINT_ROUTE_NAME,
    component: Bills,
    meta: {
      shell: true,
      module: 'print',
      navKey: 'print',
      moduleLabel: '履约配送',
      title: '打印中心',
      description: '配送单预览、下载与正式打印',
      billsView: 'order',
      requiresDisUser: true,
    },
  },
];

export { PRINT_ROUTE_NAME, PRINT_ROUTE_PATH };
export default printRoutes;
