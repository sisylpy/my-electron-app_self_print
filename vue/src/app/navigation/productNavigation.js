export const PRODUCT_NAVIGATION = Object.freeze([
  Object.freeze({
    label: '订单工作',
    items: Object.freeze([
      Object.freeze({
        key: 'order-workbench-v2',
        label: '订单工作台',
        description: '下单、待确认、出货与分批打印',
        icon: '单',
        routeName: 'OrderWorkbenchV2',
        module: 'order',
      }),
      Object.freeze({
        key: 'print',
        label: '打印中心',
        description: '配送单预览、下载与正式打印',
        icon: '印',
        routeName: 'Bills',
        module: 'print',
      }),
    ]),
  }),
  Object.freeze({
    label: '履约配送',
    items: Object.freeze([
      Object.freeze({
        key: 'dispatch',
        label: '配送调度',
        description: '订单、司机与路线工作台',
        icon: '调',
        routeName: 'DispatchWorkbench',
        module: 'dispatch',
      }),
    ]),
  }),
  Object.freeze({
    label: 'AI 助手',
    items: Object.freeze([
      Object.freeze({
        key: 'prediction-lab',
        label: '智能备货',
        description: '按商品大类查看 A/B 级备货需求',
        icon: '备',
        routeName: 'PurchasePredictionLab',
        module: 'predictionLab',
      }),
    ]),
  }),
  Object.freeze({
    label: '系统管理',
    items: Object.freeze([
      Object.freeze({
        key: 'customer',
        label: '客户中心',
        description: '客户与历史订单',
        icon: '客',
        routeName: 'CustomerCenter',
        module: 'customer',
      }),
      Object.freeze({
        key: 'setting',
        label: '设备与设置',
        description: '打印机、MCP、日志与环境',
        icon: '设',
        routeName: 'SettingsCenter',
        module: 'setting',
      }),
    ]),
  }),
]);

export default PRODUCT_NAVIGATION;
