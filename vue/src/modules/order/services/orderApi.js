import coreApi from '@/api/all';

/**
 * 订单工作台允许调用的服务端接口白名单。
 *
 * 保持原参数与返回值，不在 Electron 中复制业务规则。新增调用必须先在这里显式登记，
 * 避免大组件重新依赖整个 api/all。
 */
const ALLOWED_METHODS = [
  'choiceGoodsForApply',
  'correctionOrder',
  'deleteOrder',
  'deleteTaskData',
  'depFatherGetTaskList',
  'disGetAllCustomer',
  'disGetTodayOrderCustomer',
  'disGetGoods',
  'disSaveStandard',
  'downDisGoods',
  'finishTask',
  'getImageServerURL',
  'getOcrTaskStatus',
  'getPromptByKey',
  'getTaskOrders',
  'manualOrderBefore',
  'pasteSearchGoods',
  'phoneGetToFillDepOrders',
  // 拣货单（A4 打印）：按商品 / 按货架两类数据接口 + 打印后固定规格出库
  'pickListCategories',
  'pickListCategoryGoods',
  'pickListShelves',
  'pickListShelfGoods',
  'pickListFinishOrder',
  'queryDisGoodsByQuickSearchWithDepId',
  'recognizeOrderFromExcel',
  'recognizeOrderOCR',
  'recognizeOrderOCRWithAi',
  // 千问视觉识别图片订单并落库：仅 WorkBuddy 连接器自动保存图片订单时使用。
  // 人工「直接识别」（单列）/「AI识别」（多列）仍走 recognizeOrderOCR / recognizeOrderOCRWithAi。
  'recognizeOrderQwen',
  'revertTaskOrder',
  'saveManulOrder',
  'saveNxDisLinshiGoods',
  'saveOrderBefore',
  'updateOrder',
  'webNxDisGetTodayOrderCustomer',
];

function forward(name) {
  return (...args) => {
    const method = coreApi[name];
    if (typeof method !== 'function') {
      throw new Error(`订单接口未实现: ${name}`);
    }
    return method(...args);
  };
}

const orderApi = Object.freeze(Object.fromEntries(
  ALLOWED_METHODS.map((name) => [name, forward(name)])
));

export { ALLOWED_METHODS };
export default orderApi;
