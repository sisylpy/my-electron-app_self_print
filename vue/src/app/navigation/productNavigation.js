import iconOrderWorkbench from '../../assets/product-nav/order_workbench.png';
import iconPrintCenter from '../../assets/product-nav/print_center.png';
import iconReturnOrderPrint from '../../assets/product-nav/return_order_print.png';
import iconDeliveryDispatch from '../../assets/product-nav/delivery_dispatch.png';
import iconSmartReplenishment from '../../assets/product-nav/smart_replenishment.png';
import iconSalesAnalysis from '../../assets/product-nav/sales_analysis.png';
import iconCustomerCenter from '../../assets/product-nav/customer_center.png';
import iconDeviceSettings from '../../assets/product-nav/device_settings.png';

export const PRODUCT_NAVIGATION = Object.freeze([
  Object.freeze({
    label: '订单工作',
    items: Object.freeze([
      Object.freeze({
        key: 'order-workbench-v2',
        label: '录单',
        description: '下单、待确认、出货与分批打印',
        icon: '单',
        iconImg: iconOrderWorkbench,
        routeName: 'OrderWorkbenchV2',
        module: 'order',
      }),
      Object.freeze({
        key: 'print',
        label: '打印中心',
        description: '配送单预览、下载与正式打印',
        icon: '印',
        iconImg: iconPrintCenter,
        routeName: 'Bills',
        module: 'print',
      }),
      Object.freeze({
        key: 'return-print',
        label: '退货单',
        description: '客户退货交接单与仓库收货单',
        icon: '退',
        iconImg: iconReturnOrderPrint,
        routeName: 'ReturnPrintWorkbench',
        module: 'returns',
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
        iconImg: iconDeliveryDispatch,
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
        iconImg: iconSmartReplenishment,
        routeName: 'PurchasePredictionLab',
        module: 'predictionLab',
      }),
    ]),
  }),
  Object.freeze({
    label: '经营分析',
    items: Object.freeze([
      Object.freeze({
        key: 'sales-analysis',
        label: '销售分析',
        description: '商品分布、客户结构与重要客户',
        icon: '析',
        iconImg: iconSalesAnalysis,
        routeName: 'SalesAnalysis',
        module: 'salesAnalysis',
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
        iconImg: iconCustomerCenter,
        routeName: 'CustomerCenter',
        module: 'customer',
      }),
      Object.freeze({
        key: 'setting',
        label: '设备与设置',
        description: '打印机、连接器与运行环境',
        icon: '设',
        iconImg: iconDeviceSettings,
        routeName: 'SettingsCenter',
        module: 'setting',
      }),
    ]),
  }),
]);

export default PRODUCT_NAVIGATION;
