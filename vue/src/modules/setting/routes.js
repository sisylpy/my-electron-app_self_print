export const SETTINGS_ROUTE_NAME = 'SettingsCenter';

export const settingRoutes = [
  {
    path: '/settings',
    name: SETTINGS_ROUTE_NAME,
    component: () => import('./views/SettingsCenter.vue'),
    meta: {
      shell: true,
      module: 'setting',
      navKey: 'setting',
      moduleLabel: '系统管理',
      title: '设备与设置',
      description: '查看打印机、MCP、日志与运行环境',
    },
  },
];

export default settingRoutes;
