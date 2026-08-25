function createTtsState() {
  return {
    isTTSPlaying: false,
    isTTSLoading: false,
    stoppedIndex: -1,
  };
}

export function createTtsStateByMode() {
  return {
    paste: createTtsState(),
    image: createTtsState(),
    excelPaste: createTtsState(),
    excel: createTtsState(),
  };
}

export function createExcelPasteRows(rowCount = 50) {
  return Array.from({ length: rowCount }, () => ({
    goodsName: '',
    quantity: '',
    specification: '',
    specificationWeight: '',
    cartonQuantity: '',
    cartonName: '',
    remark: '',
  }));
}

export function createBeforeOrderForm({ includeLastSearch = false } = {}) {
  const form = {
    goodsName: '',
    quantity: '',
    standard: '',
    remark: '',
    selectedGoods: null,
    searchResults: [],
    disArr: [],
    nxArr: [],
    showSearchResults: false,
    selectedSearchIndex: 0,
  };
  if (includeLastSearch) form.lastSearchStr = null;
  return form;
}

export function createSaveNewGoodsForm() {
  return {
    goodsName: '',
    standardName: '',
    standardWeight: '',
    itemUnit: '',
    cartonUnit: '',
    itemsPerCarton: '',
  };
}

function createSharedWorkspaceState() {
  return {
    orderItems: [],
    savingOrder: false,
    recognizingImage: false,
    recognizingExcel: false,
    hasRunningTask: false,
    taskCheckTimer: null,
    currentTaskId: null,
    currentTask: null,
    taskLoading: false,
    taskStatusPollTimer: null,
    pasteLastState: null,
    excelPasteLastState: null,
    imageLastState: null,
    uploadedImageFile: null,
    imagePreview: null,
    imageScale: 1,
    imageTranslateX: 0,
    imageTranslateY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    ttsStateByMode: createTtsStateByMode(),
    strArr: [],
    nxArr: [],
    orderArrIndex: -1,
    currentSourceType: null,
    searchStr: '',
    goodsId: '',
    selectedGoodsName: '',
    goodsName: '',
    lastSearchValue: '',
    showMatchedGoods: {},
    showEditOrderModal: false,
    currentEditOrderItem: null,
    currentEditOrderIndex: -1,
    currentEditOrderSourceType: null,
    itemDis: null,
    showAddStandard: false,
    newStandardName: '',
    focusType: '',
    editOrderForm: { quantity: '', standard: '', remark: '' },
    addingOrderBeforeIndex: -1,
    _beforeOrderStandardHasAutoFilledCarton: false,
    _beforeOrderGoodsSearchDebounce: null,
    _goodsNameSearchDebounce: null,
    showFixItemsModal: false,
    fixItemsRequirement: '',
    isProcessingFixItems: false,
    showTaskCompleteModal: false,
    taskCompleteModalTaskId: null,
    taskCompleteModalSourceType: null,
    taskCompleteModalTask: null,
    showSaveNewGoodsModal: false,
    currentSaveGoodsItem: null,
    currentSaveGoodsOrderIndex: -1,
    currentSaveGoodsSourceType: null,
    isSaveNewGoodsFromBeforeOrder: false,
    saveNewGoodsForm: createSaveNewGoodsForm(),
    toastVisible: false,
    toastMessage: '',
    toastType: 'info',
    toastDuration: 3000,
  };
}

export function createPlaceOrderState() {
  return {
    ...createSharedWorkspaceState(),
    uploadType: 'manual',
    excelPasteEverShown: false,
    uploadedExcelFile: null,
    uploadedExcelPreview: null,
    showImagePreviewModal: false,
    previewImageDataUrl: null,
    manualRefText: '',
    manualRefImageDataUrl: null,
    pasteInputText: '',
    pasteSaveCount: null,
    draftSelectedOrderIndex: -1,
    pasteOriginText: '',
    pasteInputContent: '',
    pasteInvalidLineIndices: [],
    pasteInvalidSegments: [],
    pasteNoValidOrder: false,
    showDeepSeekLoading: false,
    excelPasteSaveCount: null,
    excelPasteRawData: [],
    excelPasteTableData: createExcelPasteRows(),
    currentPasteRowIndex: 0,
    currentPasteColIndex: 0,
    customerFolderPath: null,
    selectingFolder: false,
    scanningFiles: false,
    autoProcessFiles: [],
    processingFiles: false,
    autoProcessProgress: { current: 0, total: 0, percent: 0 },
    autoProcessResults: [],
    autoProcessImagePreview: null,
    autoProcessImagePreviewFileName: '',
    autoProcessImagePreviews: {},
    autoProcessExcelPreviews: {},
    activeProcessedFileTab: null,
    beforeOrderForm: createBeforeOrderForm(),
    currentSaveGoodsManualRow: null,
    currentSaveGoodsManualRowIndex: -1,
  };
}

export function createTaskOrderState() {
  return {
    ...createSharedWorkspaceState(),
    uploadType: '',
    beforeOrderForm: createBeforeOrderForm({ includeLastSearch: true }),
    pasteInputText: '',
    pasteSaveCount: null,
    pasteInvalidLineIndices: [],
    pasteInvalidSegments: [],
    pasteNoValidOrder: false,
    showDeepSeekLoading: false,
    excelPasteSaveCount: null,
    excelPasteTableData: createExcelPasteRows(),
    taskListFromParent: [],
    loadingTaskListFromParent: false,
    selectedTaskFromList: null,
    pageLogs: [],
    selectedCustomerEntity: { type: Object, default: null },
    selectedCustomerName: { type: String, default: '' },
    allOrdersAreDraft: false,
  };
}

export function createOrderListState() {
  return {
    isRecording: false,
    isStopping: false,
    isStarting: false,
    recognitionResult: null,
    recordingError: null,
    isTTSLoading: false,
    ttsAudioUrl: null,
    ttsError: null,
    ttsQueue: [],
    ttsAudioCache: {},
    isTTSPlaying: false,
    currentTTSIndex: 0,
    ttsSessionId: null,
    ttsAudio: null,
    _ttsBound: false,
    stoppedIndex: -1,
    orderItemRefs: {},
    ttsPlayerHeight: 0,
    previousOrderItemsLength: 0,
    ttsRequestCache: {},
    ttsRequestRetries: {},
    ttsMaxRetries: 3,
    ttsRetryDelay: 1000,
    ttsMaxConcurrent: 2,
    ttsActiveRequests: 0,
    goodsNameInputValues: {},
    selectedMatchedGoodsIndex: {},
    selectedSearchResultIndex: 0,
    selectedNxGoodsIndex: 0,
    keyboardSelectedOrderIndex: -1,
    _skipCloseMatchedGoodsOnNextFocus: false,
    voiceListenerCleanups: [],
    toastVisible: false,
    toastMessage: '',
    toastType: 'info',
    toastDuration: 3000,
  };
}
