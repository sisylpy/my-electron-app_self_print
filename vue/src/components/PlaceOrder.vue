<template>
    <div class="save-order-tab"
         style="height: 100%; overflow: hidden; display: flex; flex-direction: column;">
        <!-- 上传方式选择 -->
        <div class="mb-1" style="flex-shrink: 0;">
            <div class="form-group d-flex gap-3 align-items-center flex-wrap">

                <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            name="uploadType"
                            :checked="uploadType === 'manual'"
                            value="manual"
                            class="me-2"
                            @change="handleUploadTypeChange('manual')">
                    录入订单
                </label>
                <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            name="uploadType"
                            :checked="uploadType === 'paste'"
                            value="paste"
                            class="me-2"
                            @change="handleUploadTypeChange('paste')">
                    复制粘贴
                </label>
                <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            name="uploadType"
                            :checked="uploadType === 'image'"
                            value="image"
                            class="me-2"
                            @change="handleUploadTypeChange('image')">
                    上传图片
                </label>


                <label class="mb-0" style="cursor: pointer;" @click="handleUploadTypeChange('excel-paste')">
                    <input
                            type="radio"
                            name="uploadType"
                            :checked="uploadType === 'excel-paste'"
                            value="excel-paste"
                            class="me-2"
                            @change="handleUploadTypeChange('excel-paste')">
                    📋 Excel 粘贴
                </label>
                <!-- <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            name="uploadType"
                            :checked="uploadType === 'excel'"
                            value="excel"
                            class="me-2"
                            @change="handleUploadTypeChange('excel')">
                    上传Excel表
                </label> -->

                <!-- <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            name="uploadType"
                            :checked="uploadType === 'auto'"
                            value="auto"
                            class="me-2"
                            @change="handleUploadTypeChange('auto')">
                    自动
                </label> -->

                <!-- 自动上传：订单保存路径（选中「自动」时显示） -->
                <!-- <div v-if="uploadType === 'auto'" class="d-flex align-items-center gap-2 ms-2">
                    <span class="text-muted small">📁 订单保存路径：</span>
                    <span v-if="customerFolderPath" class="text-muted small"
                          style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                          :title="customerFolderPath">{{ customerFolderPath }}</span>
                    <span v-else class="text-warning small">未设置</span>
                    <button class="btn btn-sm btn-primary" @click="selectCustomerFolder" :disabled="selectingFolder">
                        <span v-if="selectingFolder" class="spinner-border spinner-border-sm me-1"></span>
                        {{ selectingFolder ? '选择中...' : '选择' }}
                    </button>
                    <button v-if="customerFolderPath" class="btn btn-sm btn-outline-secondary"
                            @click="clearCustomerFolder">清除
                    </button>
                </div> -->
            </div>
        </div>

        <!-- 内容区域（min-height:0 配合子级让表格区域正确收缩，防止底部滚动条被遮挡） -->
        <div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;">

            <!-- 手动录入模式 -->
            <ManualEntryUpload
                    v-if="uploadType === 'manual'"
                    ref="manualEntryRef"
                    :ref-text="manualRefText"
                    :ref-image-data-url="manualRefImageDataUrl"
                    :order-items="orderItems"
                    :dep-id="selectedSubDepartment || selectedAllCustomer"
                    :dis-user="disUser"
                    :saving-order="savingOrder"
                    :adding-order-before-index="addingOrderBeforeIndex"
                    :before-order-form="beforeOrderForm"
                    @ref-text-input="manualRefText = $event"
                    @clear-ref-text="manualRefText = ''"
                    @ref-image-upload="manualRefImageDataUrl = $event"
                    @clear-ref-image="manualRefImageDataUrl = null"
                    @manual-save-order="handleManualSaveOrder"
                    @save-new-goods="handleSaveNewGoodsFromManual"
                    @update-order="handleManualUpdateOrder"
                    @add-order-before="handleManualAddOrderBefore"
                    @cancel-add-order-before="cancelAddOrderBefore"
                    @before-order-goods-name-input="handleBeforeOrderGoodsNameInput"
                    @select-before-order-goods="selectBeforeOrderGoods"
                    @close-before-order-search-results="closeBeforeOrderSearchResults"
                    @before-order-quantity-input="handleBeforeOrderQuantityInput"
                    @before-order-standard-input="handleBeforeOrderStandardInput"
                    @before-order-remark-input="handleBeforeOrderRemarkInput"
                    @save-before-order="handleSaveBeforeOrderManual"
                    @save-new-goods-from-before-order="handleSaveNewGoodsFromBeforeOrder"
                    @download-goods-nx="handleManualDownloadGoodsNx"
                    @before-order-goods-name-enter="handleBeforeOrderGoodsNameEnter"
                    @before-order-goods-name-keydown="handleBeforeOrderGoodsNameKeydown"
            />

            <!-- 复制粘贴模式 -->
            <PasteUpload
                    ref="pasteUploadRef"
                    v-if="uploadType === 'paste'"
                    source="placeOrder"
                    :dep-id="selectedSubDepartment || selectedAllCustomer"
                    :task-type="3"
                    :current-task="currentTask"
                    :paste-input-text="pasteInputText"
                    :paste-invalid-line-indices="pasteInvalidLineIndices"
                    :paste-invalid-segments="pasteInvalidSegments"
                    :paste-no-valid-order="pasteNoValidOrder"
                    :paste-has-cache="hasDataForPaste"
                    :paste-save-count="pasteSaveCount"
                    :paste-order-items="orderItems"
                    :show-deep-seek-loading="showDeepSeekLoading"
                    :select-task-loading="taskLoading"
                    :saving-order="savingOrder"
                    :all-orders-are-draft="allOrdersAreDraft"
                    @select-task="handleSelectPasteTask"
                    @add-new-content="handlePasteAddNew"
                    @close-new-content="handlePasteCloseNewContent"
                    @paste-input="handlePasteInput"
                    @paste-from-clipboard="pasteFromClipboard"
                    @ai-recognise="aiRecogniseFirst"
                    @local-parse="handlePasteLocalParse"
                    @again-paste="againPaste"
                    @save-paste-orders="pastSavePasteOrders"
                    @clear-paste-save="clearPasteSave"
                    @re-upload="reUpload"
                    @show-fix-items="showFixItems"
                    @finish-task="onFinishTask"
                    :tts-playing="pasteTTSState.isTTSPlaying"
                    :tts-loading="pasteTTSState.isTTSLoading"
                    :tts-stopped-index="pasteTTSState.stoppedIndex"
                    @read-order-list="() => handleReadOrderList('paste')"
                    @pause-reading="() => handlePauseReading('paste')"
                    @restart-reading="() => handleRestartReading('paste')"
                    @stop-reading="() => handleStopReading('paste')"
                    @edit-order="handleEditOrderFromPopup"
                    @continue-reading="() => handleContinueReading('paste')"
            >
                <template #order-list>
                    <!-- 草稿状态：使用 DraftOrderList -->
                    <DraftOrderList
                            v-if="pasteSaveCount == null"
                            :order-items="orderItems"
                            :selected-order-index="draftSelectedOrderIndex"
                            empty-message="请粘贴订单文本并解析后，系统将显示订单列表"
                            :adding-order-before-index="addingOrderBeforeIndex"
                            :before-order-form="beforeOrderForm"
                            :order-arr-index="orderArrIndex"
                            :is-valid-order-quantity-and-standard="isValidOrderQuantityAndStandard"
                            @before-order-goods-name-input="handleBeforeOrderGoodsNameInput"
                            @before-order-quantity-input="handleBeforeOrderQuantityInput"
                            @before-order-standard-input="handleBeforeOrderStandardInput"
                            @before-order-remark-input="handleBeforeOrderRemarkInput"
                            @goods-name-input="handleDraftOrderListGoodsNameInput"
                            @quantity-input="handleDraftOrderListQuantityInput"
                            @standard-change="handleDraftOrderListStandardChange"
                            @delete-order="handleDraftOrderListDeleteOrder"
                            @add-order-before="handleDraftOrderListAddOrderBefore"
                            @add-remark="handleDraftOrderListAddRemark"
                            @clear-remark="handleDraftOrderListClearRemark"
                            @remark-input="handleDraftOrderListRemarkInput"
                    />

                    <!-- 已保存状态：使用 OrderList -->
                    <OrderList
                            v-else
                            ref="pasteOrderListRef"
                            :order-items="orderItems"
                            :dis-id="disUser?.nxDiuDistributerId"
                            @tts-state="(p) => onTTSState('paste', p)"
                            empty-message="请粘贴订单文本并解析后，系统将显示订单列表"
                            :adding-order-before-index="addingOrderBeforeIndex"
                            :before-order-form="beforeOrderForm"
                            :show-matched-goods="showMatchedGoods"
                            :order-arr-index="orderArrIndex"
                            :str-arr="strArr"
                            :nx-arr="nxArr"
                            :is-valid-order-quantity-and-standard="isValidOrderQuantityAndStandard"
                            @cancel-add-order-before="cancelAddOrderBefore"
                            @before-order-goods-name-input="handleBeforeOrderGoodsNameInput"
                            @before-order-goods-name-enter="handleBeforeOrderGoodsNameEnter"
                            @select-before-order-goods="selectBeforeOrderGoods"
                            @close-before-order-search-results="closeBeforeOrderSearchResults"
                            @download-goods-nx="downLoadGoodsNx"
                            @before-order-quantity-input="handleBeforeOrderQuantityInput"
                            @before-order-standard-input="handleBeforeOrderStandardInput"
                            @before-order-remark-input="handleBeforeOrderRemarkInput"
                            @save-before-order="handleSaveBeforeOrder"
                            @save-new-goods-from-before-order="handleSaveNewGoodsFromBeforeOrder"
                            @goods-name-input="handleOrderListGoodsNameInput"
                            @goods-name-focus="handleOrderListGoodsNameFocus"
                            @goods-name-blur="handleOrderListGoodsNameBlur"
                            @toggle-matched-goods="toggleMatchedGoods"
                            @close-all-matched-goods="closeAllMatchedGoods"
                            @quantity-input="handleOrderListQuantityInput"
                            @standard-change="handleOrderListStandardChange"
                            @update-order="handleOrderListUpdateOrder"
                            @save-new-goods="handleOrderListSaveNewGoods"
                            @add-new-order-before="handleOrderListAddNewOrderBefore"
                            @delete-order="handleOrderListDeleteOrder"
                            @remark-input="handleOrderListRemarkInput"
                            @select-matched-goods="handleOrderListSelectMatchedGoods"
                            @close-str="closeStr"
                            @select-search-result="handleOrderListSelectSearchResult"

                    />
                </template>
            </PasteUpload>


            <!-- 图片上传模式 -->
            <ImageUpload
                    ref="imageUploadRef"
                    v-if="uploadType === 'image'"
                    source="placeOrder"
                    :dep-id="selectedSubDepartment || selectedAllCustomer"
                    :task-type="1"
                    :current-task="currentTask"
                    :current-task-id="currentTaskId"
                    :has-cache="hasDataForImage"
                    :has-running-task="hasRunningTask"
                    :uploaded-image-file="uploadedImageFile"
                    :image-preview="imagePreview"
                    :image-scale="imageScale"
                    :image-translate-x="imageTranslateX"
                    :image-translate-y="imageTranslateY"
                    :select-task-loading="taskLoading"
                    :show-deep-seek-loading="showDeepSeekLoading"
                    :is-dragging="isDragging"
                    :order-items="orderItems"
                    :all-orders-are-draft="allOrdersAreDraft"
                    :current-reading-text="getCurrentReadingText()"
                    :current-reading-index="getCurrentReadingIndex()"
                    @image-upload="handleImageUpload"
                    @reset-transform="resetImageTransform"
                    @zoom-in="zoomIn"
                    @zoom-out="zoomOut"
                    @image-load="handleImageLoad"
                    @re-upload="reUpload"
                    @show-fix-items="showFixItems"
                    @start-drag="startDrag"
                    @on-drag="onDrag"
                    @end-drag="endDrag"
                    @wheel="onWheel"
                    @finish-task="onFinishTask"
                    :tts-playing="imageTTSState.isTTSPlaying"
                    :tts-loading="imageTTSState.isTTSLoading"
                    :tts-stopped-index="imageTTSState.stoppedIndex"
                    @read-order-list="() => handleReadOrderList('image')"
                    @pause-reading="() => handlePauseReading('image')"
                    @restart-reading="() => handleRestartReading('image')"
                    @stop-reading="() => handleStopReading('image')"
                    @edit-order="handleEditOrderFromPopup"
                    @continue-reading="() => handleContinueReading('image')"
                    @select-task="handleSelectImageTask"
                    @add-new-image="handleImageAddNew"
                    @close-new-image="handleImageCloseNewContent">
                <template #order-list>
                    <OrderList
                            ref="imageOrderListRef"
                            :order-items="orderItems"
                            :dis-id="disUser?.nxDiuDistributerId"
                            :source-type="'image'"
                            @tts-state="(p) => onTTSState('image', p)"
                            empty-message="请在上传图片并识别后，系统将自动解析订单"
                            :adding-order-before-index="addingOrderBeforeIndex"
                            :before-order-form="beforeOrderForm"
                            :show-matched-goods="showMatchedGoods"
                            :order-arr-index="orderArrIndex"
                            :str-arr="strArr"
                            :nx-arr="nxArr"
                            :is-valid-order-quantity-and-standard="isValidOrderQuantityAndStandard"
                            @cancel-add-order-before="cancelAddOrderBefore"
                            @before-order-goods-name-input="handleBeforeOrderGoodsNameInput"
                            @before-order-goods-name-enter="handleBeforeOrderGoodsNameEnter"
                            @select-before-order-goods="selectBeforeOrderGoods"
                            @close-before-order-search-results="closeBeforeOrderSearchResults"
                            @download-goods-nx="downLoadGoodsNx"
                            @before-order-quantity-input="handleBeforeOrderQuantityInput"
                            @before-order-standard-input="handleBeforeOrderStandardInput"
                            @before-order-remark-input="handleBeforeOrderRemarkInput"
                            @save-before-order="handleSaveBeforeOrderImage"
                            @save-new-goods-from-before-order="handleSaveNewGoodsFromBeforeOrder"
                            @goods-name-input="handleOrderListGoodsNameInputImage"
                            @goods-name-focus="handleOrderListGoodsNameFocusImage"
                            @goods-name-blur="handleOrderListGoodsNameBlurImage"
                            @toggle-matched-goods="toggleMatchedGoods"
                            @close-all-matched-goods="closeAllMatchedGoods"
                            @quantity-input="handleOrderListQuantityInputImage"
                            @standard-change="handleOrderListStandardChangeImage"
                            @update-order="handleOrderListUpdateOrderImage"
                            @save-new-goods="handleOrderListSaveNewGoodsImage"
                            @add-new-order-before="handleOrderListAddNewOrderBeforeImage"
                            @delete-order="handleOrderListDeleteOrderImage"
                            @remark-input="handleOrderListRemarkInputImage"
                            @select-matched-goods="handleOrderListSelectMatchedGoodsImage"
                            @close-str="closeStr"
                            @select-search-result="handleOrderListSelectSearchResultImage"/>
                </template>
            </ImageUpload>


            <!-- Excel 粘贴区域（首次打开后保持挂载，避免每次切换都重建左侧 vxe-table） -->
            <div v-if="uploadType === 'excel-paste' || excelPasteEverShown"
                 v-show="uploadType === 'excel-paste'"
                 style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
            <ExcelPasteUpload
                    ref="excelPasteUploadRef"
                    :task-type="2"
                    source="placeOrder"
                    :dep-id="selectedSubDepartment || selectedAllCustomer"
                    :current-task-id="currentTaskId"
                    :current-task="currentTask"
                    :select-task-loading="taskLoading"
                    :table-data="excelPasteTableData"
                    :has-table-data="hasExcelPasteTableData()"
                    :excel-paste-order-items="orderItems"
                    :excel-paste-has-cache="hasDataForExcelPaste"
                    :excel-paste-save-count="excelPasteSaveCount"
                    :show-deep-seek-loading="showDeepSeekLoading"
                    :saving-order="savingOrder"
                    :all-orders-are-draft="allOrdersAreDraft"
                    :parse-excel-paste-data="parseExcelPasteData"
                    @clear-table-data="clearExcelPasteTableData"
                    @ai-recognise="handleExcelPasteAiRecognise"
                    @ai-recognise-complete="handleExcelPasteAiRecogniseComplete"
                    @direct-table-to-orders="handleDirectExcelPasteTableToOrders"
                    @select-task="handleSelectExcelPasteTask"
                    @add-new-content="handleExcelPasteAddNew"
                    @close-new-content="handleExcelPasteCloseNewContent"
                    @clear-order-items="clearExcelPasteOrderItems"
                    @save-orders="saveExcelPasteOrders"
                    @re-upload="reUpload"
                    @finish-task="onFinishTask"
                    @show-fix-items="showFixItems"
                    @table-data-update="handleExcelPasteTableDataUpdate"
                    @insert-row-above="handleExcelPasteInsertRowAbove"
                    @delete-row="handleExcelPasteDeleteRow"
                    @cell-click="handleExcelPasteCellClick"
                    @edit-closed="handleExcelPasteEditClosed"
                    :tts-playing="getTTSState('excelPaste').isTTSPlaying"
                    :tts-loading="getTTSState('excelPaste').isTTSLoading"
                    :tts-stopped-index="getTTSState('excelPaste').stoppedIndex"
                    @read-order-list="() => handleReadOrderList('excelPaste')"
                    @pause-reading="() => handlePauseReading('excelPaste')"
                    @restart-reading="() => handleRestartReading('excelPaste')"
                    @stop-reading="() => handleStopReading('excelPaste')"
                    @continue-reading="() => handleContinueReading('excelPaste')">
                <template #order-list>
                    <!-- 草稿状态：使用 DraftOrderList（简化版，没有商品搜索） -->
                    <DraftOrderList
                            v-if="excelPasteSaveCount == null"
                            :order-items="orderItems"
                            :selected-order-index="draftSelectedOrderIndex"
                            empty-message="请从 Excel 复制数据并粘贴后，点击'Ai解析订单'按钮"
                            :adding-order-before-index="null"
                            :before-order-form="{}"
                            @goods-name-input="handleExcelPasteDraftGoodsNameInput"
                            @quantity-input="handleExcelPasteDraftQuantityInput"
                            @standard-change="handleExcelPasteDraftStandardChange"
                            @delete-order="handleExcelPasteDraftDeleteOrder"
                            @add-order-before="handleExcelPasteDraftAddOrderBefore"
                            @add-remark="handleExcelPasteDraftAddRemark"
                            @clear-remark="handleExcelPasteDraftClearRemark"
                            @remark-input="handleExcelPasteDraftRemarkInput"/>

                    <!-- 已保存状态：使用 OrderList -->
                    <OrderList
                            v-else
                            ref="excelPasteOrderListRef"
                            :order-items="orderItems"
                            :dis-id="disUser?.nxDiuDistributerId"
                            @tts-state="(p) => onTTSState('excelPaste', p)"
                            empty-message="请从 Excel 复制数据并粘贴后，点击'Ai解析订单'按钮"
                            :adding-order-before-index="addingOrderBeforeIndex"
                            :before-order-form="beforeOrderForm"
                            :show-matched-goods="showMatchedGoods"
                            :order-arr-index="orderArrIndex"
                            :str-arr="strArr"
                            :nx-arr="nxArr"
                            :is-valid-order-quantity-and-standard="isValidOrderQuantityAndStandard"
                            @cancel-add-order-before="cancelAddOrderBefore"
                            @before-order-goods-name-input="handleBeforeOrderGoodsNameInput"
                            @before-order-goods-name-enter="handleBeforeOrderGoodsNameEnter"
                            @select-before-order-goods="selectBeforeOrderGoods"
                            @close-before-order-search-results="closeBeforeOrderSearchResults"
                            @download-goods-nx="downLoadGoodsNx"
                            @before-order-quantity-input="handleBeforeOrderQuantityInput"
                            @before-order-standard-input="handleBeforeOrderStandardInput"
                            @before-order-remark-input="handleBeforeOrderRemarkInput"
                            @save-before-order="handleSaveBeforeOrderExcelPaste"
                            @save-new-goods-from-before-order="handleSaveNewGoodsFromBeforeOrder"
                            @goods-name-input="handleOrderListGoodsNameInputExcelPaste"
                            @goods-name-focus="handleOrderListGoodsNameFocusExcelPaste"
                            @goods-name-blur="handleOrderListGoodsNameBlurExcelPaste"
                            @toggle-matched-goods="toggleMatchedGoods"
                            @close-all-matched-goods="closeAllMatchedGoods"
                            @quantity-input="handleOrderListQuantityInputExcelPaste"
                            @standard-change="handleOrderListStandardChangeExcelPaste"
                            @update-order="handleOrderListUpdateOrderExcelPaste"
                            @save-new-goods="handleOrderListSaveNewGoodsExcelPaste"
                            @add-new-order-before="handleOrderListAddNewOrderBeforeExcelPaste"
                            @delete-order="handleOrderListDeleteOrderExcelPaste"
                            @remark-input="handleOrderListRemarkInputExcelPaste"
                            @select-matched-goods="handleOrderListSelectMatchedGoodsExcelPaste"
                            @close-str="closeStr"
                            @select-search-result="handleOrderListSelectSearchResultExcelPaste"/>
                </template>
            </ExcelPasteUpload>
            </div>
            <!-- Excel上传模式 -->
            <ExcelUpload
                    v-if="uploadType === 'excel'"
                    ref="excelUploadRef"
                    :has-cache="hasDataForImage"
                    :has-running-task="hasRunningTask"
                    :uploaded-excel-file="uploadedExcelFile"
                    :uploaded-excel-preview="uploadedExcelPreview"
                    :order-items="orderItems"
                    :all-orders-are-draft="allOrdersAreDraft"
                    @excel-upload="handleExcelUpload"
                    @change-sheet="changeUploadedExcelSheet"
                    @excel-preview-loaded="handleExcelPreviewLoaded"
                    @re-upload="reUpload"
                    @show-fix-items="showFixItems"
                    :tts-playing="getTTSState('excel').isTTSPlaying"
                    :tts-loading="getTTSState('excel').isTTSLoading"
                    :tts-stopped-index="getTTSState('excel').stoppedIndex"
                    @read-order-list="() => handleReadOrderList('excel')"
                    @pause-reading="() => handlePauseReading('excel')"
                    @restart-reading="() => handleRestartReading('excel')"
                    @stop-reading="() => handleStopReading('excel')"
                    @continue-reading="() => handleContinueReading('excel')">
                <template #order-list>
                    <OrderList
                            ref="excelOrderListRef"
                            :order-items="orderItems"
                            :dis-id="disUser?.nxDiuDistributerId"
                            @tts-state="(p) => onTTSState('excel', p)"
                            empty-message="请在上传Excel文件后，系统将自动解析订单"
                            :adding-order-before-index="addingOrderBeforeIndex"
                            :before-order-form="beforeOrderForm"
                            :show-matched-goods="showMatchedGoods"
                            :order-arr-index="orderArrIndex"
                            :str-arr="strArr"
                            :nx-arr="nxArr"
                            :is-valid-order-quantity-and-standard="isValidOrderQuantityAndStandard"
                            @cancel-add-order-before="cancelAddOrderBefore"
                            @before-order-goods-name-input="handleBeforeOrderGoodsNameInput"
                            @before-order-goods-name-enter="handleBeforeOrderGoodsNameEnter"
                            @select-before-order-goods="selectBeforeOrderGoods"
                            @close-before-order-search-results="closeBeforeOrderSearchResults"
                            @download-goods-nx="downLoadGoodsNx"
                            @before-order-quantity-input="handleBeforeOrderQuantityInput"
                            @before-order-standard-input="handleBeforeOrderStandardInput"
                            @before-order-remark-input="handleBeforeOrderRemarkInput"
                            @save-before-order="handleSaveBeforeOrder"
                            @save-new-goods-from-before-order="handleSaveNewGoodsFromBeforeOrder"
                            @goods-name-input="handleOrderListGoodsNameInput"
                            @goods-name-focus="handleOrderListGoodsNameFocus"
                            @goods-name-blur="handleOrderListGoodsNameBlur"
                            @toggle-matched-goods="toggleMatchedGoods"
                            @close-all-matched-goods="closeAllMatchedGoods"
                            @quantity-input="handleOrderListQuantityInput"
                            @standard-change="handleOrderListStandardChange"
                            @update-order="handleOrderListUpdateOrder"
                            @save-new-goods="handleOrderListSaveNewGoods"
                            @add-new-order-before="handleOrderListAddNewOrderBefore"
                            @delete-order="handleOrderListDeleteOrder"
                            @remark-input="handleOrderListRemarkInput"
                            @select-matched-goods="handleOrderListSelectMatchedGoods"
                            @close-str="closeStr"
                            @select-search-result="handleOrderListSelectSearchResult"/>
                </template>
            </ExcelUpload>

            <!-- Auto 模式 -->
            <AutoUpload
                    v-if="uploadType === 'auto'"
                    :has-cache="hasDataForImage"
                    :customer-folder-path="customerFolderPath"
                    :scanning-files="scanningFiles"
                    :processing-files="processingFiles"
                    :auto-process-files="autoProcessFiles"
                    :pending-files="pendingFiles"
                    :processed-files="processedFiles"
                    :active-processed-file-tab="activeProcessedFileTab"
                    :auto-process-progress="autoProcessProgress"
                    :current-preview-image="currentPreviewImage"
                    :current-preview-image-src="currentPreviewImageSrc"
                    :image-translate-x="imageTranslateX"
                    :image-translate-y="imageTranslateY"
                    :image-scale="imageScale"
                    :is-dragging="isDragging"
                    :auto-process-excel-previews="autoProcessExcelPreviews"
                    :filtered-order-items="filteredOrderItems"
                    :all-orders-are-draft="allOrdersAreDraft"
                    @scan-folder-files="scanFolderFiles"
                    @start-auto-process="startAutoProcess"
                    @active-processed-file-tab-change="handleActiveProcessedFileTabChange"
                    @start-drag="startDrag"
                    @wheel="onWheel"
                    @reset-transform="resetImageTransform"
                    @zoom-in="zoomIn"
                    @zoom-out="zoomOut"
                    @image-load="handleImageLoadAuto"
                    @change-excel-sheet="changeExcelSheet"
                    @open-file="openFile"
                    @re-upload="reUpload"
                    @show-fix-items="showFixItems">
                <template #order-list>
                    <OrderList
                            ref="autoOrderListRef"
                            :order-items="filteredOrderItems"
                            :dis-id="disUser?.nxDiuDistributerId"
                            empty-message="请处理文件夹中的文件后，系统将自动解析订单"
                            :adding-order-before-index="addingOrderBeforeIndex"
                            :before-order-form="beforeOrderForm"
                            :show-matched-goods="showMatchedGoods"
                            :order-arr-index="orderArrIndex"
                            :str-arr="strArr"
                            :nx-arr="nxArr"
                            :is-valid-order-quantity-and-standard="isValidOrderQuantityAndStandard"
                            @cancel-add-order-before="cancelAddOrderBefore"
                            @before-order-goods-name-input="handleBeforeOrderGoodsNameInput"
                            @before-order-goods-name-enter="handleBeforeOrderGoodsNameEnter"
                            @select-before-order-goods="selectBeforeOrderGoods"
                            @close-before-order-search-results="closeBeforeOrderSearchResults"
                            @download-goods-nx="downLoadGoodsNx"
                            @before-order-quantity-input="handleBeforeOrderQuantityInput"
                            @before-order-standard-input="handleBeforeOrderStandardInput"
                            @before-order-remark-input="handleBeforeOrderRemarkInput"
                            @save-before-order="handleSaveBeforeOrderAuto"
                            @save-new-goods-from-before-order="handleSaveNewGoodsFromBeforeOrder"
                            @goods-name-input="handleOrderListGoodsNameInputAuto"
                            @goods-name-focus="handleOrderListGoodsNameFocusAuto"
                            @goods-name-blur="handleOrderListGoodsNameBlurAuto"
                            @toggle-matched-goods="toggleMatchedGoods"
                            @close-all-matched-goods="closeAllMatchedGoods"
                            @quantity-input="handleOrderListQuantityInputAuto"
                            @standard-change="handleOrderListStandardChangeAuto"
                            @update-order="handleOrderListUpdateOrderAuto"
                            @save-new-goods="handleOrderListSaveNewGoodsAuto"
                            @add-new-order-before="handleOrderListAddNewOrderBeforeAuto"
                            @delete-order="handleOrderListDeleteOrderAuto"
                            @remark-input="handleOrderListRemarkInputAuto"
                            @select-matched-goods="handleOrderListSelectMatchedGoodsAuto"
                            @close-str="closeStr"
                            @select-search-result="handleOrderListSelectSearchResultAuto"/>
                </template>
            </AutoUpload>


        </div>


        <!-- 修改订单弹窗（参考 TodayOrders.vue） -->
        <div v-if="showEditOrderModal" class="order-edit-overlay" @click.self="closeEditOrderModal">
            <div class="order-edit-popup">
                <!-- 顶部商品名称 -->
                <div class="popup-header text-center p-3 bg-light border-bottom">
                    <div class="d-flex align-items-center justify-content-center flex-wrap mb-2">
                    <span v-if="currentEditOrderItem?.nxDistributerGoodsEntity?.nxDgGoodsBrand && currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsBrand !== 'null'"
                          class="brand me-2">
                        {{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsBrand }}
                    </span>
                        <span class="fw-bold">{{ currentEditOrderItem?.nxDistributerGoodsEntity?.nxDgGoodsName || currentEditOrderItem?.nxDoGoodsName || '商品名称' }}</span>
                    </div>
                    <div v-if="currentEditOrderItem?.nxDistributerGoodsEntity" class="small text-muted">
                    <span v-if="currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsDetail && currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsDetail !== 'null'">
                        {{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsDetail }}
                              </span>
                        <span v-if="currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardWeight && currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== 'null'">
                        ({{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardname }}/{{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }})
                              </span>
                        <span v-else-if="currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardname">
                        ({{ currentEditOrderItem.nxDistributerGoodsEntity.nxDgGoodsStandardname }})
                              </span>
                    </div>
                </div>

                <!-- 输入内容 -->
                <div class="popup-body p-3">
                    <!-- 订货数量 -->
                    <div class="input-group mb-3 d-flex align-items-center">
                        <label class="form-label mb-0" style="width: 90px; flex-shrink: 0;">订货数量:</label>
                        <div style="width: 300px; flex-shrink: 0; text-align: left;">
                            <input
                                    type="number"
                                    class="form-control form-control-sm"
                                    v-model="editOrderForm.quantity"
                                    placeholder="请输入数量"
                            />
                        </div>
                    </div>

                    <!-- 单位 -->
                    <div class="input-group mb-3 d-flex align-items-start">
                        <label class="form-label mb-0" style="width: 90px; flex-shrink: 0;">单位:</label>
                        <div style="width: 300px; flex-shrink: 0; text-align: left;">
                            <div class="d-flex flex-wrap gap-2">
                                <!-- 商品的标准单位 -->
                                <button
                                        v-if="itemDis && itemDis.nxDgGoodsStandardname"
                                        class="btn btn-sm standard-btn"
                                        :class="editOrderForm.standard === itemDis.nxDgGoodsStandardname ? 'btn-success' : 'btn-outline-secondary'"
                                        @click="editOrderForm.standard = itemDis.nxDgGoodsStandardname">
                                    {{ itemDis.nxDgGoodsStandardname }}
                                </button>
                                <!-- 商品的规格列表 -->
                                <button
                                        v-for="standard in (itemDis && itemDis.nxDistributerStandardEntities ? itemDis.nxDistributerStandardEntities : [])"
                                        :key="standard.nxDistributerStandardId"
                                        class="btn btn-sm standard-btn"
                                        :class="editOrderForm.standard === standard.nxDsStandardName ? 'btn-success' : 'btn-outline-secondary'"
                                        @click="editOrderForm.standard = standard.nxDsStandardName">
                                    {{ standard.nxDsStandardName }}
                                </button>
                                <!-- 添加规格按钮 -->
                                <button
                                        v-if="!showAddStandard && itemDis && itemDis.nxDistributerGoodsId"
                                        class="btn btn-sm btn-outline-secondary standard-btn"
                                        @click="showAddStandard = true">
                                    +
                                </button>
                            </div>
                            <!-- 添加规格输入框 -->
                            <div v-if="showAddStandard" class="d-flex align-items-center gap-2 mt-2">
                                <input
                                        type="text"
                                        class="form-control form-control-sm"
                                        v-model="newStandardName"
                                        @focus="focusType = 'standard'"
                                        @blur="focusType = ''"
                                        placeholder="请输入规格名称"
                                        style="flex: 1; max-width: 200px;"
                                />
                                <button class="btn btn-sm btn-outline-secondary" @click="showAddStandard = false">取消
                                </button>
                                <button class="btn btn-sm btn-primary" @click="confirmAddStandard">保存</button>
                            </div>
                        </div>
                    </div>

                    <!-- 备注 -->
                    <div class="input-group mb-3 d-flex align-items-center">
                        <label class="form-label mb-0" style="width: 90px; flex-shrink: 0;">备注:</label>
                        <div style="width: 300px; flex-shrink: 0; text-align: left;">
                            <input
                                    type="text"
                                    class="form-control form-control-sm"
                                    v-model="editOrderForm.remark"
                                    placeholder="请输入备注（最多15个字符）"
                                    maxlength="15"
                            />
                        </div>
                    </div>
                </div>

                <!-- 按钮组 -->
                <div class="popup-footer d-flex p-3 border-top bg-light justify-content-center">
                    <button
                            class="btn btn-sm btn-danger"
                            @click="handleDeleteOrderFromEditModal"
                            style="flex: 0 0 auto; width: 80px;">
                        删除
                    </button>
                    <template v-if="currentEditOrderItem?.nxDoTrainingDataId">
                        <div style="width: 48px; flex-shrink: 0;"></div>
                        <button
                                class="btn btn-sm btn-warning"
                                @click="handleRevertOrderFromEditModal"
                                style="flex: 0 0 auto; width: 90px;">
                            重新识别
                        </button>
                        <div style="width: 48px; flex-shrink: 0;"></div>
                    </template>
                    <div v-else style="width: 186px; flex-shrink: 0;"></div>
                    <button
                            class="btn btn-sm btn-secondary"
                            @click="closeEditOrderModal"
                            style="flex: 0 0 auto; width: 80px;">
                        关闭
                    </button>
                    <div style="width: 8px; flex-shrink: 0;"></div>
                    <button
                            class="btn btn-sm btn-success"
                            @click="confirmUpdateOrder"
                            style="flex: 0 0 auto; width: 160px;">
                        保存
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- 调整订单内容弹窗 -->
    <div v-if="showFixItemsModal" class="order-edit-overlay" @click.self="closeFixItemsModal">
        <div class="order-edit-popup" style="max-width: 600px;">
            <!-- 顶部标题 -->
            <div class="popup-header text-center p-3 bg-light border-bottom">
                <h5 class="mb-0">调整订单内容</h5>
                <div class="small text-muted mt-2">请输入您的修改要求，系统将自动调整订单</div>
            </div>

            <!-- 输入内容 -->
            <div class="popup-body p-3">
                <!-- 当前订单信息预览 -->
                <div class="mb-3">
                    <label class="form-label fw-bold">当前订单列表：</label>
                    <div class="border rounded p-2 bg-light" style="max-height: 200px; overflow-y: auto;">
                        <div v-for="(item, index) in currentFixItemsOrderList" :key="index" class="mb-1 small">
                            <span class="text-muted">{{ index + 1 }}.</span>
                            <span class="ms-2">{{ item.nxDoGoodsName || '未命名商品' }}</span>
                            <span class="text-muted ms-2">{{ item.nxDoQuantity || '0' }} {{ item.nxDoStandard || '' }}</span>
                            <span v-if="item.nxDoRemark" class="text-muted ms-2">({{ item.nxDoRemark }})</span>
                        </div>
                        <div v-if="currentFixItemsOrderList.length === 0" class="text-muted text-center py-2">
                            暂无订单
                        </div>
                    </div>
                </div>

                <!-- 修改要求输入 -->
                <div class="mb-3">
                    <label class="form-label fw-bold">修改要求：</label>
                    <textarea
                            class="form-control form-control-sm"
                            v-model="fixItemsRequirement"
                            rows="5"
                            placeholder='批量修改要求'
                            style="resize: vertical;"
                    ></textarea>
                    <div class="form-text">请描述对解析订单的批量修改要求</div>
                </div>

                <!-- 处理状态 -->
                <div v-if="isProcessingFixItems" class="text-center py-2">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">处理中...</span>
                    </div>
                    <span class="ms-2">正在处理您的修改要求，请稍候...</span>
                </div>
            </div>

            <!-- 按钮组 -->
            <div class="popup-footer d-flex p-3 border-top bg-light justify-content-center">
                <button
                        class="btn btn-sm btn-secondary"
                        @click="closeFixItemsModal"
                        :disabled="isProcessingFixItems"
                        style="flex: 0 0 auto; width: 100px;">
                    取消
                </button>
                <div style="width: 16px; flex-shrink: 0;"></div>
                <button
                        class="btn btn-sm btn-primary"
                        @click.stop="confirmFixItems"
                        :disabled="isProcessingFixItems || !fixItemsRequirement.trim()"
                        style="flex: 0 0 auto; width: 100px;">
                    确定
                </button>
            </div>
        </div>
    </div>

    <!-- 任务全部完成提示弹窗（已屏蔽：不再监控任务状态弹窗） -->
    <div v-if="false && showTaskCompleteModal" class="order-edit-overlay" @click.self="closeTaskCompleteModal">
        <div class="order-edit-popup" style="max-width: 420px;" ref="taskCompleteModalRef" tabindex="-1">
            <div class="popup-header text-center p-3 bg-light border-bottom">
                <h5 class="mb-0">提示</h5>
            </div>
            <div class="popup-body p-3 text-center">
                <div class="mb-3">这个任务订单已经全部处理完成，请检查订单是否正确</div>
            </div>
            <div class="popup-footer d-flex p-3 border-top bg-light justify-content-center gap-2">
                <button class="btn btn-sm btn-secondary" @click="closeTaskCompleteModal"
                        style="flex: 0 0 auto; width: 100px;">检查
                </button>
                <button ref="taskCompleteModalCompleteBtn" class="btn btn-sm btn-primary" @click="confirmTaskCompleteModal"
                        style="flex: 0 0 auto; width: 100px;">完成
                </button>
            </div>
        </div>
    </div>

    <!-- 保存新商品弹窗 -->
    <div v-if="showSaveNewGoodsModal" class="order-edit-overlay" @click.self="closeSaveNewGoodsModal">
        <div class="order-edit-popup" style="max-width: 600px;">
            <!-- 顶部标题 -->
            <div class="popup-header text-center p-3 bg-light border-bottom">
                <h5 class="mb-0">保存新商品</h5>
                <!-- <div class="small text-muted mt-2">请确认并修改商品信息</div> -->
            </div>

            <!-- 输入内容 -->
            <div class="popup-body p-3">
                <!-- 商品名称 -->
                <div class="mb-3 d-flex gap-3">
                    <label class="form-label text-muted mb-0" style="min-width: 120px; flex-shrink: 0; padding-top: 8px;">商品名称：</label>
                    <div class="d-flex flex-column flex-grow-1">
                        <input
                                type="text"
                                class="form-control-add"
                                v-model="saveNewGoodsForm.goodsName"
                                placeholder="请输入商品名称"
                        />
                 </div>
                </div>

                <!-- 商品规格名称 -->
                <div class="mb-3 d-flex gap-3">
                    <label class="form-label text-muted mb-0" style="min-width: 120px; flex-shrink: 0; padding-top: 8px;">商品规格名称：</label>
                    <div class="d-flex flex-column flex-grow-1">
                        <input
                                type="text"
                                class="form-control-add"
                                v-model="saveNewGoodsForm.standardName"
                        />
                    </div>
                </div>

                <!-- 商品规格重量 -->
                <div class="mb-3 d-flex gap-3">
                    <label class="form-label text-muted mb-0" style="min-width: 120px; flex-shrink: 0; padding-top: 8px;">商品规格重量：</label>
                    <div class="d-flex flex-column flex-grow-1">
                        <input
                                type="text"
                                class="form-control-add"
                                v-model="saveNewGoodsForm.standardWeight"

                        />
                        <div class="form-text">可选，如：250ml、500g等</div>
                    </div>
                </div>


                <!-- 箱单位 -->
                <div class="mb-3 d-flex gap-3">
                    <label class="form-label text-muted mb-0" style="min-width: 120px; flex-shrink: 0; padding-top: 8px;">大包装单位：</label>
                    <div class="d-flex flex-column flex-grow-1">
                        <input
                                type="text"
                                class="form-control-add"
                                v-model="saveNewGoodsForm.cartonUnit"

                        />
                        <div class="form-text">可选，如：箱</div>
                    </div>
                </div>

                <!-- 每箱数量 -->
                <div class="mb-3 d-flex gap-3">
                    <label class="form-label text-muted mb-0" style="min-width: 120px; flex-shrink: 0; padding-top: 8px;">大包装数量：</label>
                    <div class="d-flex flex-column flex-grow-1">
                        <input
                                type="number"
                                class="form-control-add"
                                v-model.number="saveNewGoodsForm.itemsPerCarton"

                                min="0"
                                step="1"
                        />
                        <div class="form-text">可选，只能输入数字，如：36</div>
                    </div>
                </div>
            </div>

            <!-- 按钮组 -->
            <div class="popup-footer d-flex p-3 border-top bg-light justify-content-center">
                <button
                        class="btn btn-sm btn-secondary"
                        @click="closeSaveNewGoodsModal"
                        style="flex: 0 0 auto; width: 100px;">
                    取消
                </button>
                <div style="width: 16px; flex-shrink: 0;"></div>
                <button
                        class="btn btn-sm btn-primary"
                        @click="confirmSaveNewGoods"
                        :disabled="!saveNewGoodsForm.goodsName || !saveNewGoodsForm.goodsName.trim() || !saveNewGoodsForm.standardName || !saveNewGoodsForm.standardName.trim()"
                        style="flex: 0 0 auto; width: 100px;">
                    保存
                </button>
            </div>
        </div>
    </div>

    <!-- 图片预览/裁剪弹窗组件 -->
    <ImageCropperModal
            v-model="showImagePreviewModal"
            :src="previewImageDataUrl"
            title="图片预览与裁剪"
            @cancel="closeImagePreviewModal"
            @direct-recognize="handleDirectRecognize"
            @direct-recognize-ai="handleDirectRecognizeAi"
            @confirm="handleCropConfirm"
    />

    <!-- Toast 提示组件 -->
    <Toast
            v-model:visible="toastVisible"
            :message="toastMessage"
            :type="toastType"
            :duration="toastDuration"
    />

    <!-- Alert 弹窗组件 -->
    <AlertDialog ref="alertDialog" />

</template>

<script>
    import api from "../api/all";
    import taskQueue from "../utils/taskQueue";
    import taskExecutor from "../utils/taskExecutor";
    import {parseOrderFromText} from '../utils/pasteOrderParser';
    import ImageCropperModal from './ImageCropperModal.vue';
    import ExcelUpload from './upload/ExcelUpload.vue';
    import ImageUpload from './upload/ImageUpload.vue';
    import ManualEntryUpload from './upload/ManualEntryUpload.vue';
    import PasteUpload from './upload/PasteUpload.vue';
    import ExcelPasteUpload from './upload/ExcelPasteUpload.vue';
    import AutoUpload from './upload/AutoUpload.vue';
    import OrderList from './OrderList.vue';
    import DraftOrderList from './DraftOrderList.vue';
    import Toast from './Toast.vue';
    import AlertDialog from './AlertDialog.vue';

    export default {
        name: 'PlaceOrder',
        components: {
            ImageCropperModal,
            ExcelUpload,
            ImageUpload,
            ManualEntryUpload,
            PasteUpload,
            ExcelPasteUpload,
            AutoUpload,
            OrderList,
            DraftOrderList,
            Toast,
            AlertDialog
        },
        emits: ['order-saved', 'upload-type-change', 'switch-to-today-orders', 'task-added'],
        props: {
            // 从父组件传递的客户信息
            selectedAllCustomer: {
                type: [Number, String],
                default: null
            },
            selectedSubDepartment: {
                type: [Number, String],
                default: null
            },
            selectedCustomerEntity: {
                type: Object,
                default: null
            },
            selectedCustomerName: {
                type: String,
                default: ''
            }
        },
        data() {
            return {
                // 上传类型
                uploadType: 'manual', // 'manual'、'paste'、'image'、'excel-paste'、'excel'、'auto'
                excelPasteEverShown: false, // Excel 粘贴是否曾被打开过（用于保持挂载，避免每次切换都重建 vxe-table）

                // 订单相关
                orderItems: [], // 订单项列表（所有上传模式统一）
                savingOrder: false, // 是否正在保存订单
                recognizingImage: false, // 是否正在识别图片
                recognizingExcel: false, // 是否正在识别Excel
                hasRunningTask: false, // 是否有进行中的识别任务
                taskCheckTimer: null, // 任务状态检查定时器
                currentTaskId: null, // 当前任务ID（后端 nxOcrTaskId，统一用于各上传模式）
                currentTask: null, // 当前任务对象（后端返回的 task）
                taskLoading: false, // 切换任务时请求任务内容中（用于蒙版）
                taskStatusPollTimer: null, // nxOcrTaskStatus===0 时轮询 getTaskOrders 的定时器
                pasteLastState: null, // 进入「添加新内容」前保存的状态，关闭时仅做页面恢复不请求接口
                excelPasteLastState: null, // Excel 粘贴：进入「添加新表格」前保存的状态
                imageLastState: null, // 进入「添加新图片」前保存的状态，关闭时仅做页面恢复不请求接口

                // Excel上传相关
                uploadedExcelFile: null, // 当前上传的Excel文件信息
                uploadedExcelPreview: null, // 当前上传的Excel文件预览数据

                // 图片上传相关
                uploadedImageFile: null, // 当前上传的图片文件信息
                imagePreview: null, // 图片预览URL
                imageScale: 1, // 图片缩放比例
                imageTranslateX: 0, // 图片X轴偏移
                imageTranslateY: 0, // 图片Y轴偏移
                isDragging: false, // 是否正在拖拽
                dragStartX: 0, // 拖拽起始X坐标
                dragStartY: 0, // 拖拽起始Y坐标
                // 各上传模式的 TTS 状态（paste / image / excelPaste / excel），统一供播放/暂停/重读/继续按钮
                ttsStateByMode: {
                    paste: {isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1},
                    image: {isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1},
                    excelPaste: {isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1},
                    excel: {isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1}
                },

                // 图片裁剪相关
                showImagePreviewModal: false, // 是否显示图片预览/裁剪弹窗
                previewImageDataUrl: null, // 弹窗中预览的图片DataURL

                // 手动录入参考区
                manualRefText: '',
                manualRefImageDataUrl: null,

                // 复制粘贴相关
                pasteInputText: '', // 粘贴的文本内容
                pasteSaveCount: null, // 复制粘贴已保存订单数量（null=草稿状态，数字=已保存状态）
                draftSelectedOrderIndex: -1, // 草稿列表中要滚动并选中的订单索引（0-based），-1 表示不选中
                pasteOriginText: '', // 原始粘贴文本（用于重新粘贴）
                pasteInputContent: '', // 输入框内容（与 pasteInputText 同步）
                pasteInvalidLineIndices: [], // 解析后校验不合格的行索引（兼容）
                pasteInvalidSegments: [], // 解析后校验不合格的片段 { lineIndex, segmentText }，用于片段级红色高亮
                pasteNoValidOrder: false, // 未解析到有效订单标记
                showDeepSeekLoading: false, // DeepSeek API 加载状态

                // Excel 粘贴相关
                excelPasteSaveCount: null, // Excel 粘贴已保存订单数量（null=草稿状态，数字=已保存状态）
                excelPasteRawData: [], // Excel 粘贴的原始数据（用于预览）
                excelPasteTableData: Array.from({length: 50}, () => ({
                    goodsName: '',
                    quantity: '',
                    specification: '',
                    specificationWeight: '',
                    cartonQuantity: '',
                    cartonName: '',
                    remark: ''
                })), // Excel 粘贴表格数据，包含固定列：商品名称、数量、规格、规格重量、大包装数量、大包装名称、备注，默认50行
                currentPasteRowIndex: 0, // 当前粘贴的起始行索引
                currentPasteColIndex: 0, // 当前粘贴的起始列索引

                // 商品搜索相关
                strArr: [], // 配送商商品搜索结果
                nxArr: [], // 系统商品搜索结果
                orderArrIndex: -1, // 当前正在编辑的订单索引
                currentSourceType: null, // 当前操作的来源类型（'excel'、'image'、'paste'）
                searchStr: '', // 搜索关键词
                goodsId: '', // 商品ID（用于选择商品后保存）
                selectedGoodsName: '', // 选择的商品名称
                goodsName: '', // 商品名称（用于搜索）
                lastSearchValue: '', // 上一次搜索的值，用于避免重复请求

                // 已匹配商品列表显示控制
                showMatchedGoods: {}, // 跟踪每个订单的已匹配商品列表显示状态

                // 缓存相关

                // 转订单相关
                customerFolderPath: null, // 客户文件夹路径
                selectingFolder: false, // 是否正在选择文件夹
                scanningFiles: false, // 是否正在扫描文件
                autoProcessFiles: [], // 待处理的文件列表
                processingFiles: false, // 是否正在处理文件
                autoProcessProgress: { // 处理进度
                    current: 0,
                    total: 0,
                    percent: 0
                },
                autoProcessResults: [], // 处理结果
                autoProcessImagePreview: null, // 转订单模式下的图片预览URL
                autoProcessImagePreviewFileName: '', // 当前预览的图片文件名
                autoProcessImagePreviews: {}, // 已处理图片文件的完整图片预览缓存 { filePath: base64Url }
                autoProcessExcelPreviews: {}, // 已处理Excel文件的数据预览缓存 { filePath: { sheets: [], currentSheet: 0 } }
                activeProcessedFileTab: null, // 当前激活的已处理文件标签 { filePath: string }

                // 修改订单弹窗相关（参考 TodayOrders.vue）
                showEditOrderModal: false, // 是否显示修改订单弹窗
                currentEditOrderItem: null, // 正在编辑的订单项
                currentEditOrderIndex: -1, // 正在编辑的订单索引
                currentEditOrderSourceType: null, // 正在编辑的订单来源类型
                itemDis: null, // 商品的完整信息（包含规格列表）
                showAddStandard: false, // 是否显示添加规格输入框
                newStandardName: '', // 新规格名称
                focusType: '', // 当前聚焦的输入框类型
                editOrderForm: { // 编辑订单表单数据
                    quantity: '',
                    standard: '',
                    remark: ''
                },

                // 之前添加新订单相关
                addingOrderBeforeIndex: -1, // 当前正在"之前添加新订单"的订单索引（-1表示未激活）
                _beforeOrderStandardHasAutoFilledCarton: false, // 规格首次清空时已自动填入大包装，第二次清空不再自动填入
                _beforeOrderGoodsSearchDebounce: null, // 之前添加订单-商品名搜索防抖
                _goodsNameSearchDebounce: null, // OrderList 商品名搜索防抖
                beforeOrderForm: { // 之前添加新订单的表单数据
                    goodsName: '',
                    quantity: '',
                    standard: '',
                    remark: '',
                    selectedGoods: null, // 选中的商品对象
                    searchResults: [], // 搜索结果（已废弃，保留兼容性）
                    disArr: [], // 配送商商品搜索结果
                    nxArr: [], // 系统商品搜索结果
                    showSearchResults: false, // 是否显示搜索结果
                    selectedSearchIndex: 0 // 下拉选中项索引（用于 ↑↓ 快捷键）
                },

                // 调整订单内容弹窗相关
                showFixItemsModal: false, // 是否显示调整订单内容弹窗
                fixItemsRequirement: '', // 用户输入的修改要求
                isProcessingFixItems: false, // 是否正在处理调整请求

                // 任务全部完成提示弹窗
                showTaskCompleteModal: false,
                taskCompleteModalTaskId: null,
                taskCompleteModalSourceType: null,
                taskCompleteModalTask: null,

                // 保存新商品弹窗相关
                showSaveNewGoodsModal: false, // 是否显示保存新商品弹窗
                currentSaveGoodsItem: null, // 当前要保存的商品项
                currentSaveGoodsOrderIndex: -1, // 当前要保存的商品订单索引
                currentSaveGoodsSourceType: null, // 当前要保存的商品来源类型
                isSaveNewGoodsFromBeforeOrder: false, // 标记是否从"在之前添加新订单"表单中保存新商品
                currentSaveGoodsManualRow: null, // 手动录入保存新商品时的行数据
                currentSaveGoodsManualRowIndex: -1,
                saveNewGoodsForm: { // 保存新商品表单数据
                    goodsName: '',
                    standardName: '', // 商品规格名称
                    standardWeight: '', // 商品规格重量
                    itemUnit: '', // 商品单位
                    cartonUnit: '', // 箱单位
                    itemsPerCarton: '' // 每箱数量
                },

                // Toast 提示相关
                toastVisible: false,
                toastMessage: '',
                toastType: 'info',
                toastDuration: 3000
            }
        },
        computed: {
            // 是否有数据（用于子组件 UI，替代已废弃的 hasCache）
            hasDataForPaste() {
                return (this.orderItems && this.orderItems.length > 0) || this.currentTask != null;
            },
            hasDataForImage() {
                return (this.orderItems && this.orderItems.length > 0) || this.currentTask != null;
            },
            hasDataForExcelPaste() {
                return (this.orderItems && this.orderItems.length > 0) || this.currentTask != null;
            },
            // 各模式 TTS 状态（从 ttsStateByMode 取出，便于模板与后续 excel/excelPaste 复用）
            pasteTTSState() {
                return this.getTTSState('paste');
            },
            imageTTSState() {
                return this.getTTSState('image');
            },
            // 从 Vuex store 获取 disUser
            disUser() {
                return this.$store.state.disUser;
            },
            // 已处理的文件列表
            processedFiles() {
                return this.autoProcessFiles.filter(f => f.status === 'processed');
            },
            // 待处理的文件列表
            pendingFiles() {
                return this.autoProcessFiles.filter(f => f.status !== 'processed');
            },
            // 判断当前模式下所有订单状态是否都为0（草稿状态）
            allOrdersAreDraft() {
                let orderList = [];
                orderList = this.orderItems;
                // 如果没有订单，返回false
                if (!orderList || orderList.length === 0) {
                    return false;
                }
                // 检查所有订单的状态是否都为0
                return orderList.every(item => item.nxDoStatus === 0);
            },
            // 获取调整订单内容弹窗中显示的订单列表
            currentFixItemsOrderList() {
                return this.getCurrentOrderItems();
            },
            // 根据当前选中的文件过滤订单列表（转订单模式）
            filteredOrderItems() {
                // 确保 orderItems 是一个数组
                if (!Array.isArray(this.orderItems)) {
                    return [];
                }

                // 严格过滤：只保留有效的订单对象
                const validItems = this.orderItems.filter(item => {
                    const isValid = item != null && typeof item === 'object' && item.hasOwnProperty('nxDoGoodsName');
                    return isValid;
                });

                // 如果不是转订单模式，或者没有选中已处理文件，显示所有有效订单
                if (this.uploadType !== 'auto' || !this.activeProcessedFileTab) {
                    if (this.uploadType === 'auto') {
                        console.log('🔍 [filteredOrderItems] auto 模式但没有 activeProcessedFileTab，返回所有订单，数量:', validItems.length);
                    }
                    return validItems;
                }

                // 找到当前选中的文件
                const activeFile = this.processedFiles.find(f => f.filePath === this.activeProcessedFileTab);
                if (!activeFile) {
                    console.warn('⚠️ [filteredOrderItems] 找不到 activeFile，activeProcessedFileTab:', this.activeProcessedFileTab, 'processedFiles:', this.processedFiles);
                    return validItems;
                }

                console.log('🔍 [filteredOrderItems] auto 模式过滤订单:', {
                    validItemsCount: validItems.length,
                    activeFileFileName: activeFile.fileName,
                    activeFilePath: activeFile.filePath,
                    activeProcessedFileTab: this.activeProcessedFileTab,
                    sampleOrderSourceFile: validItems[0]?.sourceFile
                });

                // 只显示来自当前选中文件的订单
                const filtered = validItems.filter(order => {
                    const matches = order.sourceFile === activeFile.fileName;
                    if (!matches && validItems.indexOf(order) < 3) {
                        console.log('🔍 [filteredOrderItems] 订单不匹配:', {
                            orderSourceFile: order.sourceFile,
                            activeFileFileName: activeFile.fileName,
                            goodsName: order.nxDoGoodsName
                        });
                    }
                    return matches;
                });

                console.log('🔍 [filteredOrderItems] 过滤后订单数量:', filtered.length, '原始数量:', validItems.length);
                return filtered;
            },

            // 当前预览的图片文件（转订单模式）
            currentPreviewImage() {
                if (this.uploadType !== 'auto' || !this.activeProcessedFileTab) {
                    return null;
                }
                const activeFile = this.processedFiles.find(f => f.filePath === this.activeProcessedFileTab);
                if (activeFile && activeFile.fileType === 'image') {
                    return activeFile;
                }
                return null;
            },

            // 当前预览图片的src（转订单模式）
            currentPreviewImageSrc() {
                if (!this.currentPreviewImage) {
                    return null;
                }
                return this.autoProcessImagePreviews && this.autoProcessImagePreviews[this.currentPreviewImage.filePath]
                    ? this.autoProcessImagePreviews[this.currentPreviewImage.filePath]
                    : null;
            }
        },
        watch: {
            showTaskCompleteModal(val) {
                // 屏蔽：不再监控任务状态弹窗
                return;
                // if (val) {
                //     // 达到弹窗条件时立即停止朗读，避免影响回车键等操作
                //     this.stopAllReading();
                //     this.$nextTick(() => {
                //         this.$refs.taskCompleteModalCompleteBtn?.focus();
                //     });
                // }
            },
            // 监听客户切换，自动加载缓存
            selectedAllCustomer: {
                handler(newVal, oldVal) {
                    // 使用 try-catch 包裹整个 handler，避免任何错误影响其他逻辑
                    try {
                        if (newVal && newVal !== oldVal) {
                            // 检查组件是否已挂载且在 DOM 中，避免在组件销毁或未挂载时执行
                            if (!this.$el || !this.$el.parentElement) {
                                console.warn('⚠️ [selectedAllCustomer watch] 组件未挂载或不在 DOM 中，跳过缓存加载');
                                return;
                            }

                            // 检查组件是否正在被销毁
                            if (this._isBeingDestroyed || this._isDestroyed) {
                                console.warn('⚠️ [selectedAllCustomer watch] 组件正在被销毁，跳过缓存加载');
                                return;
                            }
                            // 先清空所有旧客户的数据
                            this.clearTaskStatusPollTimer();
                            console.warn('⚠️ [selectedAllCustomer watch] 清空 orderItems，原因: 客户切换');
                            this.orderItems = [];
                            this.hasRunningTask = false;
                            this.uploadedExcelFile = null;
                            this.uploadedExcelPreview = null;
                            this.uploadedImageFile = null;
                            this.imagePreview = null;
                            this.currentTaskId = null;
                            this.currentTask = null;

                            // 清空复制粘贴相关的文本内容
                            this.pasteInputText = '';
                            this.pasteInputContent = '';
                            this.pasteOriginText = '';
                            this.pasteSaveCount = null;

                            // 清空搜索结果（确保搜索商品列表关闭）
                            this.strArr = [];
                            this.nxArr = [];
                            this.orderArrIndex = -1;
                            this.showMatchedGoods = {};

                            this.excelPasteSaveCount = null;
                            this.excelPasteTableData = Array.from({length: 50}, () => ({
                                goodsName: '',
                                quantity: '',
                                specification: '',
                                specificationWeight: '',
                                cartonQuantity: '',
                                cartonName: '',
                                remark: ''
                            }));
                            this.currentPasteRowIndex = 0;
                            this.currentPasteColIndex = 0;
                            this.excelPasteRawData = [];

                            // 如果是转订单模式，清空转订单相关的数据
                            if (this.uploadType === 'auto') {
                                // 先清空文件夹路径，避免使用旧路径扫描
                                this.customerFolderPath = null;
                                this.autoProcessFiles = [];
                                this.autoProcessImagePreviews = {};
                                this.autoProcessExcelPreviews = {};
                                this.activeProcessedFileTab = null;
                                this.autoProcessImagePreview = null;
                                this.autoProcessImagePreviewFileName = '';
                                this.autoProcessResults = [];
                            }

                            // 重置搜索和匹配商品列表状态
                            this.resetSearchAndMatchedGoodsState();

                        }
                    } catch (error) {
                        console.error('❌ [selectedAllCustomer watch] handler 执行失败:', error);
                    }
                },
                immediate: false
            },
            // 监听子部门切换，重新加载缓存
            selectedSubDepartment: {
                handler(newVal, oldVal) {
                    if (newVal !== oldVal && this.selectedAllCustomer) {
                        // 清空订单数据
                        this.clearTaskStatusPollTimer();
                        console.warn('⚠️ [selectedSubDepartment watch] 清空 orderItems，原因: 子部门切换');
                        this.orderItems = [];
                        this.currentTaskId = null;
                        this.currentTask = null;
                        this.pasteSaveCount = null;
                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                    }
                }
            },
            // 监听上传方式切换，如果是转订单模式，加载文件夹路径
            uploadType: {
                handler(newVal, oldVal) {
                    if (newVal !== oldVal && this.selectedAllCustomer) {
                        // 切换上传方式时，如果是转订单模式，先清空转订单相关的数据
                        if (newVal === 'auto') {
                            // 先清空文件夹路径，防止使用旧路径扫描
                            this.customerFolderPath = null;
                            this.autoProcessFiles = [];
                            this.autoProcessImagePreviews = {};
                            this.autoProcessExcelPreviews = {};
                            this.activeProcessedFileTab = null;
                            this.autoProcessImagePreview = null;
                            this.autoProcessImagePreviewFileName = '';
                            this.autoProcessResults = [];
                        }

                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();
                    }
                },
                immediate: false
            },
            // 监听订单列表变化，调试容器高度
            filteredOrderItems: {

                immediate: false
            }
        },
        mounted() {

            // 如果是转订单模式且已选择客户，加载文件夹路径
            if (this.uploadType === 'auto' && this.selectedAllCustomer) {
                this.loadCustomerFolderPath();
            }

        },
        beforeUnmount() {
            this.clearTaskStatusPollTimer();
            if (this._beforeOrderGoodsSearchDebounce) clearTimeout(this._beforeOrderGoodsSearchDebounce);
            if (this._goodsNameSearchDebounce) clearTimeout(this._goodsNameSearchDebounce);
        },

        methods: {
            // 显示 Toast 提示
            showToast(message, type = 'info', duration = 3000) {
                this.toastMessage = message;
                this.toastType = type;
                this.toastDuration = duration;
                this.toastVisible = true;
            },

            // 处理上传方式切换
            handleUploadTypeChange(type) {
                this.stopAllReading();
                this.clearTaskStatusPollTimer();
                // 切换上传类型时清空订单数据，避免 paste 的订单显示在 excel-paste 等模式
                this.orderItems = [];
                this.currentTaskId = null;
                this.currentTask = null;
                this.pasteSaveCount = null;
                this.manualRefText = '';
                this.manualRefImageDataUrl = null;
                this.pasteInputText = '';
                this.pasteInputContent = '';
                this.pasteOriginText = '';
                this.excelPasteSaveCount = null;
                this.excelPasteTableData = Array.from({ length: 50 }, () => ({
                    goodsName: '', quantity: '', specification: '', specificationWeight: '',
                    cartonQuantity: '', cartonName: '', remark: ''
                }));
                this.excelPasteRawData = [];
                this.uploadedImageFile = null;
                this.imagePreview = null;
                this.uploadedExcelFile = null;
                this.uploadedExcelPreview = null;
                this.resetSearchAndMatchedGoodsState();
                if (type === 'excel-paste') this.excelPasteEverShown = true;
                this.uploadType = type;
                this.$emit('upload-type-change', type);
            },

            // 停止所有正在进行的朗读
            stopAllReading() {
                console.log('[PlaceOrder] 停止所有朗读');

                // 停止图片模式的朗读
                if (this.$refs.imageOrderListRef && this.$refs.imageOrderListRef.stopReading) {
                    this.$refs.imageOrderListRef.stopReading();
                }

                // 停止自动模式的朗读
                if (this.$refs.autoOrderListRef && this.$refs.autoOrderListRef.stopReading) {
                    this.$refs.autoOrderListRef.stopReading();
                }

                // 停止 Excel 模式的朗读
                if (this.$refs.excelOrderListRef && this.$refs.excelOrderListRef.stopReading) {
                    this.$refs.excelOrderListRef.stopReading();
                }

                // 停止粘贴模式的朗读
                if (this.$refs.pasteOrderListRef && this.$refs.pasteOrderListRef.stopReading) {
                    this.$refs.pasteOrderListRef.stopReading();
                }

                // 停止 Excel 粘贴模式的朗读
                if (this.$refs.excelPasteOrderListRef && this.$refs.excelPasteOrderListRef.stopReading) {
                    this.$refs.excelPasteOrderListRef.stopReading();
                }
            },


            // 解析 Excel 粘贴数据（正确处理包含换行符的字段）
            parseExcelPasteData(pasteData) {
                console.log('🔧 [解析数据] 开始解析 Excel 粘贴数据');
                console.log('🔧 [解析数据] 原始数据:', pasteData);

                const rows = [];
                let currentRow = [];
                let currentCell = '';
                let inQuotes = false;
                let i = 0;

                while (i < pasteData.length) {
                    const char = pasteData[i];
                    const nextChar = pasteData[i + 1];

                    if (char === '"') {
                        // 处理引号
                        if (inQuotes && nextChar === '"') {
                            // 双引号转义，表示一个引号字符
                            currentCell += '"';
                            i += 2;
                        } else {
                            // 切换引号状态
                            inQuotes = !inQuotes;
                            i++;
                        }
                    } else if (char === '\t' && !inQuotes) {
                        // Tab 分隔符（不在引号内）
                        currentRow.push(currentCell.trim());
                        currentCell = '';
                        i++;
                    } else if ((char === '\n' || char === '\r') && !inQuotes) {
                        // 换行符（不在引号内）
                        if (char === '\r' && nextChar === '\n') {
                            // 处理 \r\n
                            i += 2;
                        } else {
                            i++;
                        }
                        // 每遇换行都产生一行（含完全空行），保留与 Excel 相同的行对齐
                        currentRow.push(currentCell.trim());
                        rows.push(currentRow.slice());
                        currentRow = [];
                        currentCell = '';
                    } else {
                        // 普通字符
                        currentCell += char;
                        i++;
                    }
                }

                // 处理最后一行（无结尾换行符的片段）
                if (currentCell.length > 0 || currentRow.length > 0) {
                    currentRow.push(currentCell.trim());
                    rows.push(currentRow.slice());
                }

                console.log('🔧 [解析数据] 解析完成，共', rows.length, '行');
                return rows;
            },
            // 处理单元格点击事件（记录当前选中的单元格位置）
            handleCellClick({row, column, rowIndex, columnIndex}) {
                console.log('🖱️ [单元格点击] 行索引:', rowIndex, '列索引:', columnIndex);
                console.log('🖱️ [单元格点击] 行数据:', row);
                console.log('🖱️ [单元格点击] 列信息:', column);

                // 验证 rowIndex 是否正确：通过 row 对象在数组中的实际位置
                const actualRowIndex = this.excelPasteTableData.findIndex(item => item === row);
                console.log('🖱️ [单元格点击] 实际行索引（通过数据查找）:', actualRowIndex);

                // 使用实际的行索引，如果找不到则使用 rowIndex
                const finalRowIndex = actualRowIndex !== -1 ? actualRowIndex : rowIndex;

                // 保存当前选中的单元格位置
                this.currentPasteRowIndex = finalRowIndex;

                // 根据列字段名找到列索引
                const columns = ['goodsName', 'quantity', 'specification', 'specificationWeight', 'cartonQuantity', 'cartonName', 'remark'];
                if (column && column.field) {
                    const colIndex = columns.findIndex(col => col === column.field);
                    if (colIndex !== -1) {
                        this.currentPasteColIndex = colIndex;
                    }
                }

                console.log('🖱️ [单元格点击] 保存位置 - 行:', this.currentPasteRowIndex, '列:', this.currentPasteColIndex);
                console.log('🖱️ [单元格点击] 这是第', this.currentPasteRowIndex + 1, '行（从1开始计数）');
            },
            // 处理编辑关闭事件（只做数据保存，不更新粘贴位置）
            handleEditClosed({row, column, rowIndex, columnIndex}) {
                console.log('✏️ [编辑关闭] 行索引:', rowIndex, '列索引:', columnIndex);
                console.log('✏️ [编辑关闭] 注意：不更新粘贴位置，粘贴位置只由点击事件决定');
                // ❌ 不要在这里更新 currentPasteRowIndex 和 currentPasteColIndex
                // 因为当用户点击新单元格时，旧单元格的编辑关闭事件会覆盖新位置
                // 粘贴位置应该只由 handleCellClick 事件决定
            },
            // 处理键盘事件（拦截 Ctrl+V）
            handleTableKeydown(event) {
                if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
                    console.log('⌨️ [键盘事件] 检测到 Ctrl+V 或 Cmd+V');
                    // 不阻止默认行为，让浏览器处理粘贴
                }
            },
            // 处理 Excel 粘贴表格数据更新事件
            handleExcelPasteTableDataUpdate(updates) {
                // 更新表格数据
                updates.forEach(({rowIndex, updates: rowUpdates}) => {
                    if (rowIndex >= 0 && rowIndex < this.excelPasteTableData.length) {
                        Object.assign(this.excelPasteTableData[rowIndex], rowUpdates);
                    }
                });
            },
            handleExcelPasteInsertRowAbove(rowIndex) {
                const blank = {
                    goodsName: '',
                    quantity: '',
                    specification: '',
                    specificationWeight: '',
                    cartonQuantity: '',
                    cartonName: '',
                    remark: '',
                    _justInserted: true
                };
                this.excelPasteTableData.splice(rowIndex, 0, blank);
                setTimeout(() => {
                    const row = this.excelPasteTableData[rowIndex];
                    if (row && row._justInserted) delete row._justInserted;
                }, 350);
            },
            handleExcelPasteDeleteRow(rowIndex) {
                if (rowIndex < 0 || rowIndex >= this.excelPasteTableData.length) return;
                const row = this.excelPasteTableData[rowIndex];
                row._deleting = true;
                setTimeout(() => {
                    this.excelPasteTableData.splice(rowIndex, 1);
                    if (this.excelPasteTableData.length === 0) {
                        this.excelPasteTableData.push({
                            goodsName: '',
                            quantity: '',
                            specification: '',
                            specificationWeight: '',
                            cartonQuantity: '',
                            cartonName: '',
                            remark: ''
                        });
                    }
                }, 280);
            },
            // 检查表格是否有数据
            hasExcelPasteTableData() {
                if (!this.excelPasteTableData || this.excelPasteTableData.length === 0) {
                    return false;
                }
                // 检查是否有至少一行包含商品名称
                return this.excelPasteTableData.some(row => row.goodsName && row.goodsName.trim() !== '');
            },
            // 清空表格数据
            async clearExcelPasteTableData() {
                if (!this.hasExcelPasteTableData()) {
                    return;
                }
                const confirmed = await this.$refs.alertDialog.confirm('确定要清空所有粘贴数据吗？');
                if (confirmed) {
                    // 重置所有行为空数据
                    this.excelPasteTableData = Array.from({length: 50}, () => ({
                        goodsName: '',
                        quantity: '',
                        specification: '',
                        specificationWeight: '',
                        cartonQuantity: '',
                        cartonName: '',
                        remark: ''
                    }));
                    // 重置位置
                    this.currentPasteRowIndex = 0;
                    this.currentPasteColIndex = 0;
                }
            },
            // 清空订单列表数据
            async clearExcelPasteOrderItems() {
                if (this.orderItems.length === 0) {
                    return;
                }
                const confirmed = await this.$refs.alertDialog.confirm('确定要清空所有订单商品吗？');
                if (confirmed) {
                    this.orderItems = [];
                    // 重置搜索和匹配商品列表状态
                    this.resetSearchAndMatchedGoodsState();
                }
            },
            // 处理 Excel 粘贴 AI 识别开始事件
            handleExcelPasteAiRecognise() {
                // 设置加载状态
                this.showDeepSeekLoading = true;
            },
            // 处理 Excel 粘贴 AI 识别完成事件
            async handleExcelPasteAiRecogniseComplete(csvData, userPrompt) {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                // 设置加载状态
                this.showDeepSeekLoading = true;

                try {
                    // 调用统一的 AI 识别方法
                    const orderItems = await this.aiRecogniseExcelPasteTable(csvData, userPrompt);

                    // 更新订单项
                    this.orderItems = orderItems;

                    // 重置加载状态
                    this.showDeepSeekLoading = false;

                    await this.$refs.alertDialog.alert(`成功解析 ${orderItems.length} 条订单数据`, 'success');
                } catch (error) {
                    console.error('❌ [handleExcelPasteAiRecogniseComplete] AI 识别失败:', error);
                    await this.$refs.alertDialog.alert('AI识别失败：' + (error.message || '未知错误'), 'error');
                    this.showDeepSeekLoading = false;
                }
            },

            // 表格直接转订单（不调 AI）：按列映射为订单项并写入 orderItems
            handleDirectExcelPasteTableToOrders(rows) {
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
                const orderItems = rows
                    .filter(item => item.name && String(item.name).trim())
                    .map(item => ({
                        nxDoGoodsName: item.name || '',
                        nxDoGoodsNameOriginal: item.name || '',
                        nxDoQuantity: item.quantity ?? '',
                        nxDoStandard: item.spec || '',
                        nxDoRemark: item.remark || '',
                        nxDoAddRemark: !!(item.remark && String(item.remark).trim()),
                        standardWeight: item.standardWeight || '',
                        itemUnit: item.itemUnit || '',
                        itemsPerCarton: item.itemsPerCarton ?? '',
                        cartonUnit: item.cartonUnit || '',
                        nxDoStatus: -2,
                        nxDoDepartmentId: targetDepId,
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoDisGoodsId: null,
                        nxDoStandardWarn: 0,
                        goodsNameWarn: 0,
                        nxDoDistributerId: this.disUser?.nxDiuDistributerId,
                        nxDoPurchaseUserId: -1,
                        nxDoOrderUserId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId,
                        nxDoIsAgent: -1
                    }));
                this.orderItems = orderItems;
            },

            // 检查是否选择了子部门（如果有子部门的话）
            async checkSubDepartmentSelected() {
                if (!this.selectedCustomerEntity) {
                    return true; // 如果没有选中客户，不检查子部门
                }

                const hasSubDepartments = this.selectedCustomerEntity.nxDepartmentEntities &&
                    Array.isArray(this.selectedCustomerEntity.nxDepartmentEntities) &&
                    this.selectedCustomerEntity.nxDepartmentEntities.length > 0;

                if (hasSubDepartments) {
                    if (!this.selectedSubDepartment) {
                        await this.$refs.alertDialog.alert('请先选择子部门', 'warning');
                        return false;
                    }
                    return true;
                }
                return true;
            },


            // ========== Excel上传相关方法 ==========
            // 处理Excel文件上传（使用异步任务队列）
            async handleExcelUpload(event) {
                const file = event.target.files[0];
                if (!file) return;

                // 验证文件类型
                const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'];
                if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
                    await this.$refs.alertDialog.alert('请选择有效的Excel文件（.xlsx 或 .xls）', 'warning');
                    return;
                }

                // 验证文件大小（最大10MB）
                if (file.size > 10 * 1024 * 1024) {
                    await this.$refs.alertDialog.alert('文件大小超过限制，最大支持 10MB', 'warning');
                    return;
                }

                if (!this.selectedAllCustomer) {
                    await this.$refs.alertDialog.alert('请先选择客户', 'warning');
                    return;
                }

                // 检查是否选择了子部门（如果有子部门的话）
                if (!(await this.checkSubDepartmentSelected())) {
                    // 清空文件输入
                    if (this.$refs.excelFileInput) {
                        this.$refs.excelFileInput.value = '';
                    }
                    return;
                }

                // 确定要使用的部门ID（如果有子部门选择，使用子部门ID，否则使用父部门ID）
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                // 检查是否已有进行中的任务
                if (taskQueue.hasActiveTask(targetDepId)) {
                    // 不再弹窗提示，静默处理
                    return;
                }

                // 保存上传的文件信息（用于缓存和显示）
                this.uploadedExcelFile = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    file: file // 保存File对象，用于任务执行
                };

                // 读取并解析Excel文件，用于预览（通过组件方法）
                // 注意：预览数据是异步生成的，通过 handleExcelPreviewLoaded 事件回调
                if (this.$refs.excelUploadRef) {
                    await this.$refs.excelUploadRef.loadExcelPreview(file);
                }

                console.log('🔍 [handleExcelUpload] 准备创建任务，当前客户信息:', {
                    selectedAllCustomer: this.selectedAllCustomer,
                    selectedSubDepartment: this.selectedSubDepartment,
                    selectedCustomerName: this.selectedCustomerName,
                    targetDepId: targetDepId,
                    disId: this.disUser?.nxDiuDistributerId,
                    userId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId,
                    hasPreview: !!this.uploadedExcelPreview
                });

                // 创建任务
                const taskInfo = {
                    depId: targetDepId,
                    depFatherId: this.selectedAllCustomer,
                    depName: this.selectedCustomerName || '客户',
                    type: taskQueue.TASK_TYPE.EXCEL,
                    excelFile: file, // 保存File对象
                    disId: this.disUser?.nxDiuDistributerId,
                    userId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId,
                    // ✅ 如果预览数据已经生成，保存到任务信息中
                    excelPreview: this.uploadedExcelPreview ? JSON.parse(JSON.stringify(this.uploadedExcelPreview)) : null
                };

                console.log('📝 [handleExcelUpload] 创建任务，任务信息:', {
                    depId: taskInfo.depId,
                    depFatherId: taskInfo.depFatherId,
                    depName: taskInfo.depName,
                    type: taskInfo.type,
                    fileName: file.name,
                    hasPreview: !!taskInfo.excelPreview
                });

                const taskId = taskQueue.addTask(taskInfo);

                if (!taskId) {
                    // 不再弹窗提示，静默处理
                    return;
                }

                // 设置识别中状态
                this.hasRunningTask = true;
                this.recognizingExcel = true;

                console.log('✅ [handleExcelUpload] 任务创建成功，设置状态:', {
                    taskId,
                    hasRunningTask: this.hasRunningTask,
                    recognizingExcel: this.recognizingExcel,
                    uploadedExcelFile: this.uploadedExcelFile,
                    uploadedExcelPreview: !!this.uploadedExcelPreview
                });

                // 确保任务执行器已启动
                taskExecutor.checkAndStartExecutor();

                // 清空文件输入
                if (this.$refs.excelFileInput) {
                    this.$refs.excelFileInput.value = '';
                }
            },

            // 处理 Excel 预览加载完成事件
            handleExcelPreviewLoaded(preview) {
                // 保存预览数据
                this.uploadedExcelPreview = preview;

                // 同时保存到缓存的文件信息中
                if (this.uploadedExcelFile) {
                    this.uploadedExcelFile.preview = preview;
                }

                // ✅ 重要：如果当前有正在运行的任务，更新任务对象中的预览数据
                // 这样即使切换了客户，任务完成时也能获取到预览数据
                if (this.hasRunningTask && this.uploadedExcelFile) {
                    const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
                    const activeTask = taskQueue.getTaskByDepId(targetDepId);
                    if (activeTask && activeTask.type === taskQueue.TASK_TYPE.EXCEL &&
                        activeTask.excelFile && activeTask.excelFile.name === this.uploadedExcelFile.name) {
                        // 更新任务对象中的预览数据（保存在excelFile对象中）
                        activeTask.excelFile.preview = JSON.parse(JSON.stringify(preview));
                        // 保存更新后的任务到localStorage
                        const tasks = taskQueue.loadTasks();
                        const taskIndex = tasks.findIndex(t => t.taskId === activeTask.taskId);
                        if (taskIndex >= 0) {
                            tasks[taskIndex] = activeTask;
                            taskQueue.saveTasks(tasks);
                            console.log('✅ [handleExcelPreviewLoaded] 预览数据已保存到任务对象:', {
                                taskId: activeTask.taskId,
                                fileName: activeTask.excelFile.name,
                                sheetsCount: preview.sheets?.length || 0
                            });
                        } else {
                            console.warn('⚠️ [handleExcelPreviewLoaded] 未找到任务，无法保存预览数据');
                        }
                    } else {
                        // 如果没有找到匹配的任务，尝试查找所有Excel任务
                        const allTasks = taskQueue.getAllTasks();
                        const matchingTask = allTasks.find(t =>
                            t.type === taskQueue.TASK_TYPE.EXCEL &&
                            t.excelFile &&
                            t.excelFile.name === this.uploadedExcelFile.name &&
                            (t.status === taskQueue.TASK_STATUS.PENDING || t.status === taskQueue.TASK_STATUS.RUNNING)
                        );
                        if (matchingTask) {
                            matchingTask.excelFile.preview = JSON.parse(JSON.stringify(preview));
                            const tasks = taskQueue.loadTasks();
                            const taskIndex = tasks.findIndex(t => t.taskId === matchingTask.taskId);
                            if (taskIndex >= 0) {
                                tasks[taskIndex] = matchingTask;
                                taskQueue.saveTasks(tasks);
                                console.log('✅ [handleExcelPreviewLoaded] 预览数据已保存到匹配的任务对象:', {
                                    taskId: matchingTask.taskId,
                                    fileName: matchingTask.excelFile.name,
                                    sheetsCount: preview.sheets?.length || 0
                                });
                            }
                        }
                    }
                }

                // 强制触发 Vue 响应式更新
                this.$forceUpdate();
            },

            // 切换上传的Excel工作表
            changeUploadedExcelSheet(sheetIndex) {
                if (this.uploadedExcelPreview) {
                    this.uploadedExcelPreview.currentSheet = parseInt(sheetIndex);
                }
            },

            // 清除已上传的Excel文件
            clearUploadedExcelFile() {
                this.uploadedExcelFile = null;
                this.uploadedExcelPreview = null;
                if (this.$refs.excelFileInput) {
                    this.$refs.excelFileInput.value = '';
                }
            },

            // 格式化文件大小
            formatFileSize(bytes) {
                if (!bytes || bytes === 0) return '0 B';
                const k = 1024;
                const sizes = ['B', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
            },

            // ========== 订单编辑相关方法 ==========

            // 重置搜索和匹配商品列表相关的状态
            resetSearchAndMatchedGoodsState() {
                console.log("🔄 [resetSearchAndMatchedGoodsState] 重置搜索和匹配商品列表状态");
                // 关闭所有已匹配商品列表
                this.showMatchedGoods = {};
                // 重置当前编辑的订单索引
                this.orderArrIndex = -1;
                // 清空搜索结果
                this.strArr = [];
                this.nxArr = [];
                // 清空搜索关键词
                this.searchStr = '';
                // 清空商品ID和选中的商品名称
                this.goodsId = '';
                this.selectedGoodsName = '';
                // 清空当前来源类型
                this.currentSourceType = null;
                // 清空上一次搜索的值，确保切换客户后可以重新搜索
                this.lastSearchValue = '';
            },

            // 关闭搜索下拉框（关闭商品搜索下拉框）
            closeStr() {
                this.resetSearchAndMatchedGoodsState();
            },

            // 关闭所有已展开的推荐商品
            closeAllMatchedGoods() {
                this.showMatchedGoods = {};
            },
            // 切换匹配商品列表显示：展开时先关闭其他订单的，再打开当前订单
            // payload 为 number 时兼容旧调用；为 { orderIndex, hasSearchResults } 时使用子组件传入的 hasSearchResults
            toggleMatchedGoods(payload) {
                const orderIndex = typeof payload === 'object' ? payload.orderIndex : payload;
                const hasSearchResultsFromChild = typeof payload === 'object' ? payload.hasSearchResults : undefined;
                const isExpanded = !!this.showMatchedGoods[orderIndex];
                const hasSearchResults = hasSearchResultsFromChild !== undefined
                    ? hasSearchResultsFromChild
                    : (this.orderArrIndex === orderIndex && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0);
                console.log('[PlaceOrder] toggleMatchedGoods', {
                    orderIndex,
                    isExpanded,
                    hasSearchResults,
                    hasSearchResultsFromChild,
                    orderArrIndex: this.orderArrIndex,
                    strArrLen: this.strArr?.length,
                    nxArrLen: this.nxArr?.length
                });
                if (isExpanded || hasSearchResults) {
                    // 关闭：情况1-收起匹配商品；情况2-关闭搜索商品
                    const items = this.uploadType === 'auto' ? this.filteredOrderItems : this.orderItems;
                    const item = items && items[orderIndex];
                    const original = item?.nxDoGoodsNameOriginal;
                    console.log('[PlaceOrder] toggleMatchedGoods 关闭', {
                        hasItem: !!item,
                        nxDoGoodsName: item?.nxDoGoodsName,
                        nxDoGoodsNameOriginal: original
                    });
                    if (item) {
                        item.nxDoGoodsName = original != null ? original : (item.nxDoGoodsName ?? '');
                    }
                    if (hasSearchResults) {
                        this.strArr = [];
                        this.nxArr = [];
                        this.orderArrIndex = -1;
                        this.lastSearchValue = '';
                    }
                    this.showMatchedGoods = { ...this.showMatchedGoods, [orderIndex]: false };
                } else {
                    // 展开：设置 orderArrIndex 以便 nxGoodsEntities（推荐系统商品）能显示（关闭时 blur 可能已将 orderArrIndex 置为 -1）
                    this.orderArrIndex = orderIndex;
                    this.showMatchedGoods = { [orderIndex]: true };
                }
            },

            // 获取当前操作的订单列表（统一使用 orderItems）
            getCurrentOrderItems() {
                return this.orderItems;
            },

            // 辅助方法：根据 uploadType 和订单列表情况确定 sourceType
            // 这个方法用于处理 OrderList 组件的事件适配器方法
            determineSourceTypeForOrderList(orderIndex, item) {
                // 优先使用 uploadType
                let sourceType = this.uploadType;

                if (!sourceType || sourceType === 'excel') {
                    sourceType = this.uploadType || 'excel';
                }
                return sourceType;
            },

            // 处理商品名称输入（触发搜索，500ms 防抖）
            handleGoodsNameInput(item, orderIndex, sourceType) {
                const value = item.nxDoGoodsName || '';
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType;
                if (value.length === 0) {
                    if (this._goodsNameSearchDebounce) clearTimeout(this._goodsNameSearchDebounce);
                    this._goodsNameSearchDebounce = null;
                    this.strArr = [];
                    this.nxArr = [];
                    this.orderArrIndex = -1;
                    this.lastSearchValue = '';
                    return;
                }
                if (value === this.lastSearchValue) return;
                if (this._goodsNameSearchDebounce) clearTimeout(this._goodsNameSearchDebounce);
                this._goodsNameSearchDebounce = setTimeout(() => {
                    this._goodsNameSearchDebounce = null;
                    this.lastSearchValue = value;
                    this.getSearchString(value, sourceType);
                }, 500);
            },

            // 处理商品名称获得焦点
            handleGoodsNameFocus(item, orderIndex, sourceType) {
                // 切换到不同订单时清空搜索结果，否则 nxGoodsEntities（推荐系统商品）无法显示
                if (this.orderArrIndex >= 0 && this.orderArrIndex !== orderIndex) {
                    this.strArr = [];
                    this.nxArr = [];
                }
                // 若 nxDoGoodsNameOriginal 未设置，用当前 nxDoGoodsName 初始化，便于收起时恢复
                if (item && (item.nxDoGoodsNameOriginal == null || item.nxDoGoodsNameOriginal === '')) {
                    item.nxDoGoodsNameOriginal = item.nxDoGoodsName ?? '';
                }
                // 设置当前编辑的订单索引
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型

                // 切换输入框时，重置上一次搜索值，避免不同输入框之间的干扰
                const currentValue = item.nxDoGoodsName || '';
                if (this.lastSearchValue !== currentValue) {
                    this.lastSearchValue = ''; // 重置，允许新输入框的首次搜索
                }

            },

            // 处理商品名称失去焦点
            handleGoodsNameBlur(item, orderIndex, sourceType) {
                // 延迟重置，以便点击按钮时不会立即隐藏
                setTimeout(() => {
                    // 搜索结果显示时不要重置（blur 是为让用户用上下键+回车选商品），避免列表闪退
                    const hasSearchResults = this.orderArrIndex === orderIndex && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0;
                    if (hasSearchResults) return;
                    if (this.orderArrIndex === orderIndex) {
                        this.orderArrIndex = -1;
                    }
                }, 200);
            },


            // 处理备注输入
            handleRemarkInput(item, orderIndex, sourceType) {
                // 更新备注相关字段
                item.nxDoAddRemark = !!(item.nxDoRemark && item.nxDoRemark.trim());

            },

            // 打开修改订单弹窗（参考 TodayOrders.vue 的 loadGoodsInfoAndOpenModal）
            async handleUpdateOrder(item, orderIndex, sourceType) {
                console.log('[PlaceOrder] handleUpdateOrder 被调用:', {
                    item,
                    orderIndex,
                    sourceType,
                    hasNxDepartmentOrdersId: item?.nxDepartmentOrdersId
                });

                // 对于图片识别模式，允许没有 nxDepartmentOrdersId（未保存的订单）
                if (!item) {
                    console.error('[PlaceOrder] 订单项为空，无法修改');
                    await this.$refs.alertDialog.alert('订单信息错误，无法修改', 'error');
                    return;
                }

                // 只有已保存的订单才需要 nxDepartmentOrdersId
                if (sourceType !== 'image' && !item.nxDepartmentOrdersId) {
                    console.error('[PlaceOrder] 订单信息错误，缺少 nxDepartmentOrdersId:', item);
                    await this.$refs.alertDialog.alert('订单信息错误，无法修改', 'error');
                    return;
                }

                console.log('[PlaceOrder] 开始打开修改订单弹窗...');

                // 设置当前编辑的订单项
                this.currentEditOrderItem = item;
                this.currentEditOrderIndex = orderIndex;
                this.currentEditOrderSourceType = sourceType;

                // 初始化表单
                this.editOrderForm = {
                    quantity: item.nxDoQuantity || '',
                    standard: item.nxDoStandard || item.nxDoPrintStandard || '',
                    remark: item.nxDoRemark || ''
                };

                // 如果有商品ID，获取完整的商品信息（包含规格列表）
                const goodsId = item.nxDoDisGoodsId;
                if (goodsId) {
                    try {
                        this.$store.commit('SET_LOADING', true);
                        const res = await api.disGetGoods(goodsId);

                        if (res && res.data && res.data.code === 0 && res.data.data) {
                            this.itemDis = res.data.data;
                        } else {
                            // 如果获取失败，使用原有的商品信息
                            this.itemDis = item.nxDistributerGoodsEntity || null;
                        }
                    } catch (error) {
                        console.error('获取商品信息失败:', error);
                        // 失败时使用原有的商品信息
                        this.itemDis = item.nxDistributerGoodsEntity || null;
                    } finally {
                        this.$store.commit('SET_LOADING', false);
                    }
                } else {
                    // 没有商品ID，使用原有的商品信息
                    this.itemDis = item.nxDistributerGoodsEntity || null;
                }

                this.showEditOrderModal = true;
                this.showAddStandard = false;
                this.newStandardName = '';
            },

            // 确认修改订单（参考 TodayOrders.vue 的 handleSaveEditOrder）
            async confirmUpdateOrder() {
                if (!this.currentEditOrderItem || !this.currentEditOrderItem.nxDepartmentOrdersId) {
                    await this.$refs.alertDialog.alert('订单信息错误', 'error');
                    return;
                }

                if (!this.editOrderForm.quantity || parseFloat(this.editOrderForm.quantity) <= 0) {
                    await this.$refs.alertDialog.alert('请输入有效的订货数量', 'warning');
                    return;
                }

                if (!this.editOrderForm.standard) {
                    await this.$refs.alertDialog.alert('请选择单位', 'warning');
                    return;
                }

                if (this.editOrderForm.remark && this.editOrderForm.remark.length > 15) {
                    await this.$refs.alertDialog.alert('备注最多15个字符', 'warning');
                    return;
                }

                try {
                    this.$store.commit('SET_LOADING', true);

                    const updateData = {
                        id: this.currentEditOrderItem.nxDepartmentOrdersId,
                        weight: this.editOrderForm.quantity,
                        standard: this.editOrderForm.standard,
                        remark: this.editOrderForm.remark || '',
                        printStandard: this.editOrderForm.standard,
                        priceLevel: this.currentEditOrderItem.nxDoPriceLevel || 1
                    };

                    const res = await api.updateOrder(updateData);

                    if (res && res.data && res.data.code === 0) {
                        // 保留原有的商品名称相关字段
                        const preservedOriginalName = this.currentEditOrderItem.nxDoGoodsNameOriginal || '';
                        const currentGoodsName = this.currentEditOrderItem.nxDoGoodsName || '';

                        // 更新订单数据
                        const updatedOrder = {
                            ...res.data.data,
                            nxDoGoodsName: currentGoodsName, // 保持当前的商品名称
                            nxDoGoodsNameOriginal: preservedOriginalName, // 保留原有的原始名称
                        };

                        // 更新订单列表
                        if (this.currentEditOrderSourceType === 'auto' && this.uploadType === 'auto') {
                            const filteredItems = this.filteredOrderItems;
                            if (filteredItems && this.currentEditOrderIndex >= 0 && this.currentEditOrderIndex < filteredItems.length) {
                                const order = filteredItems[this.currentEditOrderIndex];
                                const actualIndex = this.orderItems.findIndex(item => item === order);
                                if (actualIndex >= 0) {
                                    this.orderItems[actualIndex] = updatedOrder;
                                }
                            }
                        } else if (this.currentEditOrderIndex >= 0 && this.currentEditOrderIndex < this.orderItems.length) {
                            this.orderItems[this.currentEditOrderIndex] = updatedOrder;
                        }

                        // 更新缓存
                        if (this.currentEditOrderSourceType !== 'paste') {
                            this._updateStorage(updatedOrder, this.currentEditOrderIndex);
                        }

                        // 如果是朗读状态（停止的订单），修改完成后继续朗读（forceContinue 跳过 nxDoStatus 检查）
                        const orderIndex = this.currentEditOrderIndex;
                        const sourceType = this.currentEditOrderSourceType;
                        this.closeEditOrderModal();
                        if (sourceType && orderIndex >= 0) {
                            const mode = sourceType === 'excel-paste' ? 'excelPaste' : sourceType;
                            const ref = this.getOrderListRef(mode);
                            if (ref && ref.stoppedIndex !== undefined && ref.stoppedIndex !== null && ref.stoppedIndex === orderIndex) {
                                this.$nextTick(() => {
                                    if (ref && ref.continueReading) ref.continueReading(true);
                                });
                            }
                        }
                    } else {
                        await this.$refs.alertDialog.alert(res?.data?.msg || '修改失败', 'error');
                    }
                } catch (error) {
                    console.error('修改订单失败:', error);
                    await this.$refs.alertDialog.alert('修改失败，请检查网络', 'error');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 取消修改订单（参考 TodayOrders.vue 的 closeEditOrderModal）
            closeEditOrderModal() {
                this.showEditOrderModal = false;
                this.currentEditOrderItem = null;
                this.currentEditOrderIndex = -1;
                this.currentEditOrderSourceType = null;
                this.itemDis = null;
                this.showAddStandard = false;
                this.newStandardName = '';
                this.focusType = '';
                this.editOrderForm = {
                    quantity: '',
                    standard: '',
                    remark: ''
                };
            },

            // 显示调整订单内容弹窗
            async showFixItems() {
                // 根据 uploadType 获取正确的订单列表
                const uploadType = this.uploadType;
                const currentOrderItems = this.getCurrentOrderItems();

                if (!currentOrderItems || currentOrderItems.length === 0) {
                    await this.$refs.alertDialog.alert('当前没有订单，无法调整', 'warning');
                    return;
                }

                // 根据订单模式确定要获取的 prompt 字段名
                let promptFieldName = '';

                if (uploadType === 'image') {
                    promptFieldName = 'nxDepartmentOcrPromptImage';
                } else if (uploadType === 'excel') {
                    promptFieldName = 'nxDepartmentOcrPromptExcel';
                } else if (uploadType === 'paste') {
                    promptFieldName = 'nxDepartmentOcrPromptPaste';
                } else if (uploadType === 'excel-paste') {
                    promptFieldName = 'nxDepartmentOcrPromptExcelPaste';
                } else if (uploadType === 'auto') {
                    // auto 模式默认使用 image 的 prompt
                    promptFieldName = 'nxDepartmentOcrPromptImage';
                }

                // 尝试获取部门的默认调整内容
                let defaultPrompt = '';

                // 如果有子部门且已选择，从子部门中获取
                if (this.selectedSubDepartment && this.selectedCustomerEntity?.nxDepartmentEntities) {
                    const subDepartment = this.selectedCustomerEntity.nxDepartmentEntities.find(
                        dep => dep.nxDepartmentId === this.selectedSubDepartment ||
                            String(dep.nxDepartmentId) === String(this.selectedSubDepartment)
                    );
                    if (subDepartment && promptFieldName && subDepartment[promptFieldName]) {
                        defaultPrompt = subDepartment[promptFieldName];
                    }
                }

                // 如果没有从子部门获取到，尝试从主部门获取
                if (!defaultPrompt && this.selectedCustomerEntity && promptFieldName && this.selectedCustomerEntity[promptFieldName]) {
                    defaultPrompt = this.selectedCustomerEntity[promptFieldName];
                }

                this.showFixItemsModal = true;
                this.fixItemsRequirement = defaultPrompt || '';
            },

            // 关闭调整订单内容弹窗
            closeFixItemsModal() {
                this.showFixItemsModal = false;
                this.fixItemsRequirement = '';
                // 注意：不要在这里重置 isProcessingFixItems，应该在 confirmFixItems 的 finally 块中重置
                // 这样可以防止在请求进行中关闭弹窗时导致重复请求
            },

            // 确认并处理调整订单内容
            async confirmFixItems() {
                // 防止重复点击 - 在方法开始就检查并设置标志
                if (this.isProcessingFixItems) {
                    console.warn('⚠️ [confirmFixItems] 正在处理中，忽略重复点击');
                    return;
                }

                // 立即设置处理标志，防止重复请求
                this.isProcessingFixItems = true;
                console.log('🔄 [confirmFixItems] 开始处理，设置 isProcessingFixItems = true');

                try {
                    if (!this.fixItemsRequirement || !this.fixItemsRequirement.trim()) {
                        await this.$refs.alertDialog.alert('请输入修改要求', 'warning');
                        this.isProcessingFixItems = false;
                        return;
                    }

                    // 根据 uploadType 获取正确的订单列表
                    const uploadType = this.uploadType;
                    const currentOrderItems = this.getCurrentOrderItems();

                    if (!currentOrderItems || currentOrderItems.length === 0) {
                        await this.$refs.alertDialog.alert('当前没有订单', 'warning');
                        this.isProcessingFixItems = false;
                        return;
                    }

                    console.log('📤 [confirmFixItems] 准备发送请求，订单数量:', currentOrderItems.length, 'uploadType:', uploadType);

                    this.$store.commit('SET_LOADING', true);

                    // 确定 inputType（根据 uploadType 转换）
                    let inputType = 'image'; // 默认值

                    if (uploadType === 'image') {
                        inputType = 'image';
                    } else if (uploadType === 'excel') {
                        inputType = 'excel';
                    } else if (uploadType === 'paste') {
                        inputType = 'paste';
                    } else if (uploadType === 'excel-paste') {
                        inputType = 'excel-paste'; // Excel 粘贴模式
                    } else if (uploadType === 'auto') {
                        // auto 模式默认使用 image
                        inputType = 'image';
                    }

                    // 准备请求参数
                    // 注意：orderItems 需要包含订单ID（nxDepartmentOrdersId），如果是新订单可能没有ID
                    const requestData = {
                        orderItems: currentOrderItems,
                        userInstructions: this.fixItemsRequirement.trim(),
                        inputType: inputType
                    };

                    // 如果是 auto 模式，保存原始订单的 sourceFile 映射，以便校正后恢复
                    let sourceFileMap = null;
                    if (uploadType === 'auto') {
                        sourceFileMap = new Map();
                        currentOrderItems.forEach((order, index) => {
                            if (order.sourceFile) {
                                // 使用订单的唯一标识（优先使用 ID，否则使用索引）作为 key
                                const key = order.nxDepartmentOrdersId || `index_${index}`;
                                sourceFileMap.set(key, order.sourceFile);
                            }
                        });
                        console.log('💾 [confirmFixItems] auto 模式，保存 sourceFile 映射，数量:', sourceFileMap.size);
                    }

                    // 调用后台订单修正接口
                    const res = await api.correctionOrder(requestData);

                    if (res && res.data && res.data.code === 0) {
                        // 后台返回修正并更新后的订单列表（包含重新查询的商品信息）
                        let correctedOrders = res.data.data;

                        if (correctedOrders && Array.isArray(correctedOrders)) {
                            console.log('✅ [confirmFixItems] OCR 校正成功，订单数量:', correctedOrders.length);

                            // 如果是 auto 模式，恢复 sourceFile 属性
                            if (uploadType === 'auto' && sourceFileMap && sourceFileMap.size > 0) {
                                // 获取当前激活文件的文件名，作为默认值
                                let defaultSourceFile = null;
                                if (this.activeProcessedFileTab) {
                                    const activeFile = this.processedFiles.find(f => f.filePath === this.activeProcessedFileTab);
                                    if (activeFile) {
                                        defaultSourceFile = activeFile.fileName;
                                        console.log('💾 [confirmFixItems] 当前激活文件:', activeFile.fileName);
                                    }
                                }

                                correctedOrders = correctedOrders.map((order, index) => {
                                    // 尝试通过 ID 匹配
                                    let sourceFile = null;
                                    if (order.nxDepartmentOrdersId) {
                                        sourceFile = sourceFileMap.get(order.nxDepartmentOrdersId);
                                    }
                                    // 如果通过 ID 没找到，尝试通过索引匹配（适用于新订单）
                                    if (!sourceFile && index < currentOrderItems.length) {
                                        sourceFile = sourceFileMap.get(`index_${index}`);
                                    }
                                    // 如果还是没找到，使用当前激活文件的文件名作为默认值
                                    if (!sourceFile && defaultSourceFile) {
                                        sourceFile = defaultSourceFile;
                                    }

                                    if (!sourceFile) {
                                        console.warn('⚠️ [confirmFixItems] 订单无法匹配 sourceFile:', {
                                            index,
                                            orderId: order.nxDepartmentOrdersId,
                                            goodsName: order.nxDoGoodsName
                                        });
                                    }

                                    return {
                                        ...order,
                                        ...(sourceFile && {sourceFile: sourceFile})
                                    };
                                });

                                // 检查恢复后的 sourceFile
                                const ordersWithSourceFile = correctedOrders.filter(o => o.sourceFile).length;
                                console.log('✅ [confirmFixItems] auto 模式，已恢复 sourceFile 属性:', {
                                    totalOrders: correctedOrders.length,
                                    ordersWithSourceFile: ordersWithSourceFile,
                                    defaultSourceFile: defaultSourceFile,
                                    sampleSourceFile: correctedOrders[0]?.sourceFile
                                });
                            } else if (uploadType === 'auto') {
                                // 如果没有 sourceFileMap，使用当前激活文件的文件名
                                if (this.activeProcessedFileTab) {
                                    const activeFile = this.processedFiles.find(f => f.filePath === this.activeProcessedFileTab);
                                    if (activeFile) {
                                        const defaultSourceFile = activeFile.fileName;
                                        correctedOrders = correctedOrders.map(order => ({
                                            ...order,
                                            sourceFile: defaultSourceFile
                                        }));
                                        console.log('✅ [confirmFixItems] auto 模式，使用默认 sourceFile:', defaultSourceFile);
                                    }
                                }
                            }

                            this.orderItems = correctedOrders;
                            console.log('✅ [confirmFixItems] 已更新 orderItems，数量:', this.orderItems.length);

                            // 如果是 auto 模式，保存 activeProcessedFileTab，防止被清空
                            let savedActiveProcessedFileTab = null;
                            if (uploadType === 'auto') {
                                savedActiveProcessedFileTab = this.activeProcessedFileTab;
                                console.log('💾 [confirmFixItems] auto 模式，保存 activeProcessedFileTab:', savedActiveProcessedFileTab);
                            }


                            // 如果是 auto 模式，恢复 activeProcessedFileTab（如果被清空了）
                            if (uploadType === 'auto' && savedActiveProcessedFileTab && !this.activeProcessedFileTab) {
                                console.warn('⚠️ [confirmFixItems] activeProcessedFileTab 被清空，恢复为:', savedActiveProcessedFileTab);
                                this.activeProcessedFileTab = savedActiveProcessedFileTab;
                            }

                            const currentOrderItems = this.orderItems;
                            console.log('✅ [confirmFixItems] 保存缓存后，订单数量:', currentOrderItems?.length || 0);

                            // 如果是 auto 模式，检查 filteredOrderItems 的数量
                            if (uploadType === 'auto') {
                                const filteredCount = this.filteredOrderItems?.length || 0;
                                console.log('✅ [confirmFixItems] auto 模式，filteredOrderItems 数量:', filteredCount,
                                    'activeProcessedFileTab:', this.activeProcessedFileTab,
                                    'processedFiles 数量:', this.processedFiles?.length || 0);
                            }

                            // 如果订单被清空了，重新设置订单列表（不从缓存加载，因为缓存可能还没更新）
                            if (!currentOrderItems || currentOrderItems.length === 0) {
                                console.warn('⚠️ [confirmFixItems] 订单列表被清空，重新设置订单列表');
                                // 直接重新设置订单列表，而不是从缓存加载
                                this.orderItems = correctedOrders;
                                console.log('✅ [confirmFixItems] 已重新设置订单列表，数量:', correctedOrders.length);
                            }

                            // 关闭弹窗（不需要额外弹窗提示）
                            this.closeFixItemsModal();
                        } else {
                            throw new Error('后台返回的数据格式不正确');
                        }
                    } else {
                        throw new Error(res?.data?.msg || '订单调整失败');
                    }
                } catch (error) {
                    console.error('❌ [confirmFixItems] 调整订单失败:', error);
                    await this.$refs.alertDialog.alert('调整订单失败：' + (error.message || '未知错误'), 'error');
                } finally {
                    console.log('✅ [confirmFixItems] 处理完成，重置 isProcessingFixItems = false');
                    this.isProcessingFixItems = false;
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 确认添加规格（参考 TodayOrders.vue 的 confirmAddStandard）
            async confirmAddStandard() {
                if (!this.itemDis || !this.itemDis.nxDistributerGoodsId) {
                    await this.$refs.alertDialog.alert('商品信息错误', 'error');
                    return;
                }

                if (!this.newStandardName || !this.newStandardName.trim()) {
                    await this.$refs.alertDialog.alert('请输入规格名称', 'warning');
                    return;
                }

                try {
                    this.$store.commit('SET_LOADING', true);

                    const data = {
                        nxDsDisGoodsId: this.itemDis.nxDistributerGoodsId,
                        nxDsStandardName: this.newStandardName.trim(),
                    };

                    const res = await api.disSaveStandard(data);

                    if (res && res.data && res.data.code === 0) {
                        // 更新 itemDis 的规格列表
                        if (!this.itemDis.nxDistributerStandardEntities) {
                            this.itemDis.nxDistributerStandardEntities = [];
                        }
                        this.itemDis.nxDistributerStandardEntities.push(res.data.data);
                        // 自动选择新添加的规格
                        this.editOrderForm.standard = res.data.data.nxDsStandardName;
                        this.showAddStandard = false;
                        this.newStandardName = '';

                        await this.$refs.alertDialog.alert('添加规格成功', 'success');
                    } else {
                        await this.$refs.alertDialog.alert(res?.data?.msg || '添加规格失败', 'error');
                    }
                } catch (error) {
                    console.error('添加规格失败:', error);
                    await this.$refs.alertDialog.alert('添加规格失败，请检查网络', 'error');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 从编辑弹窗中删除订单（无需确认弹窗）
            handleDeleteOrderFromEditModal() {
                if (!this.currentEditOrderItem) {
                    return;
                }
                this.handleDeleteOrder();
            },

            /**
             * 重新识别：将已保存订单（status=0）恢复到待识别状态（status=-2），用原始解析数据覆盖，需重新选择商品
             */
            async handleRevertOrderFromEditModal() {
                if (!this.currentEditOrderItem || !this.currentEditOrderItem.nxDepartmentOrdersId) {
                    await this.$refs.alertDialog.alert('订单未保存，无法重新识别', 'warning');
                    return;
                }
                const orderId = this.currentEditOrderItem.nxDepartmentOrdersId;
                const orderIndex = this.currentEditOrderIndex;
                const sourceType = this.currentEditOrderSourceType;
                const orderItem = this.currentEditOrderItem;

                try {
                    this.$store.commit('SET_LOADING', true);
                    const res = await api.revertTaskOrder(orderId);

                    if (res && res.data && res.data.code === 0) {
                        const updatedOrder = res.data.data;
                        if (!updatedOrder) {
                            await this.$refs.alertDialog.alert('接口返回数据异常', 'error');
                            return;
                        }

                        // 选择性合并：只合并 revert 后需要的字段，避免将接口返回的大对象转为 Vue 深度响应式，减少内存占用
                        const mergeFields = ['nxDoStatus', 'nxDoGoodsName', 'nxDoGoodsNameOriginal', 'nxDistributerGoodsEntity', 'nxDepartmentOrdersId', 'nxDoQuantity', 'nxDoStandard', 'nxDoRemark', 'nxDoPrintStandard', 'nxDoWeight', 'nxDoPrice', 'nxDoSubtotal'];
                        const newItem = { ...orderItem };
                        mergeFields.forEach(f => {
                            if (Object.prototype.hasOwnProperty.call(updatedOrder, f)) {
                                newItem[f] = updatedOrder[f];
                            }
                        });
                        newItem.nxGoodsEntities = [];
                        newItem.nxDistributerGoodsEntityList = [];

                        // 更新订单列表
                        if (orderIndex >= 0 && orderIndex < this.orderItems.length) {
                            this.orderItems.splice(orderIndex, 1, newItem);
                        }

                        // 更新任务统计（已完成数减1，待处理数加1）
                        const wasCompleted = orderItem.nxDoStatus === 0;
                        if (wasCompleted && this.currentTask) {
                            this.currentTask = {
                                ...this.currentTask,
                                nxOcrTaskCompletedOrders: Math.max(0, (this.currentTask.nxOcrTaskCompletedOrders || 0) - 1),
                                nxOcrTaskPendingOrders: (this.currentTask.nxOcrTaskPendingOrders || 0) + 1
                            };
                        }
                        if (this.currentTaskId != null && Array.isArray(this.taskListFromParent)) {
                            const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === this.currentTaskId);
                            if (idx >= 0 && wasCompleted) {
                                const task = this.taskListFromParent[idx];
                                this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                    i === idx ? {
                                        ...t,
                                        nxOcrTaskCompletedOrders: Math.max(0, (task.nxOcrTaskCompletedOrders || 0) - 1),
                                        nxOcrTaskPendingOrders: (task.nxOcrTaskPendingOrders || 0) + 1
                                    } : t
                                );
                            }
                        }

                        this.resetSearchAndMatchedGoodsState();
                        this.closeEditOrderModal();
                        this.$emit('task-added');
                    } else {
                        await this.$refs.alertDialog.alert(res?.data?.msg || '重新识别失败', 'error');
                    }
                } catch (error) {
                    console.error('重新识别失败:', error);
                    await this.$refs.alertDialog.alert('请检查网络', 'error');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 删除订单（参考 TodayOrders.vue 的 handleDeleteOrder）
            async handleDeleteOrder() {
                console.log('🗑️ [handleDeleteOrder] 开始删除订单');

                if (!this.currentEditOrderItem) {
                    console.warn('⚠️ [handleDeleteOrder] currentEditOrderItem 不存在');
                    return;
                }

                if (!this.currentEditOrderItem.nxDepartmentOrdersId) {
                    console.warn('⚠️ [handleDeleteOrder] 订单信息错误，无法删除');
                    await this.$refs.alertDialog.alert('订单信息错误，无法删除', 'error');
                    this.closeEditOrderModal();
                    return;
                }

                const orderId = this.currentEditOrderItem.nxDepartmentOrdersId;
                const orderIndex = this.currentEditOrderIndex;
                const sourceType = this.currentEditOrderSourceType;

                console.log('📋 [handleDeleteOrder] 删除订单信息:', {
                    orderId,
                    orderIndex,
                    sourceType,
                    uploadType: this.uploadType,
                    activeProcessedFileTab: this.activeProcessedFileTab,
                    orderItemsLength: this.orderItems?.length,
                    filteredOrderItemsLength: this.filteredOrderItems?.length,
                    currentEditOrderItem: this.currentEditOrderItem
                });

                try {
                    this.$store.commit('SET_LOADING', true);

                    const res = await api.deleteOrder(orderId);
                    console.log('📥 [handleDeleteOrder] 删除接口响应:', res);

                    if (res && res.data && res.data.code === 0) {
                        console.log('✅ [handleDeleteOrder] 删除成功，开始更新页面数据');
                        this.$emit('task-added');

                        const updatedTask = res.data.task;
                        if (updatedTask && this.currentTaskId != null && updatedTask.nxOcrTaskId === this.currentTaskId) {
                            this.currentTask = {...this.currentTask, ...updatedTask};
                        }
                        if (updatedTask && Array.isArray(this.taskListFromParent)) {
                            const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === updatedTask.nxOcrTaskId);
                            if (idx >= 0) {
                                this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                    i === idx ? {...t, ...updatedTask} : t
                                );
                            }
                        }

                        // 删除后若当前任务 status=2（全部完成），弹窗提示
                        if (updatedTask && updatedTask.nxOcrTaskStatus === 2) {
                            this.closeEditOrderModal();
                            this.stopAllReading();
                            this.showTaskCompleteModal = true;
                            this.taskCompleteModalTaskId = updatedTask.nxOcrTaskId;
                            this.taskCompleteModalSourceType = sourceType || 'paste';
                            this.taskCompleteModalTask = updatedTask;
                        }

                        // 从订单列表中删除
                        if (sourceType === 'paste') {
                            console.log('📝 [handleDeleteOrder] paste 模式，删除前 orderItems 数量:', this.orderItems?.length);
                            if (orderIndex >= 0 && orderIndex < this.orderItems.length) {
                                this.orderItems.splice(orderIndex, 1);
                                console.log('✅ [handleDeleteOrder] paste 模式，删除后 orderItems 数量:', this.orderItems?.length);
                            } else {
                                console.error('❌ [handleDeleteOrder] paste 模式，索引越界:', orderIndex, this.orderItems?.length);
                            }
                        } else if (sourceType === 'auto' && this.uploadType === 'auto') {
                            // auto 模式下，需要找到在 orderItems 中的实际索引
                            const filteredItems = this.filteredOrderItems;
                            console.log('🔄 [handleDeleteOrder] auto 模式，删除前数据:', {
                                filteredItemsLength: filteredItems?.length,
                                orderItemsLength: this.orderItems?.length,
                                orderIndex,
                                activeProcessedFileTab: this.activeProcessedFileTab,
                                currentOrderSourceFile: this.currentEditOrderItem.sourceFile
                            });

                            if (filteredItems && orderIndex >= 0 && orderIndex < filteredItems.length) {
                                const order = filteredItems[orderIndex];
                                console.log('🔍 [handleDeleteOrder] 从 filteredOrderItems 获取订单:', order);

                                const actualIndex = this.orderItems.findIndex(item => item === order);
                                console.log('🔍 [handleDeleteOrder] 在 orderItems 中找到的实际索引:', actualIndex);

                                if (actualIndex >= 0) {
                                    console.log('🗑️ [handleDeleteOrder] 删除前 orderItems 数量:', this.orderItems.length);
                                    this.orderItems.splice(actualIndex, 1);
                                    console.log('✅ [handleDeleteOrder] 删除后 orderItems 数量:', this.orderItems.length);
                                    console.log('✅ [handleDeleteOrder] 删除的订单 sourceFile:', order.sourceFile);
                                } else {
                                    console.error('❌ [handleDeleteOrder] 在 orderItems 中找不到订单，尝试通过 orderId 查找');
                                    // 如果通过引用找不到，尝试通过 orderId 查找
                                    const orderIdIndex = this.orderItems.findIndex(item => item.nxDepartmentOrdersId === orderId);
                                    if (orderIdIndex >= 0) {
                                        console.log('✅ [handleDeleteOrder] 通过 orderId 找到索引:', orderIdIndex);
                                        this.orderItems.splice(orderIdIndex, 1);
                                        console.log('✅ [handleDeleteOrder] 删除后 orderItems 数量:', this.orderItems.length);
                                    } else {
                                        console.error('❌ [handleDeleteOrder] 通过 orderId 也找不到订单');
                                    }
                                }
                            } else {
                                console.error('❌ [handleDeleteOrder] filteredOrderItems 不存在或索引越界:', {
                                    filteredItemsExists: !!filteredItems,
                                    orderIndex,
                                    filteredItemsLength: filteredItems?.length
                                });
                            }
                        } else {
                            // excel 和 image 模式
                            console.log('📄 [handleDeleteOrder] excel/image 模式，删除前 orderItems 数量:', this.orderItems?.length);
                            if (orderIndex >= 0 && orderIndex < this.orderItems.length) {
                                this.orderItems.splice(orderIndex, 1);
                                console.log('✅ [handleDeleteOrder] excel/image 模式，删除后 orderItems 数量:', this.orderItems?.length);
                            } else {
                                console.error('❌ [handleDeleteOrder] excel/image 模式，索引越界:', orderIndex, this.orderItems?.length);
                            }
                        }

                        // 重置搜索和匹配商品列表状态
                        console.log('🔄 [handleDeleteOrder] 重置搜索和匹配商品列表状态');
                        this.resetSearchAndMatchedGoodsState();

                        this.closeEditOrderModal();

                        // 如果是朗读状态（停止的订单），删除完成后继续朗读（forceContinue 跳过 nxDoStatus 检查）；若已弹任务完成窗则不继续朗读
                        if (sourceType && orderIndex >= 0 && !this.showTaskCompleteModal) {
                            const mode = sourceType === 'excel-paste' ? 'excelPaste' : sourceType;
                            const ref = this.getOrderListRef(mode);
                            if (ref && ref.stoppedIndex !== undefined && ref.stoppedIndex !== null && ref.stoppedIndex >= 0) {
                                this.$nextTick(() => {
                                    if (ref && ref.continueReading) ref.continueReading(true);
                                });
                            }
                        }

                        console.log('✅ [handleDeleteOrder] 删除订单完成');
                    } else {
                        console.error('❌ [handleDeleteOrder] 删除失败:', res?.data?.msg);
                        await this.$refs.alertDialog.alert(res?.data?.msg || '删除失败');
                    }
                } catch (error) {
                    console.error('❌ [handleDeleteOrder] 删除订单异常:', error);
                    await this.$refs.alertDialog.alert('', 'warning');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 检查订单数量和规格是否有效
            isValidOrderQuantityAndStandard(item) {
                const quantity = item.nxDoQuantity;
                const standard = item.nxDoStandard;

                // 检查数量：不能为 null、undefined、空字符串或 NaN
                const isValidQuantity = quantity != null &&
                    quantity !== '' &&
                    !isNaN(quantity);

                // 检查规格：不能为 null、undefined 或空字符串（trim后）
                const isValidStandard = standard != null &&
                    standard !== '' &&
                    String(standard).trim() !== '';

                return isValidQuantity && isValidStandard;
            },

            // 保存新商品（参考小程序 disAddGoodsLinshi 实现）
            async handleSaveNewGoods(item, orderIndex, sourceType, goodsNameOverride) {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                // 检查必填字段（优先使用 OrderList 传入的修改后商品名称）
                const goodsName = (goodsNameOverride != null && String(goodsNameOverride).trim() !== '') ? String(goodsNameOverride).trim() : (item.nxDoGoodsName || '');
                const standard = item.nxDoStandard || '';
                const itemUnit = item.itemUnit || '';

                if (!goodsName || !goodsName.trim()) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 如果没有商品单位，则使用订货单位；只有当两者都为空时才提示
                const finalUnit = itemUnit.trim() || standard.trim();
                if (!finalUnit) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 保存当前商品信息，用于弹窗
                this.currentSaveGoodsItem = item;
                this.currentSaveGoodsOrderIndex = orderIndex;
                this.currentSaveGoodsSourceType = sourceType;

                // 初始化表单数据
                this.saveNewGoodsForm = {
                    goodsName: goodsName.trim(),
                    standardName: finalUnit, // 使用商品单位，如果没有则使用订货单位
                    standardWeight: item.standardWeight || '',
                    itemUnit: itemUnit.trim() || '',
                    cartonUnit: item.cartonUnit || '',
                    itemsPerCarton: item.itemsPerCarton || ''
                };

                // 显示弹窗
                this.showSaveNewGoodsModal = true;
            },


            // 完成任务（PasteUpload / ExcelPasteUpload / ImageUpload 的「完成」按钮）
            async onFinishTask() {
                const taskId = this.currentTaskId;
                const task = this.currentTask;
                const sourceType = this.uploadType || 'paste';
                if (taskId == null) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                try {
                    await api.finishTask(taskId);
                } catch (e) {
                    console.error('finishTask failed:', e);
                    await this.$refs.alertDialog.alert(e?.message || '完成任务失败');
                    return;
                }
                this.$emit('task-added');
                this.currentTaskId = null;
                this.currentTask = null;
                // 清空当前任务的订单数据
                this.clearLocalByUploadType(sourceType);
                // 刷新任务列表
                let taskList = [];
                try {
                    if (sourceType === 'paste' && this.$refs.pasteUploadRef?.loadTaskList) {
                        taskList = await this.$refs.pasteUploadRef.loadTaskList() || [];
                    } else if (sourceType === 'excel-paste' && this.$refs.excelPasteUploadRef?.loadTaskList) {
                        taskList = await this.$refs.excelPasteUploadRef.loadTaskList() || [];
                    } else if (sourceType === 'image' && this.$refs.imageUploadRef?.loadTaskList) {
                        const taskType = task?.nxOcrTaskType != null ? task.nxOcrTaskType : 1;
                        taskList = await this.$refs.imageUploadRef.loadTaskList(null, {type: taskType}) || [];
                    }
                } catch (e) {
                    console.error('[PlaceOrder] loadTaskList after onFinishTask failed:', e);
                }
                // 若无任务，跳转到今日订单标签页
                if (taskList.length === 0) {
                    this.$emit('switch-to-today-orders');
                }
            },

            // 关闭任务完成提示弹窗（检查）
            closeTaskCompleteModal() {
                this.showTaskCompleteModal = false;
                this.taskCompleteModalTaskId = null;
                this.taskCompleteModalSourceType = null;
                this.taskCompleteModalTask = null;
                this.stopAllReading();
            },
            // 完成任务完成弹窗（完成 - 调用接口完成任务，清空当前任务并刷新任务列表）
            async confirmTaskCompleteModal() {
                const taskId = this.taskCompleteModalTaskId;
                const sourceType = this.taskCompleteModalSourceType;
                const task = this.taskCompleteModalTask;
                this.closeTaskCompleteModal();
                //关闭播放器
                this.stopAllReading();
                this.currentTaskId = null;
                this.currentTask = null;
                if (taskId == null) return;
                try {
                    await api.finishTask(taskId);
                } catch (e) {
                    console.error('finishTask failed:', e);
                    await this.$refs.alertDialog.alert(e?.message || '完成任务失败');
                    return;
                }
                this.$emit('task-added');
                // 清空当前任务的订单数据，避免任务完成后仍显示旧数据（特别是只剩一个任务时）
                this.clearLocalByUploadType(sourceType);
                let taskList = [];
                try {
                    if (sourceType === 'paste' && this.$refs.pasteUploadRef?.loadTaskList) {
                        taskList = await this.$refs.pasteUploadRef.loadTaskList() || [];
                    } else if (sourceType === 'excel-paste' && this.$refs.excelPasteUploadRef?.loadTaskList) {
                        taskList = await this.$refs.excelPasteUploadRef.loadTaskList() || [];
                    } else if (sourceType === 'image' && this.$refs.imageUploadRef?.loadTaskList) {
                        const taskType = task?.nxOcrTaskType != null ? task.nxOcrTaskType : 1;
                        taskList = await this.$refs.imageUploadRef.loadTaskList(null, {type: taskType}) || [];
                    }
                } catch (e) {
                    console.error('[PlaceOrder] loadTaskList after finishTask failed:', e);
                }
                // 若无任务，跳转到今日订单标签页
                if (taskList.length === 0) {
                    this.$emit('switch-to-today-orders');
                }
            },

            // 关闭保存新商品弹窗
            closeSaveNewGoodsModal() {
                this.showSaveNewGoodsModal = false;
                this.currentSaveGoodsItem = null;
                this.currentSaveGoodsOrderIndex = -1;
                this.currentSaveGoodsSourceType = null;
                this.isSaveNewGoodsFromBeforeOrder = false; // 重置标记
                this.currentSaveGoodsManualRow = null;
                this.currentSaveGoodsManualRowIndex = -1;
                this.saveNewGoodsForm = {
                    goodsName: '',
                    standardName: '',
                    standardWeight: '',
                    itemUnit: '',
                    cartonUnit: '',
                    itemsPerCarton: ''
                };
            },

            // 确认保存新商品
            async confirmSaveNewGoods() {
                if (!this.saveNewGoodsForm.goodsName || !this.saveNewGoodsForm.goodsName.trim()) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                if (!this.saveNewGoodsForm.standardName || !this.saveNewGoodsForm.standardName.trim()) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                // 获取配送商ID
                const disId = this.disUser?.nxDiuDistributerId;
                if (!disId) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 格式化日期（参考小程序 dateUtils.getArriveDate(0)）
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const arriveDate = `${year}-${month}-${day}`;

                // 构建商品数据（参考小程序 disAddGoodsLinshi onLoad）
                const goodsData = {
                    nxDgGoodsId: "-1", // 新商品
                    nxDgPullOff: 0,
                    nxDgGoodsStatus: 0,
                    nxDgBuyingPriceIsGrade: 0,
                    nxDgBuyingPrice: "1", // 默认价格
                    nxDgBuyingPriceUpdate: arriveDate,
                    nxDgDistributerId: disId,
                    nxDgGoodsName: this.saveNewGoodsForm.goodsName.trim(),
                    nxDgGoodsStandardname: (this.saveNewGoodsForm.standardName || '').trim() || '斤',
                    nxDgGoodsStandardWeight: this.saveNewGoodsForm.standardWeight.trim() || "-1",
                    nxDgItemUnit: (this.saveNewGoodsForm.itemUnit || '').trim() || (this.saveNewGoodsForm.standardName || '').trim() || '斤',
                    nxDgGoodsBrand: "-1",
                    nxDgGoodsPlace: "-1",
                    nxDgGoodsInventoryType: 1,
                    nxDgNxGoodsFatherColor: "#20afb8",
                    nxDgGoodsFile: 'goodsImage/logo.jpg',
                    nxDistributerStandardEntities: [],
                    nxDgCartonUnit: this.saveNewGoodsForm.cartonUnit.trim() || "",
                    nxDgItemsPerCarton: this.saveNewGoodsForm.itemsPerCarton != null && this.saveNewGoodsForm.itemsPerCarton !== ''
                        ? String(this.saveNewGoodsForm.itemsPerCarton)
                        : ""
                };

                try {
                    this.$store.commit('SET_LOADING', true);

                    // 调用保存新商品API
                    const res = await api.saveNxDisLinshiGoods(goodsData);

                    if (res && res.data && res.data.code === 0) {
                        // 保存成功，获取返回的商品ID
                        const savedGoods = res.data.data;
                        const goodsId = savedGoods.nxDistributerGoodsId;
                        const savedGoodsName = savedGoods.nxDgGoodsName || this.saveNewGoodsForm.goodsName;

                        // 如果是从"在之前添加新订单"表单中保存的，需要特殊处理
                        if (this.isSaveNewGoodsFromBeforeOrder) {
                            console.log('🔍 [confirmSaveNewGoods] 开始处理 beforeOrder 保存逻辑');
                            console.log('📦 [confirmSaveNewGoods] goodsId:', goodsId);
                            console.log('📦 [confirmSaveNewGoods] savedGoodsName:', savedGoodsName);
                            console.log('📦 [confirmSaveNewGoods] currentSaveGoodsOrderIndex:', this.currentSaveGoodsOrderIndex);
                            console.log('📦 [confirmSaveNewGoods] beforeOrderForm.goodsName:', this.beforeOrderForm.goodsName);

                            // 自动触发商品搜索，这样新商品会出现在搜索结果中
                            await this.handleBeforeOrderGoodsNameEnter({ type: 'search', searchStr: this.beforeOrderForm.goodsName });
                            console.log('📤 [confirmSaveNewGoods] 搜索已触发');

                            // 等待搜索结果更新（需要多等待一下API返回）
                            await this.$nextTick();
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            console.log('📦 [confirmSaveNewGoods] beforeOrderForm.disArr:', this.beforeOrderForm.disArr);
                            console.log('📦 [confirmSaveNewGoods] beforeOrderForm.nxArr:', this.beforeOrderForm.nxArr);

                            // 检查搜索结果是否包含新商品
                            if (this.beforeOrderForm.disArr && this.beforeOrderForm.disArr.length > 0) {
                                console.log('🔍 [confirmSaveNewGoods] disArr 长度:', this.beforeOrderForm.disArr.length);
                                // 找到新商品（应该是第一个结果）
                                const newGoods = this.beforeOrderForm.disArr[0];
                                console.log('🎯 [confirmSaveNewGoods] 找到的商品:', newGoods);
                                console.log('🎯 [confirmSaveNewGoods] 商品ID:', newGoods?.nxDistributerGoodsId);

                                if (newGoods && newGoods.nxDistributerGoodsId === goodsId) {
                                    console.log('✅ [confirmSaveNewGoods] 匹配到新商品，准备选择');

                                    // 自动选择新商品
                                    this.selectBeforeOrderGoods(newGoods);
                                    console.log('✅ [confirmSaveNewGoods] 已调用 selectBeforeOrderGoods');

                                    // 获取标准规格名称
                                    const standardName = (this.saveNewGoodsForm.standardName || '').trim() || '斤';
                                    console.log('📏 [confirmSaveNewGoods] standardName:', standardName);

                                    // 将规格赋值给当前订单的 nxDoStandard
                                    const orderIndex = this.currentSaveGoodsOrderIndex;
                                    console.log('📍 [confirmSaveNewGoods] orderIndex:', orderIndex);

                                    if (orderIndex !== null && orderIndex >= 0) {
                                        const currentOrderItems = this.getCurrentOrderItems();
                                        console.log('📋 [confirmSaveNewGoods] currentOrderItems:', currentOrderItems);
                                        
                                        if (currentOrderItems && currentOrderItems[orderIndex]) {
                                            const oldStandard = currentOrderItems[orderIndex].nxDoStandard;
                                            currentOrderItems[orderIndex].nxDoStandard = standardName;
                                            console.log('🔄 [confirmSaveNewGoods] 已更新订单规格:', {
                                                orderIndex,
                                                oldStandard,
                                                newStandard: standardName
                                            });
                                        } else {
                                            console.log('⚠️ [confirmSaveNewGoods] 订单不存在:', { orderIndex, itemsLength: currentOrderItems?.length });
                                        }
                                    } else {
                                        console.log('⚠️ [confirmSaveNewGoods] orderIndex 无效:', orderIndex);
                                    }
                                } else {
                                    console.log('❌ [confirmSaveNewGoods] 商品ID不匹配:', {
                                        expected: goodsId,
                                        actual: newGoods?.nxDistributerGoodsId
                                    });
                                }
                            } else {
                                console.log('⚠️ [confirmSaveNewGoods] 搜索结果为空或没有配送商商品');
                            }

                            // 关闭弹窗
                            this.closeSaveNewGoodsModal();
                        } else if (this.currentSaveGoodsSourceType === 'manual') {
                            // 手动录入保存新商品：仅等于选择了商品，数量和规格需用户继续填写
                            const rowIndex = this.currentSaveGoodsManualRowIndex;
                            const standardName = (this.saveNewGoodsForm.standardName || '').trim() || '斤';
                            this.$refs.manualEntryRef?.setRowSelectedGoodsAfterSave(rowIndex, savedGoods, standardName);
                            this.$nextTick(() => this.$refs.manualEntryRef?.focusInput(rowIndex, 'quantity'));
                            this.closeSaveNewGoodsModal();
                        } else {
                            // 原有的处理逻辑：设置当前编辑的订单索引和来源类型
                            const orderIndex = this.currentSaveGoodsOrderIndex;
                            const sourceType = this.currentSaveGoodsSourceType;
                            this.orderArrIndex = orderIndex;
                            this.currentSourceType = sourceType;

                            this.goodsId = goodsId;
                            this.selectedGoodsName = savedGoodsName;
                            // 调用保存商品选择（会自动更新订单状态）
                            await this._choiceGoods();

                            // 关闭弹窗
                            this.closeSaveNewGoodsModal();

                            // 如果是朗读状态（停止的订单），保存新商品后继续朗读（从停止处继续，而非从第1条）
                            if (sourceType && sourceType !== 'beforeOrder' && orderIndex >= 0) {
                                const mode = sourceType === 'excel-paste' ? 'excelPaste' : sourceType;
                                const ref = this.getOrderListRef(mode);
                                if (ref && ref.stoppedIndex !== undefined && ref.stoppedIndex !== null && ref.stoppedIndex === orderIndex) {
                                    this.$nextTick(() => {
                                        if (ref && ref.continueReading) ref.continueReading(true);
                                    });
                                }
                            }
                        }
                    } else {
                        // 保存失败
                        const errorMsg = res?.data?.message || '保存失败，可能存在相同商品';
                        await this.$refs.alertDialog.alert(errorMsg);
                        console.error('❌ [confirmSaveNewGoods] 保存新商品失败:', res);
                    }
                } catch (error) {
                    console.error('❌ [confirmSaveNewGoods] 保存新商品异常:', error);
                    await this.$refs.alertDialog.alert('', 'warning');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 删除订单项（无需确认弹窗）
            handleDeleteOrderItem(orderIndex, sourceType) {
                const orderItems = this.getCurrentOrderItems();
                orderItems.splice(orderIndex, 1);
                this.resetSearchAndMatchedGoodsState();
            },

            // 在当前订单之前添加新订单（显示商品选择面板）
            handleAddNewOrderBefore(item, orderIndex, sourceType) {
                // 如果已经有正在添加的订单，先取消
                if (this.addingOrderBeforeIndex !== -1) {
                    this.cancelAddOrderBefore();
                }

                // 设置当前正在添加的订单索引
                this.addingOrderBeforeIndex = orderIndex;

                // 重置表单
                this.beforeOrderForm = {
                    goodsName: '',
                    quantity: '',
                    standard: '',
                    remark: '',
                    selectedGoods: null,
                    searchResults: [],
                    disArr: [],
                    nxArr: [],
                    showSearchResults: false,
                    selectedSearchIndex: 0
                };
                this._beforeOrderStandardHasAutoFilledCarton = false;

            },

            // 取消添加订单
            cancelAddOrderBefore() {
                this.addingOrderBeforeIndex = -1;
                this.beforeOrderForm = {
                    goodsName: '',
                    quantity: '',
                    standard: '',
                    remark: '',
                    selectedGoods: null,
                    searchResults: [],
                    disArr: [],
                    nxArr: [],
                    showSearchResults: false,
                    selectedSearchIndex: 0
                };
            },

            // 处理从手动录入保存新商品（弹窗填写后保存并添加订单）
            async handleSaveNewGoodsFromManual({ rowIndex, row }) {
                const goodsName = (row.goodsName || '').trim();
                if (!goodsName) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                this.currentSaveGoodsItem = { nxDoGoodsName: goodsName };
                this.currentSaveGoodsOrderIndex = -1;
                this.currentSaveGoodsSourceType = 'manual';
                this.currentSaveGoodsManualRow = row;
                this.currentSaveGoodsManualRowIndex = rowIndex;
                this.saveNewGoodsForm = {
                    goodsName,
                    standardName: (row.standard || '').trim(),
                    standardWeight: '',
                    itemUnit: (row.standard || '').trim(),
                    cartonUnit: '',
                    itemsPerCarton: ''
                };
                this.showSaveNewGoodsModal = true;
            },

            // 处理从"在之前添加新订单"表单中保存新商品
            async handleSaveNewGoodsFromBeforeOrder({item, orderIndex}) {
                const goodsName = this.beforeOrderForm.goodsName || '';
                const standard = (this.beforeOrderForm.standard || '').trim();

                if (!goodsName || !goodsName.trim()) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 标记这是从 beforeOrderForm 来的保存
                this.isSaveNewGoodsFromBeforeOrder = true;

                // 构建一个临时的商品对象，用于调用现有的保存新商品逻辑
                const tempItem = {
                    nxDoGoodsName: goodsName.trim(),
                    nxDoStandard: standard,
                    itemUnit: standard,
                    standardWeight: '',
                    cartonUnit: '',
                    itemsPerCarton: ''
                };

                // 保存当前商品信息，用于弹窗
                this.currentSaveGoodsItem = tempItem;
                this.currentSaveGoodsOrderIndex = orderIndex;
                this.currentSaveGoodsSourceType = 'beforeOrder'; // 特殊标记

                // 初始化表单数据
                this.saveNewGoodsForm = {
                    goodsName: goodsName.trim(),
                    standardName: standard,
                    standardWeight: '',
                    itemUnit: standard,
                    cartonUnit: '',
                    itemsPerCarton: ''
                };

                // 显示弹窗
                this.showSaveNewGoodsModal = true;
            },

            // 处理之前添加订单的商品名称输入（仅更新值，回车时再搜索，与正常录入一致）
            handleBeforeOrderGoodsNameInput(value) {
                const form = this.beforeOrderForm;
                const prevName = (form.selectedGoods?.nxDgGoodsName || form.selectedGoods?.nxGoodsName || '').trim();
                form.goodsName = value || '';
                const searchStr = (value || '').trim();
                if (!searchStr || searchStr.length < 1) {
                    if (this._beforeOrderGoodsSearchDebounce) clearTimeout(this._beforeOrderGoodsSearchDebounce);
                    this._beforeOrderGoodsSearchDebounce = null;
                    form.showSearchResults = false;
                    form.searchResults = [];
                    form.disArr = [];
                    form.nxArr = [];
                    if (form.selectedGoods && searchStr !== prevName) form.selectedGoods = null;
                    return;
                }
                // 用户修改输入时清除已选商品和下拉
                if (form.selectedGoods && searchStr !== prevName) form.selectedGoods = null;
                form.showSearchResults = false;
                form.disArr = [];
                form.nxArr = [];
            },
            // 处理之前添加订单的商品名回车（ManualEntryUpload 专用：搜索或选中）
            handleBeforeOrderGoodsNameEnter(payload) {
                if (payload.type === 'select') {
                    const form = this.beforeOrderForm;
                    const idx = form.selectedSearchIndex ?? 0;
                    const disLen = form.disArr?.length || 0;
                    if (idx < disLen) {
                        this.selectBeforeOrderGoods(form.disArr[idx]);
                        return;
                    }
                    if (idx < disLen + (form.nxArr?.length || 0)) {
                        this.handleManualDownloadGoodsNx({ goods: form.nxArr[idx - disLen], orderIndex: payload.orderIndex });
                        return;
                    }
                }
                if (payload.type === 'search' && payload.searchStr) {
                    // 页面刚打开没有订单时,按回车不应该触发搜索请求
                    if (!this.orderItems || this.orderItems.length === 0) {
                        console.log('⚠️ [handleBeforeOrderGoodsNameEnter] 没有订单数据,不触发搜索');
                        return;
                    }
                    this._doBeforeOrderGoodsSearch(payload.searchStr);
                }
            },
            // 处理之前添加订单的商品名 ↑↓（ManualEntryUpload 专用）
            handleBeforeOrderGoodsNameKeydown(payload) {
                const form = this.beforeOrderForm;
                const total = payload.total || 0;
                if (payload.key === 'ArrowDown') {
                    form.selectedSearchIndex = (form.selectedSearchIndex + 1) % total;
                } else if (payload.key === 'ArrowUp') {
                    form.selectedSearchIndex = form.selectedSearchIndex <= 0 ? total - 1 : form.selectedSearchIndex - 1;
                }
            },
            async _doBeforeOrderGoodsSearch(searchStr) {
                console.log('🔍 [_doBeforeOrderGoodsSearch] 开始搜索:', searchStr);
                const depId = this.selectedSubDepartment || this.selectedAllCustomer;
                console.log('📍 [_doBeforeOrderGoodsSearch] depId:', depId);
                if (!depId || !this.disUser) return;
                try {
                    const data = {
                        disId: this.disUser.nxDiuDistributerId,
                        searchStr,
                        depId
                    };
                    console.log('📤 [_doBeforeOrderGoodsSearch] 请求参数:', data);
                    const res = await api.queryDisGoodsByQuickSearchWithDepId(data);
                    console.log('📥 [_doBeforeOrderGoodsSearch] 搜索结果:', res);
                    if (res && res.data && res.data.code === 0) {
                        const disArr = res.data.data.disArr || [];
                        const nxArr = res.data.data.nxArr || [];
                        console.log('✅ [_doBeforeOrderGoodsSearch] 搜索成功:', { disArrCount: disArr.length, nxArrCount: nxArr.length });
                        this.beforeOrderForm.disArr = disArr;
                        this.beforeOrderForm.nxArr = nxArr;
                        this.beforeOrderForm.searchResults = disArr;
                        this.beforeOrderForm.showSearchResults = disArr.length > 0 || nxArr.length > 0;
                        this.beforeOrderForm.selectedSearchIndex = 0;
                        // 保存本次搜索的值,用于判断是否需要重新搜索
                        this.beforeOrderForm.lastSearchStr = searchStr;
                        console.log('💾 [_doBeforeOrderGoodsSearch] 保存搜索值:', searchStr);
                    } else {
                        console.log('❌ [_doBeforeOrderGoodsSearch] 搜索失败:', res?.data);
                        this.beforeOrderForm.showSearchResults = false;
                        this.beforeOrderForm.searchResults = [];
                        this.beforeOrderForm.disArr = [];
                        this.beforeOrderForm.nxArr = [];
                        this.beforeOrderForm.lastSearchStr = null;
                    }
                } catch (error) {
                    console.error('❌ [_doBeforeOrderGoodsSearch] 搜索异常:', error);
                    this.beforeOrderForm.showSearchResults = false;
                    this.beforeOrderForm.searchResults = [];
                    this.beforeOrderForm.disArr = [];
                    this.beforeOrderForm.nxArr = [];
                    this.beforeOrderForm.lastSearchStr = null;
                }
            },

            // 关闭之前添加订单的搜索结果列表
            closeBeforeOrderSearchResults() {
                this.beforeOrderForm.showSearchResults = false;
            },

            // 选择之前添加订单的商品
            async selectBeforeOrderGoods(goods) {
                console.log('🎯 [selectBeforeOrderGoods] 开始选择商品:', goods);
                this._beforeOrderStandardHasAutoFilledCarton = false;
                this.beforeOrderForm.selectedGoods = goods;
                this.beforeOrderForm.goodsName = goods.nxDgGoodsName || '';
                this.beforeOrderForm.showSearchResults = false;
                console.log('✅ [selectBeforeOrderGoods] 已设置 selectedGoods');

                // 如果有商品ID，获取完整的商品信息（包含价格、规格等）
                if (goods.nxDistributerGoodsId) {
                    try {
                        const res = await api.disGetGoods(goods.nxDistributerGoodsId);
                        if (res && res.data && res.data.code === 0 && res.data.data) {
                            // 保存完整的商品信息
                            this.beforeOrderForm.selectedGoods = res.data.data;
                            // 使用商品的规格字段，优先使用完整商品信息的规格
                            if (res.data.data.nxDgGoodsStandardname) {
                                this.beforeOrderForm.standard = res.data.data.nxDgGoodsStandardname;
                            } else if (goods.nxDgGoodsStandardname) {
                                this.beforeOrderForm.standard = goods.nxDgGoodsStandardname;
                            } else {
                                this.beforeOrderForm.standard = '';
                            }
                            console.log('✅ [selectBeforeOrderGoods] 已获取商品详情,规格:', this.beforeOrderForm.standard);
                        }
                    } catch (error) {
                        console.error('❌ [selectBeforeOrderGoods] 获取商品详细信息失败:', error);
                        // 失败时使用搜索结果中的基本信息
                        if (goods.nxDgGoodsStandardname) {
                            this.beforeOrderForm.standard = goods.nxDgGoodsStandardname;
                        } else {
                            this.beforeOrderForm.standard = '';
                        }
                    }
                } else {
                    // 没有商品ID，使用搜索结果中的基本信息
                    if (goods.nxDgGoodsStandardname) {
                        this.beforeOrderForm.standard = goods.nxDgGoodsStandardname;
                    } else {
                        this.beforeOrderForm.standard = '';
                    }
                }

                // 选择商品后，如果数量和规格都有内容，则自动保存订单
                const form = this.beforeOrderForm;
                if (form.selectedGoods && form.quantity && form.quantity.toString().trim() && form.standard && form.standard.toString().trim()) {
                    console.log('🎯 [selectBeforeOrderGoods] 数量和规格都有内容，自动保存订单');
                    // 获取当前正在插入订单的索引
                    const orderIndex = this.addingOrderBeforeIndex;
                    if (orderIndex !== null && orderIndex >= 0 && this.orderItems[orderIndex]) {
                        await this.saveBeforeOrder(this.orderItems[orderIndex], orderIndex, 'excel');
                    }
                }
            },

            // 保存之前添加的订单（调用 saveOrderBefore API）
            async saveBeforeOrder(item, orderIndex, sourceType) {
                if (!this.beforeOrderForm.selectedGoods) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                if (!this.beforeOrderForm.quantity || !this.beforeOrderForm.quantity.toString().trim()) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                if (!this.beforeOrderForm.standard || !this.beforeOrderForm.standard.toString().trim()) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 获取部门ID
                const depId = this.selectedSubDepartment || this.selectedAllCustomer;
                if (!depId) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 获取 beforeId（当前订单的ID，用于在之前插入新订单）
                // saveBefore 接口：nxDoPurchaseUserId 传 beforeId（前面 order 的 id），后端用此查询 beforOrder
                const beforeId = item.nxDepartmentOrdersId || -1;
                if (beforeId === -1 || beforeId == null) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                // saveBefore 接口：nxDoPurchaseUserId 传 beforeId（前面 order 的 id）
                const nxDoPurchaseUserId = beforeId;

                try {
                    this.$store.commit('SET_LOADING', true);

                    // 获取完整的商品信息（itemDis）
                    const itemDis = this.beforeOrderForm.selectedGoods;
                    const quantity = parseFloat(this.beforeOrderForm.quantity) || 0;
                    const standard = this.beforeOrderForm.standard || '斤';
                    const level = '1'; // 默认使用级别1，参考 resGoodsList.js

                    // 初始化价格相关变量（参考 resGoodsList.js _saveFillOrder）
                    let depDisGoodsId = -1;
                    let price = null;
                    let weight = null;
                    let subtotal = null;
                    let printStandard = null;
                    let costSubtotal = null;
                    let profitSubtotal = 0;
                    let profitScale = 0;
                    let costPrice = 0;
                    let costPriceUpdate = null;

                    // 根据级别计算价格（参考 resGoodsList.js）
                    if (level == "1") {
                        costPrice = itemDis.nxDgBuyingPriceOne || 0;
                        costPriceUpdate = itemDis.nxDgBuyingPriceOneUpdate || this._getTodayDate();
                        price = itemDis.nxDgWillPriceOne || 0;
                        printStandard = itemDis.nxDgGoodsStandardname || standard;

                        if (standard == itemDis.nxDgGoodsStandardname) {
                            weight = quantity;
                            subtotal = (Number(price) * Number(quantity)).toFixed(1);
                            costSubtotal = (Number(costPrice) * Number(quantity)).toFixed(1);
                            profitSubtotal = (Number(subtotal) - Number(costSubtotal)).toFixed(1);
                            profitScale = Number((Number(price) - Number(costPrice)) / Number(price) * 100).toFixed(2);
                        }
                    } else if (level == "2") {
                        printStandard = itemDis.nxDgWillPriceTwoStandard || standard;
                        weight = quantity;
                        costPriceUpdate = itemDis.nxDgBuyingPriceTwoUpdate || this._getTodayDate();
                        costPrice = itemDis.nxDgBuyingPriceTwo || 0;
                        price = itemDis.nxDgWillPriceTwo || 0;
                        subtotal = (Number(price) * Number(quantity)).toFixed(1);
                        costSubtotal = (Number(costPrice) * Number(quantity)).toFixed(1);
                        profitSubtotal = (Number(subtotal) - Number(costSubtotal)).toFixed(1);
                        profitScale = Number((Number(price) - Number(costPrice)) / Number(price) * 100).toFixed(2);
                    }

                    // 处理部门商品的价格（参考 resGoodsList.js）
                    if (itemDis.departmentDisGoodsEntity !== null && itemDis.departmentDisGoodsEntity !== undefined) {
                        depDisGoodsId = itemDis.departmentDisGoodsEntity.nxDepartmentDisGoodsId || -1;
                        if (standard == itemDis.departmentDisGoodsEntity.nxDdgOrderStandard) {
                            price = itemDis.departmentDisGoodsEntity.nxDdgOrderPrice || price;
                            weight = quantity;
                            subtotal = (Number(price) * Number(quantity)).toFixed(1);
                            costSubtotal = (Number(costPrice) * Number(weight)).toFixed(1);
                            profitSubtotal = (Number(subtotal) - Number(costSubtotal)).toFixed(1);
                            profitScale = Number((Number(price) - Number(costPrice)) / Number(price) * 100).toFixed(2);
                        }
                    }

                    // 获取日期信息（参考 resGoodsList.js）
                    const arriveDate = this._getTodayDate();
                    const arriveOnlyDate = this._getTodayDate().split('-')[2]; // 只取日期部分
                    const weekYear = ''; // 周年份，可以留空或计算
                    const week = ''; // 周几，可以留空或计算

                    // 构建订单数据（参考 resGoodsList.js _saveFillOrder）
                    const orderData = {
                        nxDoOrderUserId: this.disUser?.nxDepartmentUserId || this.disUser?.nxDistributerUserId || -1,
                        nxDoDepDisGoodsId: depDisGoodsId,
                        nxDoDisGoodsFatherId: itemDis.nxDgDfgGoodsFatherId || -1,
                        nxDoDisGoodsGrandId: itemDis.nxDgDfgGoodsGrandId || -1,
                        nxDoDisGoodsId: itemDis.nxDistributerGoodsId,
                        nxDoDepartmentId: depId,
                        nxDoDistributerId: this.disUser?.nxDiuDistributerId,
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoQuantity: quantity,
                        nxDoPrice: price || 0,
                        nxDoWeight: weight || null,
                        nxDoSubtotal: subtotal || null,
                        nxDoStandard: standard,
                        nxDoRemark: this.beforeOrderForm.remark || '',
                        nxDoIsAgent: -1,
                        nxDoArriveDate: arriveDate,
                        nxDoArriveWeeksYear: weekYear,
                        nxDoArriveOnlyDate: arriveOnlyDate,
                        nxDoArriveWhatDay: week,
                        nxDoCostPriceUpdate: costPriceUpdate || arriveDate,
                        nxDoCostPrice: costPrice || 0,
                        nxDoPurchaseGoodsId: -1,
                        nxDoCostSubtotal: costSubtotal || null,
                        nxDoProfitSubtotal: profitSubtotal || 0,
                        nxDoProfitScale: profitScale || 0,
                        nxDoNxGoodsId: itemDis.nxDgNxGoodsId || -1,
                        nxDoNxGoodsFatherId: itemDis.nxDgNxFatherId || -1,
                        nxDoGoodsType: itemDis.nxDgPurchaseAuto || 0,
                        nxDoPurchaseUserId: nxDoPurchaseUserId,
                        nxDoPrintStandard: printStandard || standard,
                        nxDoCostPriceLevel: level,
                        nxDoGoodsName: itemDis.nxDgGoodsName || '',
                        nxDoOcrTaskId: this.currentTaskId,
                    };
                    console.log("abccccurrentTaskIdcurrentTaskIdppppp", this.currentTaskId)

                    // 手动录入用 saveBefore（nxDoPurchaseUserId=beforeId）；其他模式用 saveOrderBeforeTask
                    const res = sourceType === 'manual'
                        ? await api.manualOrderBefore(orderData)
                        : await api.saveOrderBefore(orderData);

                    // Vue 中 axios 返回 res.data，后端返回 { code: 0, data: {...} }
                    // 所以访问 res.data.code 和 res.data.data
                    if (res && res.data && res.data.code === 0) {
                        const updatedTask = res.data.task;
                        if (updatedTask && this.currentTaskId != null && updatedTask.nxOcrTaskId === this.currentTaskId) {
                            this.currentTask = {...this.currentTask, ...updatedTask};
                        }
                        if (updatedTask && Array.isArray(this.taskListFromParent)) {
                            const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === updatedTask.nxOcrTaskId);
                            if (idx >= 0) {
                                this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                    i === idx ? {...t, ...updatedTask} : t
                                );
                            }
                        }

                        // 保存成功，将新订单插入到指定位置（参考 resGoodsList.js 第812行）
                        const orderItems = this.getCurrentOrderItems();

                        // 如果是转订单模式，需要设置 sourceFile 属性，以便在 filteredOrderItems 中正确显示
                        let sourceFile = null;
                        if (sourceType === 'auto' && this.uploadType === 'auto' && this.activeProcessedFileTab) {
                            const activeFile = this.processedFiles.find(f => f.filePath === this.activeProcessedFileTab);
                            if (activeFile) {
                                sourceFile = activeFile.fileName;
                            }
                        }

                        const newOrder = {
                            ...res.data.data,
                            nxDoGoodsNameOriginal: res.data.data.nxDoGoodsName || '',
                            nxDoStandardWarn: 0,
                            goodsNameWarn: 0,
                            nxDistributerGoodsEntityList: [],
                            nxGoodsEntities: [],
                            ...(sourceFile && {sourceFile: sourceFile}) // 如果是转订单模式，添加 sourceFile
                        };

                        // 调试：之前插入订单的序号和显示顺序
                        const seq = (o) => o?.getNxDoTodayOrder ?? o?.nxDoTodayOrder ?? 0;
                        console.log('[saveBeforeOrder] 接口返回 data 全部字段:', res.data.data);
                        console.log('[saveBeforeOrder] sourceType:', sourceType, 'orderIndex:', orderIndex);
                        console.log('[saveBeforeOrder] 新订单 nxDoTodayOrder/getNxDoTodayOrder:', {
                            getNxDoTodayOrder: res.data.data?.getNxDoTodayOrder,
                            nxDoTodayOrder: res.data.data?.nxDoTodayOrder,
                            seq: seq(newOrder)
                        });
                        console.log('[saveBeforeOrder] 插入前 orderItems 各订单序号:', orderItems.map((o, i) => ({
                            i, name: o.nxDoGoodsName, seq: seq(o), id: o.nxDepartmentOrdersId
                        })));

                        // 计算实际插入位置
                        // 如果是转订单模式，orderIndex 是 filteredOrderItems 的索引，需要转换为 orderItems 的实际索引
                        let actualIndex = orderIndex;
                        if (sourceType === 'auto' && this.uploadType === 'auto') {
                            const filteredItems = this.filteredOrderItems;
                            if (orderIndex >= 0 && orderIndex < filteredItems.length) {
                                const targetOrder = filteredItems[orderIndex];
                                // 找到目标订单在 orderItems 中的实际索引
                                actualIndex = orderItems.findIndex(item => item === targetOrder);
                                if (actualIndex === -1) {
                                    // 如果找不到，使用 filteredOrderItems 的索引（可能不在当前文件范围内）
                                    actualIndex = orderIndex;
                                }
                            }
                        }

                        // 插入新订单到正确位置
                        orderItems.splice(actualIndex, 0, newOrder);
                        console.log('[saveBeforeOrder] 插入后(排序前) orderItems:', orderItems.map((o, i) => ({
                            i, name: o.nxDoGoodsName, seq: seq(o), isNew: o === newOrder
                        })));

                        // 按订单序号排序：saveBefore 返回的新订单 nxDoTodayOrder 比 before 大，升序后 [before, new]，reverse 后 new 显示在上面
                        const sorted = [...orderItems].sort((a, b) => seq(a) - seq(b));
                        orderItems.splice(0, orderItems.length, ...sorted);
                        console.log('[saveBeforeOrder] 排序后 orderItems (ManualEntry 用 reverse 显示，最后一项显示在最上面):', orderItems.map((o, i) => ({
                            i, name: o.nxDoGoodsName, seq: seq(o), isNew: o === newOrder,
                            displayPos: orderItems.length - 1 - i
                        })));

                        // 重置状态
                        this.cancelAddOrderBefore();

                    } else {
                        const errorMsg = res?.data?.msg || res?.data?.message || '保存失败';
                        await this.$refs.alertDialog.alert(errorMsg);
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    const errorMsg = error?.message || error?.response?.data?.msg || '网络请求失败,请检查网络连接';
                    await this.$refs.alertDialog.alert(errorMsg, 'warning');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 获取今天的日期（YYYY-MM-DD格式）
            _getTodayDate() {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            },

            // 删除订单（Excel模式，参考小程序 delOrder）
            async handleDeleteOrderFromExcel(item, orderIndex, sourceType) {
                console.log('🗑️ [handleDeleteOrderFromExcel] 开始删除订单');
                console.log('📋 [handleDeleteOrderFromExcel] 删除订单信息:', {
                    item,
                    orderIndex,
                    sourceType,
                    uploadType: this.uploadType,
                    activeProcessedFileTab: this.activeProcessedFileTab,
                    orderId: item?.nxDepartmentOrdersId
                });

                const orderItems = this.getCurrentOrderItems();
                console.log('📋 [handleDeleteOrderFromExcel] 当前订单列表:', {
                    orderItemsLength: orderItems?.length,
                    orderItemsType: 'orderItems',
                    filteredOrderItemsLength: sourceType === 'auto' ? this.filteredOrderItems?.length : 'N/A'
                });

                if (!item) {
                    console.error('❌ [handleDeleteOrderFromExcel] 要删除的订单不存在，index:', orderIndex);
                    return;
                }


                // 如果订单有 nxDepartmentOrdersId，说明已经保存到服务器，需要调用接口删除
                if (item.nxDepartmentOrdersId) {
                    try {
                        this.$store.commit('SET_LOADING', true);

                        const res = await api.deleteOrder(item.nxDepartmentOrdersId);
                        console.log('📥 [handleDeleteOrderFromExcel] 删除接口响应:', res);

                        if (res && res.data && res.data.code === 0) {
                            console.log('✅ [handleDeleteOrderFromExcel] 删除成功，开始更新页面数据');
                            this.$emit('task-added');
                            const updatedTask = res.data.task;
                            if (updatedTask && this.currentTaskId != null && updatedTask.nxOcrTaskId === this.currentTaskId) {
                                this.currentTask = {...this.currentTask, ...updatedTask};
                            }
                            if (updatedTask && Array.isArray(this.taskListFromParent)) {
                                const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === updatedTask.nxOcrTaskId);
                                if (idx >= 0) {
                                    this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                        i === idx ? {...t, ...updatedTask} : t
                                    );
                                }
                            }
                            // 对于 auto 模式，需要特殊处理
                            if (sourceType === 'auto' && this.uploadType === 'auto') {
                                console.log('🔄 [handleDeleteOrderFromExcel] auto 模式，删除前数据:', {
                                    filteredOrderItemsLength: this.filteredOrderItems?.length,
                                    orderItemsLength: this.orderItems?.length,
                                    orderIndex,
                                    activeProcessedFileTab: this.activeProcessedFileTab,
                                    itemSourceFile: item.sourceFile
                                });

                                // orderIndex 是 filteredOrderItems 的索引，需要找到在 orderItems 中的实际索引
                                const filteredItems = this.filteredOrderItems;
                                if (filteredItems && orderIndex >= 0 && orderIndex < filteredItems.length) {
                                    const filteredOrder = filteredItems[orderIndex];
                                    console.log('🔍 [handleDeleteOrderFromExcel] 从 filteredOrderItems 获取订单:', filteredOrder);

                                    const actualIndex = this.orderItems.findIndex(order => order === filteredOrder);
                                    console.log('🔍 [handleDeleteOrderFromExcel] 在 orderItems 中找到的实际索引:', actualIndex);

                                    if (actualIndex >= 0) {
                                        console.log('🗑️ [handleDeleteOrderFromExcel] 删除前 orderItems 数量:', this.orderItems.length);
                                        this.orderItems.splice(actualIndex, 1);
                                        console.log('✅ [handleDeleteOrderFromExcel] 删除后 orderItems 数量:', this.orderItems.length);
                                    } else {
                                        console.error('❌ [handleDeleteOrderFromExcel] 在 orderItems 中找不到订单，尝试通过 orderId 查找');
                                        // 如果通过引用找不到，尝试通过 orderId 查找
                                        const orderIdIndex = this.orderItems.findIndex(order => order.nxDepartmentOrdersId === item.nxDepartmentOrdersId);
                                        if (orderIdIndex >= 0) {
                                            console.log('✅ [handleDeleteOrderFromExcel] 通过 orderId 找到索引:', orderIdIndex);
                                            this.orderItems.splice(orderIdIndex, 1);
                                            console.log('✅ [handleDeleteOrderFromExcel] 删除后 orderItems 数量:', this.orderItems.length);
                                        } else {
                                            console.error('❌ [handleDeleteOrderFromExcel] 通过 orderId 也找不到订单');
                                        }
                                    }
                                } else {
                                    console.error('❌ [handleDeleteOrderFromExcel] filteredOrderItems 不存在或索引越界');
                                    // 降级处理：直接从 orderItems 中删除
                                    const orderIdIndex = this.orderItems.findIndex(order => order.nxDepartmentOrdersId === item.nxDepartmentOrdersId);
                                    if (orderIdIndex >= 0) {
                                        console.log('✅ [handleDeleteOrderFromExcel] 降级处理：通过 orderId 找到索引:', orderIdIndex);
                                        this.orderItems.splice(orderIdIndex, 1);
                                    }
                                }
                            } else {
                                // 从数组中删除
                                console.log('🗑️ [handleDeleteOrderFromExcel] 删除前 orderItems 数量:', orderItems?.length);
                                orderItems.splice(orderIndex, 1);
                                console.log('✅ [handleDeleteOrderFromExcel] 删除后 orderItems 数量:', orderItems?.length);
                            }

                            // 重置搜索和匹配商品列表状态
                            console.log('🔄 [handleDeleteOrderFromExcel] 重置搜索和匹配商品列表状态');
                            this.resetSearchAndMatchedGoodsState();

                            // 删除后刷新任务列表（可能是最后一条订单，任务已被后端删除）
                            if (sourceType === 'paste' && this.$refs.pasteUploadRef?.loadTaskList) {
                                this.$nextTick(() => this.$refs.pasteUploadRef.loadTaskList());
                            }
                            if (sourceType === 'excel-paste' && this.$refs.excelPasteUploadRef?.loadTaskList) {
                                this.$nextTick(() => this.$refs.excelPasteUploadRef.loadTaskList());
                            }

                            console.log('✅ [handleDeleteOrderFromExcel] 删除订单完成');
                        } else {
                            console.error('❌ [handleDeleteOrderFromExcel] 接口删除失败:', res?.data?.msg || res?.data?.message);
                            await this.$refs.alertDialog.alert(res?.data?.msg || res?.data?.message || '删除失败');
                        }
                    } catch (error) {
                        console.error('❌ [handleDeleteOrderFromExcel] 删除订单接口调用失败:', error);
                        await this.$refs.alertDialog.alert('', 'warning');
                    } finally {
                        this.$store.commit('SET_LOADING', false);
                    }
                    return;
                }

                // 如果订单没有 nxDepartmentOrdersId，说明只是草稿，直接从数组中删除
                orderItems.splice(orderIndex, 1);

                // 重置搜索和匹配商品列表状态
                // this.resetSearchAndMatchedGoodsState();
                if (orderItems.length == 0) {
                    this.pasteInputText = "";
                }


            },

            // 选择匹配的商品
            async selectMatchedGoods(item, orderIndex, goodsIndex, sourceType) {
                // 安全检查
                if (!item || !item.nxDistributerGoodsEntityList || !Array.isArray(item.nxDistributerGoodsEntityList)) {
                    console.error('[selectMatchedGoods] 订单项或商品列表不存在:', {item, orderIndex, goodsIndex});
                    return;
                }
                if (goodsIndex === undefined || goodsIndex === null || goodsIndex < 0 || goodsIndex >= item.nxDistributerGoodsEntityList.length) {
                    console.error('[selectMatchedGoods] 商品索引无效:', {
                        orderIndex,
                        goodsIndex,
                        listLength: item.nxDistributerGoodsEntityList.length
                    });
                    return;
                }
                const selectedGoods = item.nxDistributerGoodsEntityList[goodsIndex];
                if (!selectedGoods) {
                    console.error('[selectMatchedGoods] 选中的商品不存在:', {orderIndex, goodsIndex});
                    return;
                }

                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型
                this.goodsId = selectedGoods.nxDistributerGoodsId;
                this.selectedGoodsName = selectedGoods.nxDgGoodsName || '';

                // 标记选中的商品索引
                item.selectedGoodsIndex = goodsIndex;

                // 调用保存商品选择
                await this._choiceGoods();

                // 如果是停止的订单（image 模式），选择完成后继续朗读
                if (sourceType === 'image' && this.$refs.imageOrderListRef) {
                    const stoppedIndex = this.$refs.imageOrderListRef.stoppedIndex;
                    if (stoppedIndex !== undefined && stoppedIndex !== null && stoppedIndex === orderIndex) {
                        console.log('[PlaceOrder] 停止的订单已完成选择，继续朗读，索引:', orderIndex);
                        this.$nextTick(() => {
                            if (this.$refs.imageOrderListRef && this.$refs.imageOrderListRef.continueReading) {
                                this.$refs.imageOrderListRef.continueReading();
                            }
                        });
                    }
                }
            },

            // 选择匹配商品（转订单模式，直接传入商品对象）
            async choiceGoodsForApply(orderGoods, orderIndex, sourceType) {
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型
                this.goodsId = orderGoods.nxDistributerGoodsId;
                this.selectedGoodsName = orderGoods.nxDgGoodsName || '';

                // 调用保存商品选择
                await this._choiceGoods();

                // 如果是朗读状态（停止的订单），选择完成后继续朗读（forceContinue 跳过 nxDoStatus 检查）
                const mode = sourceType === 'excel-paste' ? 'excelPaste' : sourceType;
                const ref = this.getOrderListRef(mode);
                if (ref && ref.stoppedIndex !== undefined && ref.stoppedIndex !== null && ref.stoppedIndex === orderIndex) {
                    this.$nextTick(() => {
                        if (ref && ref.continueReading) ref.continueReading(true);
                    });
                }
            },

            // 选择搜索结果中的商品
            async selectSearchResult(goods, orderIndex, sourceType) {
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型
                this.goodsId = goods.nxDistributerGoodsId;
                this.selectedGoodsName = goods.nxDgGoodsName || '';

                // 调用保存商品选择
                await this._choiceGoods();

                // 选择完成后清空搜索结果下拉框，避免再次点击触发重复请求
                this.resetSearchAndMatchedGoodsState();

                // 若是停止的订单，选择完成后继续朗读（所有模式，forceContinue 跳过 nxDoStatus 检查）
                const mode = sourceType === 'excel-paste' ? 'excelPaste' : sourceType;
                const ref = this.getOrderListRef(mode);
                if (ref && ref.stoppedIndex !== undefined && ref.stoppedIndex !== null && ref.stoppedIndex === orderIndex) {
                    console.log('[PlaceOrder] 停止的订单已完成选择，继续朗读，索引:', orderIndex);
                    this.$nextTick(() => {
                        if (ref && ref.continueReading) ref.continueReading(true);
                    });
                }
            },

            // 下载商品后应用商品到订单（公共流程）
            async _applyGoodsToOrder(goodsId, goodsName, orderIndex, sourceType) {
                console.log("🔄 [_applyGoodsToOrder] 应用商品到订单:", {
                    goodsId,
                    goodsName,
                    orderIndex,
                    sourceType
                });

                // 设置商品ID和名称
                this.goodsId = goodsId;
                this.selectedGoodsName = goodsName;

                // 确保 orderArrIndex 和 currentSourceType 正确设置
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType;

                await this._choiceGoods();
            },

            // 搜索已存在的商品（优先使用 nxGoodsId 精确匹配）
            async _searchExistingGoods(goods, orderIndex, sourceType) {
                console.log("🔍 [_searchExistingGoods] 搜索已存在的商品:", {
                    nxGoodsId: goods.nxGoodsId,
                    goodsName: goods.nxGoodsName,
                    orderIndex
                });

                try {
                    // 获取部门ID
                    const depId = this.selectedSubDepartment || this.selectedAllCustomer;

                    if (!depId) {
                        console.warn("⚠️ [_searchExistingGoods] 部门ID不存在");
                        return null;
                    }

                    // 搜索已存在的商品
                    const searchData = {
                        disId: this.disUser?.nxDiuDistributerId,
                        searchStr: goods.nxGoodsName,
                        depId: depId
                    };

                    const searchRes = await api.queryDisGoodsByQuickSearchWithDepId(searchData);

                    if (searchRes && searchRes.data && searchRes.data.code === 0) {
                        const disArr = searchRes.data.data.disArr || [];

                        // 优先使用 nxGoodsId 精确匹配
                        let foundGoods = disArr.find(item =>
                            item.nxDgNxGoodsId === goods.nxGoodsId
                        );

                        // 如果 nxGoodsId 匹配失败，使用商品名称精确匹配
                        if (!foundGoods) {
                            foundGoods = disArr.find(item =>
                                item.nxDgGoodsName === goods.nxGoodsName
                            );
                        }

                        // 如果精确匹配失败，使用第一个匹配的商品
                        if (!foundGoods && disArr.length > 0) {
                            foundGoods = disArr[0];
                            console.log("⚠️ [_searchExistingGoods] 使用第一个匹配的商品（非精确匹配）");
                        }

                        if (foundGoods && foundGoods.nxDistributerGoodsId) {
                            console.log("✅ [_searchExistingGoods] 找到已存在的商品:", {
                                nxDistributerGoodsId: foundGoods.nxDistributerGoodsId,
                                nxDgGoodsName: foundGoods.nxDgGoodsName,
                                matchedBy: foundGoods.nxDgNxGoodsId === goods.nxGoodsId ? 'nxGoodsId' :
                                    foundGoods.nxDgGoodsName === goods.nxGoodsName ? 'goodsName' : 'first'
                            });
                            return foundGoods;
                        }
                    }

                    return null;
                } catch (searchError) {
                    console.error("❌ [_searchExistingGoods] 搜索已存在商品失败:", searchError);
                    return null;
                }
            },

            // 下载商品（参考微信小程序 downLoadGoodsNx）
            async downLoadGoodsNx(eventData) {
                console.log("🚀 [downLoadGoodsNx] ========== 开始执行 ==========");
                console.log("📥 [downLoadGoodsNx] 接收到原始参数 eventData:", eventData);
                console.log("📥 [downLoadGoodsNx] eventData 类型:", typeof eventData);
                console.log("📥 [downLoadGoodsNx] eventData 是否为对象:", typeof eventData === 'object');
                console.log("📥 [downLoadGoodsNx] eventData 是否包含 goods:", eventData && 'goods' in eventData);

                // 处理事件数据：可能是一个对象 { goods, orderIndex } 或者是两个参数
                let goods, orderIndex;

                if (eventData && typeof eventData === 'object' && 'goods' in eventData) {
                    // 从事件对象中解构
                    ({goods, orderIndex} = eventData);
                    console.log("✅ [downLoadGoodsNx] 从事件对象中解构数据");
                } else {
                    // 兼容旧的两参数调用方式（向后兼容）
                    goods = eventData;
                    orderIndex = arguments[1];
                    console.log("✅ [downLoadGoodsNx] 使用兼容模式（两参数）");
                }

                console.log("📦 [downLoadGoodsNx] 解构后的 goods:", goods);
                console.log("📦 [downLoadGoodsNx] 解构后的 orderIndex:", orderIndex);
                console.log("📦 [downLoadGoodsNx] goods 的所有键:", goods ? Object.keys(goods) : 'goods 为空');

                if (!goods || !goods.nxGoodsId) {
                    console.error("❌ [downLoadGoodsNx] 商品数据错误: goods 或 goods.nxGoodsId 不存在");
                    console.error("❌ [downLoadGoodsNx] goods:", goods);
                    console.error("❌ [downLoadGoodsNx] goods.nxGoodsId:", goods?.nxGoodsId);
                    console.error("❌ [downLoadGoodsNx] 原始 eventData:", eventData);
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                if (orderIndex === undefined || orderIndex === null) {
                    console.error("❌ [downLoadGoodsNx] orderIndex 为 undefined 或 null");
                    console.error("❌ [downLoadGoodsNx] orderIndex:", orderIndex);
                    console.error("❌ [downLoadGoodsNx] 原始 eventData:", eventData);
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                try {
                    console.log("⏳ [downLoadGoodsNx] 开始执行下载流程...");
                    this.$store.commit('SET_LOADING', true);
                    this.selectedGoodsName = goods.nxGoodsName;
                    console.log("📝 [downLoadGoodsNx] 设置 selectedGoodsName:", goods.nxGoodsName);

                    // 根据当前 uploadType 确定 sourceType
                    // 注意：在 auto 模式下，orderIndex 是 filteredOrderItems 的索引
                    const sourceType = this.uploadType || 'excel';
                    this.currentSourceType = sourceType;
                    this.orderArrIndex = orderIndex;
                    console.log("🔧 [downLoadGoodsNx] sourceType:", sourceType);
                    console.log("🔧 [downLoadGoodsNx] orderArrIndex:", orderIndex);
                    console.log("🔧 [downLoadGoodsNx] uploadType:", this.uploadType);

                    // 构建下载商品的数据对象（参考小程序实现）
                    const dg = {
                        nxDgDistributerId: this.disUser.nxDiuDistributerId,
                        nxDgNxGoodsId: goods.nxGoodsId,
                        nxDgGoodsName: goods.nxGoodsName,
                        nxDgNxFatherId: goods.nxDgNxFatherId || goods.nxGoodsFatherId || null,
                        nxDgNxFatherImg: goods.nxDgNxFatherImg || goods.nxGoodsFatherImg || null,
                        nxDgNxFatherName: goods.nxDgNxFatherName || goods.nxGoodsFatherName || null,
                        nxDgGoodsDetail: goods.nxGoodsDetail || '',
                        nxDgGoodsPlace: goods.nxGoodsPlace || '',
                        nxDgGoodsBrand: goods.nxGoodsBrand || '',
                        nxDgGoodsStandardname: goods.nxGoodsStandardname || '',
                        nxDgGoodsStandardWeight: goods.nxGoodsStandardWeight || '',
                        nxDgGoodsPinyin: goods.nxGoodsPinyin || '',
                        nxDgGoodsPy: goods.nxGoodsPy || '',
                        nxDgPullOff: 0,
                        nxDgGoodsStatus: 0,
                        nxDgNxGoodsFatherColor: goods.nxDgNxGoodsFatherColor || goods.nxGoodsFatherColor || null,
                        nxDgPurchaseAuto: 1,
                        // 以下字段如果存在则添加
                        ...(goods.nxGoodsStandardEntities && {nxStandardEntities: goods.nxGoodsStandardEntities}),
                        ...(goods.nxAliasEntities && {nxAliasEntities: goods.nxAliasEntities}),
                    };

                    console.log("📤 [downLoadGoodsNx] 准备发送 API 请求，请求数据 dg:", dg);
                    console.log("📤 [downLoadGoodsNx] nxDgDistributerId:", dg.nxDgDistributerId);
                    console.log("📤 [downLoadGoodsNx] nxDgNxGoodsId:", dg.nxDgNxGoodsId);
                    console.log("📤 [downLoadGoodsNx] nxDgGoodsName:", dg.nxDgGoodsName);

                    const res = await api.downDisGoods(dg);

                    console.log("📥 [downLoadGoodsNx] API 响应:", res);
                    console.log("📥 [downLoadGoodsNx] res.data:", res?.data);
                    console.log("📥 [downLoadGoodsNx] res.data.code:", res?.data?.code);
                    console.log("📥 [downLoadGoodsNx] res.data.msg:", res?.data?.msg);

                    if (res && res.data && res.data.code === 0) {
                        // 下载成功：应用商品到订单
                        console.log("✅ [downLoadGoodsNx] 下载成功，应用商品到订单");
                        console.log("✅ [downLoadGoodsNx] 返回的商品ID:", res.data.data.nxDistributerGoodsId);
                        console.log("✅ [downLoadGoodsNx] 返回的商品名称:", res.data.data.nxDgGoodsName);
                        console.log("✅ [downLoadGoodsNx] 完整返回数据:", res.data.data);

                        // 判断是否是"之前插入订单"场景
                        const isBeforeOrderForm = this.addingOrderBeforeIndex === orderIndex;
                        console.log("🔍 [downLoadGoodsNx] 是否是之前插入订单场景:", isBeforeOrderForm);
                        console.log("🔍 [downLoadGoodsNx] addingOrderBeforeIndex:", this.addingOrderBeforeIndex);
                        console.log("🔍 [downLoadGoodsNx] orderIndex:", orderIndex);

                        if (isBeforeOrderForm) {
                            // "之前插入订单"场景：将下载的商品设置为 beforeOrderForm.selectedGoods
                            console.log("📝 [downLoadGoodsNx] 之前插入订单场景，设置 beforeOrderForm.selectedGoods");
                            const downloadedGoods = res.data.data;
                            this.beforeOrderForm.selectedGoods = downloadedGoods;
                            this.beforeOrderForm.goodsName = downloadedGoods.nxDgGoodsName || goods.nxGoodsName;
                            this.beforeOrderForm.showSearchResults = false;

                            // 设置规格信息
                            if (downloadedGoods.nxDgGoodsStandardname) {
                                this.beforeOrderForm.standard = downloadedGoods.nxDgGoodsStandardname;
                            } else if (goods.nxGoodsStandardname) {
                                this.beforeOrderForm.standard = goods.nxGoodsStandardname;
                            } else {
                                this.beforeOrderForm.standard = '';
                            }

                            console.log("✅ [downLoadGoodsNx] 商品已成功设置到之前插入订单表单");

                            // 下载商品后，如果数量和规格都有内容，则自动保存订单
                            const form = this.beforeOrderForm;
                            if (form.selectedGoods && form.quantity && form.quantity.toString().trim() && form.standard && form.standard.toString().trim()) {
                                console.log("🎯 [downLoadGoodsNx] 数量和规格都有内容，自动保存订单");
                                await this.saveBeforeOrder(this.orderItems[orderIndex], orderIndex, 'excel');
                            }
                        } else {
                            // 普通订单场景：使用原来的逻辑
                            await this._applyGoodsToOrder(
                                res.data.data.nxDistributerGoodsId,
                                res.data.data.nxDgGoodsName || goods.nxGoodsName,
                                orderIndex,
                                sourceType
                            );
                            console.log("✅ [downLoadGoodsNx] 商品已成功应用到订单");
                        }
                    } else {
                        const errorMsg = res?.data?.msg || '下载商品失败';
                        console.log("⚠️ [downLoadGoodsNx] API 返回非成功状态");
                        console.log("⚠️ [downLoadGoodsNx] 错误消息:", errorMsg);
                        console.log("⚠️ [downLoadGoodsNx] 错误码:", res?.data?.code);

                        // 如果商品已经下载，尝试搜索已存在的商品
                        if (errorMsg.includes('已经下载') || errorMsg.includes('已存在')) {
                            console.log("ℹ️ [downLoadGoodsNx] 商品已存在，尝试搜索已存在的商品...");
                            console.log("🔍 [downLoadGoodsNx] 搜索参数:", {
                                goodsName: goods.nxGoodsName,
                                goodsId: goods.nxGoodsId,
                                orderIndex,
                                sourceType
                            });

                            const foundGoods = await this._searchExistingGoods(goods, orderIndex, sourceType);
                            console.log("🔍 [downLoadGoodsNx] 搜索结果:", foundGoods);

                            if (foundGoods && foundGoods.nxDistributerGoodsId) {
                                // 找到已存在的商品：应用商品到订单
                                console.log("✅ [downLoadGoodsNx] 找到已存在的商品，应用商品到订单");
                                console.log("✅ [downLoadGoodsNx] 找到的商品ID:", foundGoods.nxDistributerGoodsId);
                                console.log("✅ [downLoadGoodsNx] 找到的商品名称:", foundGoods.nxDgGoodsName);

                                // 判断是否是"之前插入订单"场景
                                const isBeforeOrderForm = this.addingOrderBeforeIndex === orderIndex;
                                console.log("🔍 [downLoadGoodsNx] 是否是之前插入订单场景:", isBeforeOrderForm);

                                if (isBeforeOrderForm) {
                                    // "之前插入订单"场景：将找到的商品设置为 beforeOrderForm.selectedGoods
                                    console.log("📝 [downLoadGoodsNx] 之前插入订单场景，设置 beforeOrderForm.selectedGoods");
                                    this.beforeOrderForm.selectedGoods = foundGoods;
                                    this.beforeOrderForm.goodsName = foundGoods.nxDgGoodsName || goods.nxGoodsName;
                                    this.beforeOrderForm.showSearchResults = false;

                                    // 设置规格信息
                                    if (foundGoods.nxDgGoodsStandardname) {
                                        this.beforeOrderForm.standard = foundGoods.nxDgGoodsStandardname;
                                    } else if (goods.nxGoodsStandardname) {
                                        this.beforeOrderForm.standard = goods.nxGoodsStandardname;
                                    } else {
                                        this.beforeOrderForm.standard = '';
                                    }

                                    console.log("✅ [downLoadGoodsNx] 已存在商品已成功设置到之前插入订单表单");
                                } else {
                                    // 普通订单场景：使用原来的逻辑
                                    await this._applyGoodsToOrder(
                                        foundGoods.nxDistributerGoodsId,
                                        foundGoods.nxDgGoodsName || goods.nxGoodsName,
                                        orderIndex,
                                        sourceType
                                    );
                                    console.log("✅ [downLoadGoodsNx] 已存在商品已成功应用到订单");
                                }
                            } else {
                                // 搜索失败或没找到商品：触发搜索显示下拉框，让用户手动选择
                                console.log("ℹ️ [downLoadGoodsNx] 未找到已存在的商品，触发搜索显示下拉框");
                                console.log("🔍 [downLoadGoodsNx] 准备搜索商品名称:", goods.nxGoodsName);

                                // 触发搜索，显示搜索结果下拉框
                                await this.getSearchString(goods.nxGoodsName, sourceType);

                                // 提示用户可以从搜索结果中选择
                                console.log("💡 [downLoadGoodsNx] 已显示搜索结果，请从下拉框中选择商品");
                            }
                        } else {
                            // 其他错误，直接显示错误信息
                            console.error("❌ [downLoadGoodsNx] 下载失败:", errorMsg);
                            console.error("❌ [downLoadGoodsNx] 完整响应:", res);
                            await this.$refs.alertDialog.alert(errorMsg);
                        }
                    }
                } catch (error) {
                    console.error("❌ [downLoadGoodsNx] 下载商品失败，捕获到异常:");
                    console.error("❌ [downLoadGoodsNx] 错误对象:", error);
                    console.error("❌ [downLoadGoodsNx] 错误消息:", error.message);
                    console.error("❌ [downLoadGoodsNx] 错误堆栈:", error.stack);
                    await this.$refs.alertDialog.alert('下载商品失败: ' + (error.message || '未知错误'));
                } finally {
                    this.$store.commit('SET_LOADING', false);
                    console.log("🏁 [downLoadGoodsNx] ========== 执行完成 ==========");
                }
            },

            // 根据商品名称搜索商品（参考微信小程序 getSearchString）
            async getSearchString(searchValue, sourceType) {
                if (!searchValue || searchValue.length === 0) {
                    this.strArr = [];
                    this.nxArr = [];
                    this.orderArrIndex = -1;
                    return;
                }

                try {
                    this.$store.commit('SET_LOADING', true);
                    this.searchStr = searchValue;

                    const data = {
                        disId: this.disUser.nxDiuDistributerId,
                        searchStr: searchValue,
                        depId: this.selectedSubDepartment || this.selectedAllCustomer,
                    };

                    const res = await api.queryDisGoodsByQuickSearchWithDepId(data);

                    if (res && res.data && res.data.code === 0) {
                        this.strArr = res.data.data.disArr || [];
                        this.nxArr = res.data.data.nxArr || [];

                        // 根据来源类型更新对应的订单列表
                        let currentOrderItems;
                        let actualOrderIndex = this.orderArrIndex;

                        if (sourceType === 'paste') {
                            currentOrderItems = this.orderItems;
                        } else if (sourceType === 'auto' && this.uploadType === 'auto') {
                            // auto 模式下，orderArrIndex 是 filteredOrderItems 的索引
                            const filteredItems = this.filteredOrderItems;
                            if (this.orderArrIndex >= 0 && this.orderArrIndex < filteredItems.length) {
                                const filteredOrder = filteredItems[this.orderArrIndex];
                                // 找到在 orderItems 中的实际索引
                                actualOrderIndex = this.orderItems.findIndex(item => item === filteredOrder);
                                if (actualOrderIndex >= 0) {
                                    currentOrderItems = this.orderItems;
                                } else {
                                    currentOrderItems = null;
                                }
                            } else {
                                currentOrderItems = null;
                            }
                        } else {
                            currentOrderItems = this.orderItems;
                        }

                        if (currentOrderItems && actualOrderIndex >= 0 && actualOrderIndex < currentOrderItems.length) {
                            const currentOrder = currentOrderItems[actualOrderIndex];
                            // 合并搜索结果到订单项
                            currentOrder.nxDistributerGoodsEntityList = this.strArr || [];
                            currentOrder.nxGoodsEntities = this.nxArr || [];
                        }


                        // 强制更新视图，确保搜索结果下拉框显示
                        this.$nextTick(() => {
                            // 视图已更新
                        });
                    } else {
                        this.strArr = [];
                        this.nxArr = [];

                        const errorMsg = res?.data?.msg || '';
                        if (errorMsg) {
                            if (errorMsg.includes('请继续输入')) {
                                this.showToast('搜索结果太多，请继续输入内容，缩小查询范围', 'warning');
                            } else {
                                this.showToast(errorMsg || '搜索失败', 'error');
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ [getSearchString] 搜索商品异常:', error);
                    this.strArr = [];
                    this.nxArr = [];
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            async _choiceGoods() {
                const index = this.orderArrIndex;
                let sourceType = this.currentSourceType || this.uploadType || 'excel';


                // 根据来源类型获取对应的订单列表
                // 对于 auto 模式，如果当前是转订单模式，需要使用 filteredOrderItems
                let currentOrderItems;
                let actualIndex = index; // 在 orderItems 中的实际索引


                if (sourceType === 'paste' || sourceType === 'excel-paste') {
                    currentOrderItems = this.orderItems;
                } else if (sourceType === 'auto' && this.uploadType === 'auto') {
                    // auto 模式下，index 是 filteredOrderItems 的索引
                    // 需要先获取 filteredOrderItems，然后找到在 orderItems 中的实际索引
                    const filteredItems = this.filteredOrderItems;
                    const order = filteredItems[index];
                    actualIndex = this.orderItems.findIndex(item => item === order);

                    currentOrderItems = this.orderItems;
                } else {
                    currentOrderItems = this.orderItems;
                    actualIndex = index;
                }

                const order = currentOrderItems[actualIndex];
                const selectedGoodsName = this.selectedGoodsName || order.nxDoGoodsName || '';
                // 准备发送的订单对象
                const orderToSend = {
                    ...order,
                    nxDoGoodsName: selectedGoodsName,
                    nxDoDisGoodsId: this.goodsId,
                };

                try {
                    this.$store.commit('SET_LOADING', true);

                    const res = await api.choiceGoodsForApply(orderToSend);

                    if (res && res.data && res.data.code === 0) {
                        const updatedTask = res.data.task;

                        if (updatedTask && updatedTask.nxOcrTaskStatus === 2) {
                            this.stopAllReading(); // 立即停止朗读，弹窗显示前就停
                            this.showTaskCompleteModal = true;
                            this.taskCompleteModalTaskId = updatedTask.nxOcrTaskId;
                            this.taskCompleteModalSourceType = sourceType;
                            this.taskCompleteModalTask = updatedTask;
                        }
                        if (updatedTask && this.currentTaskId != null && updatedTask.nxOcrTaskId === this.currentTaskId) {
                            this.currentTask = {...this.currentTask, ...updatedTask};
                        }
                        if (updatedTask && Array.isArray(this.taskListFromParent)) {
                            const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === updatedTask.nxOcrTaskId);
                            if (idx >= 0) {
                                this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                    i === idx ? {...t, ...updatedTask} : t
                                );
                            }
                        }
                        // 合并原有订单对象的所有字段 + 后端返回的字段
                        const currentOrderBeforeUpdate = currentOrderItems[actualIndex];
                        const updatedOrder = {
                            ...currentOrderBeforeUpdate,
                            ...res.data.data,
                            nxDoGoodsName: selectedGoodsName,
                            nxDoGoodsNameOriginal: currentOrderBeforeUpdate?.nxDoGoodsNameOriginal || selectedGoodsName
                        };

                        // 检查更新后的订单是否有 nxDepartmentOrdersId（已保存的订单）
                        // 如果已保存，需要检查是否已经存在相同 ID 的订单，避免重复
                        if (updatedOrder.nxDepartmentOrdersId) {
                            // 查找是否已经存在相同 nxDepartmentOrdersId 的订单
                            const existingIndex = currentOrderItems.findIndex(
                                (item, idx) => idx !== actualIndex &&
                                    item.nxDepartmentOrdersId === updatedOrder.nxDepartmentOrdersId
                            );

                            if (existingIndex >= 0) {

                                currentOrderItems.splice(actualIndex, 1);
                            } else {
                                // 如果不存在重复，直接更新（使用 Object.assign 确保响应式更新）
                                Object.assign(currentOrderItems[actualIndex], updatedOrder);

                            }
                        }
                        // 重置搜索和匹配商品列表状态（选择商品后关闭所有列表）
                        this.resetSearchAndMatchedGoodsState();
                    } else {
                        await this.$refs.alertDialog.alert(res?.data?.msg || '保存失败');
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    await this.$refs.alertDialog.alert('', 'warning');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 更新单个订单到缓存
            _updateStorage(order, orderIndex) {
                // 使用传入的 orderIndex，如果没有则使用 orderArrIndex
                const index = orderIndex !== undefined ? orderIndex : this.orderArrIndex;

                console.log('💾 [_updateStorage] 开始更新存储:', {
                    index,
                    orderIndex,
                    orderArrIndex: this.orderArrIndex,
                    orderItemsLength: this.orderItems.length,
                    order: order
                });

                // 检查索引是否有效
                if (index === undefined || index === null || index < 0) {
                    console.error('❌ [_updateStorage] 订单索引无效，无法更新存储:', index);
                    return;
                }

                // 检查索引是否越界
                if (index >= this.orderItems.length) {
                    console.error('❌ [_updateStorage] 订单索引越界，无法更新存储:', {
                        index,
                        orderItemsLength: this.orderItems.length
                    });
                    return;
                }

                // 更新内存中的 orderItems（如果订单还在原位置）
                if (this.orderItems[index]) {
                    // 使用 Object.assign 更新现有对象的属性，确保 Vue 响应式系统能检测到变化
                    const beforeUpdate = {...this.orderItems[index]};
                    Object.assign(this.orderItems[index], order);
                    console.log('✅ [_updateStorage] 订单已更新:', {
                        index,
                        beforeUpdate,
                        afterUpdate: {...this.orderItems[index]}
                    });
                } else {
                    console.warn('⚠️ [_updateStorage] 订单不存在，索引:', index);
                }

            },

            // 检查订单内容：商品名称必有、数量必为有效数字、规格必为汉字且汉字数量不大于 2 个
            // 通过时返回 true，失败时返回失败条目的 0-based 索引（便于父组件滚动并高亮该条）
            async checkOrderContent(orderArr = null) {
                const orders = orderArr || this.orderItems;

                if (!orders || orders.length === 0) {
                    await this.$refs.alertDialog.alert('没有可保存的订单', 'warning');
                    return -1;
                }

                for (let i = 0; i < orders.length; i++) {
                    const order = orders[i];
                    const rowNum = i + 1;

                    // 商品名称必须有
                    if (!order.nxDoGoodsName || order.nxDoGoodsName.trim() === '') {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单商品名称为空`, 'warning');
                        return i;
                    }

                    // 数量必须有且必须是有效数字且大于 0
                    const qty = order.nxDoQuantity;
                    if (qty === undefined || qty === null || String(qty).trim() === '') {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单数量为空`, 'warning');
                        return i;
                    }
                    const qtyNum = Number(qty);
                    if (Number.isNaN(qtyNum)) {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单数量必须是数字`, 'warning');
                        return i;
                    }
                    if (qtyNum <= 0) {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单数量必须大于 0`, 'warning');
                        return i;
                    }

                    // 规格必须有
                    if (!order.nxDoStandard || order.nxDoStandard.trim() === '') {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单规格为空`, 'warning');
                        return i;
                    }

                    const spec = order.nxDoStandard.trim();
                    // 规格必须是汉字（仅允许中文字符）
                    const chineseOnly = /^[\u4e00-\u9fff]+$/;
                    if (!chineseOnly.test(spec)) {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单规格必须为汉字`, 'warning');
                        return i;
                    }
                    // 规格汉字数量不大于 2 个
                    if (spec.length > 2) {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单规格汉字数量不能大于 2 个，当前为 ${spec.length} 个`, 'warning');
                        return i;
                    }

                }

                return true;
            },

            // 保存复制粘贴的订单（独立方法）
            async pastSavePasteOrders() {
                if (this.savingOrder) return;
                const checkResult = await this.checkOrderContent(this.orderItems);
                if (checkResult !== true) {
                    this.draftSelectedOrderIndex = checkResult >= 0 ? checkResult : -1;
                    return;
                }
                this.draftSelectedOrderIndex = -1;
                this.savingOrder = true;
                try {
                    this.$store.commit('SET_LOADING', true);

                    // 确定要使用的部门ID（优先使用子部门ID）
                    const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                    // 准备订单数据（格式与内容已由 checkOrderContent方法 校验：商品名称、数量为数字、规格为汉字且不超过 2 个字）
                    const originalOrderArr = [...this.orderItems];
                    const orderData = this.orderItems.map(item => ({
                        ...item,
                        nxDoDepartmentId: targetDepId,
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoDistributerId: this.disUser.nxDiuDistributerId,
                        nxDoIsAgent: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
                    }));

                    const res = await api.pasteSearchGoods({
                        orderList: orderData,
                        pasteText: this.pasteInputText || '',
                        type: 3,
                    });

                    if (res && res.data && res.data.code === 0) {
                        const taskId = res.data.taskId;
                        const task = res.data.task;
                        this.orderItems = res.data.data;
                        if (taskId != null && task) {
                            this.currentTaskId = taskId;
                            this.currentTask = task;
                            // 保存成功后，订单已保存，应显示 OrderList（pasteSaveCount 为数字表示已保存）
                            this.pasteSaveCount = this.orderItems.length > 0 ? this.orderItems.length : null;

                            if (task.nxOcrTaskStatus === 2) {
                                this.stopAllReading(); // 立即停止朗读，弹窗显示前就停
                                this.showTaskCompleteModal = true;
                                this.taskCompleteModalTaskId = taskId;
                                this.taskCompleteModalSourceType = 'paste';
                                this.taskCompleteModalTask = task;
                            }

                            this.$nextTick(() => {
                                if (this.$refs.pasteUploadRef && this.$refs.pasteUploadRef.addOrUpdateTaskAndSelect) {
                                    this.$refs.pasteUploadRef.addOrUpdateTaskAndSelect(task);
                                }
                            });
                        }

                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                        this.$emit('task-added');
                    } else {
                        const errorMsg = res?.data?.msg || '保存失败';
                        await this.$refs.alertDialog.alert(errorMsg, 'error');
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    await this.$refs.alertDialog.alert('保存订单失败，请重试：' + (error.message || '未知错误'), 'error');
                } finally {
                    this.savingOrder = false;
                    this.$store.commit('SET_LOADING', false);
                }
            },

            /** 将 nxOcrTaskOcrText 中的 CSV 解析为表格行数组（与 excelPasteTableData 结构一致），不足 50 行用空行补齐 */
            parseCsvToExcelPasteTableData(csvText) {
                const columns = ['goodsName', 'quantity', 'specification', 'specificationWeight', 'cartonQuantity', 'cartonName', 'remark'];
                const emptyRow = () => ({
                    goodsName: '',
                    quantity: '',
                    specification: '',
                    specificationWeight: '',
                    cartonQuantity: '',
                    cartonName: '',
                    remark: ''
                });
                if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
                    return Array.from({length: 50}, emptyRow);
                }
                const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
                if (lines.length < 2) return Array.from({length: 50}, emptyRow); // 只有表头或无数据
                const dataLines = lines.slice(1); // 跳过表头
                const parseCsvLine = (line) => {
                    const out = [];
                    let i = 0;
                    while (i < line.length) {
                        if (line[i] === '"') {
                            let cell = '';
                            i++;
                            while (i < line.length && (line[i] !== '"' || line[i + 1] === '"')) {
                                cell += line[i] === '"' && line[i + 1] === '"' ? '"' : line[i];
                                i++;
                            }
                            if (line[i] === '"') i++;
                            out.push(cell);
                            if (line[i] === ',') i++;
                        } else {
                            const j = line.indexOf(',', i);
                            const end = j === -1 ? line.length : j;
                            out.push(line.slice(i, end).trim());
                            i = j === -1 ? line.length : j + 1;
                        }
                    }
                    return out;
                };
                const rows = dataLines.map(line => {
                    const cells = parseCsvLine(line);
                    const row = emptyRow();
                    columns.forEach((col, idx) => {
                        row[col] = cells[idx] != null ? String(cells[idx]).trim() : '';
                    });
                    return row;
                });
                const total = 50;
                while (rows.length < total) rows.push(emptyRow());
                return rows.slice(0, total);
            },

            /** 将 Excel 粘贴表格转为 CSV 字符串，供后端存入 nxOcrTaskOcrText，任务页可还原表格 */
            excelPasteTableDataToCsv() {
                const columns = ['goodsName', 'quantity', 'specification', 'specificationWeight', 'cartonQuantity', 'cartonName', 'remark'];
                const headers = ['商品名称', '数量', '规格', '规格重量', '大包装数量', '大包装名称', '备注'];
                const data = this.excelPasteTableData || [];
                const dataRows = data.filter(row => row.goodsName && String(row.goodsName).trim() !== '');
                if (dataRows.length === 0) return '';
                const csvLines = [headers.join(',')];
                dataRows.forEach(row => {
                    const values = columns.map(col => {
                        let value = row[col] ?? '';
                        if (String(value).includes(',') || String(value).includes('"') || String(value).includes('\n')) {
                            value = '"' + String(value).replace(/"/g, '""') + '"';
                        }
                        return value;
                    });
                    csvLines.push(values.join(','));
                });
                return csvLines.join('\n');
            },

            // 保存 Excel 粘贴订单
            async saveExcelPasteOrders() {
                const checkResult = await this.checkOrderContent(this.orderItems);
                if (checkResult !== true) {
                    this.draftSelectedOrderIndex = checkResult >= 0 ? checkResult : -1;
                    return;
                }
                this.draftSelectedOrderIndex = -1;

                try {
                    this.savingOrder = true;
                    this.$store.commit('SET_LOADING', true);

                    // 确定要使用的部门ID（优先使用子部门ID）
                    const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                    // 准备订单数据，确保包含必要的字段
                    const originalOrderArr = [...this.orderItems];
                    const orderData = this.orderItems.map(item => ({
                        ...item,
                        nxDoDepartmentId: targetDepId,
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoDistributerId: this.disUser.nxDiuDistributerId,
                        nxDoIsAgent: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
                    }));

                    // 表格转 CSV 存入 nxOcrTaskOcrText，任务页可据此还原表格
                    const tableCsv = this.excelPasteTableDataToCsv();
                    const res = await api.pasteSearchGoods({
                        orderList: orderData,
                        pasteText: tableCsv || '',
                        type: 2
                    });

                    if (res && res.data && res.data.code === 0) {
                        const taskId = res.data.taskId;
                        const task = res.data.task;
                        this.orderItems = res.data.data;
                        if (taskId != null && task) {
                            this.currentTaskId = taskId;
                            this.currentTask = task;
                            this.excelPasteSaveCount = this.orderItems.length > 0 ? this.orderItems.length : null;

                            if (task.nxOcrTaskStatus === 2) {
                                this.stopAllReading(); // 立即停止朗读，弹窗显示前就停
                                this.showTaskCompleteModal = true;
                                this.taskCompleteModalTaskId = taskId;
                                this.taskCompleteModalSourceType = 'excel-paste';
                                this.taskCompleteModalTask = task;
                            }

                            this.$nextTick(() => {
                                if (this.$refs.excelPasteUploadRef && this.$refs.excelPasteUploadRef.addOrUpdateTaskAndSelect) {
                                    this.$refs.excelPasteUploadRef.addOrUpdateTaskAndSelect(task);
                                }
                            });
                        }
                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                        this.$emit('task-added');
                    } else {
                        const errorMsg = res?.data?.msg || '保存失败';
                        await this.$refs.alertDialog.alert(errorMsg, 'error');
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    await this.$refs.alertDialog.alert('保存订单失败，请重试：' + (error.message || '未知错误'), 'error');
                } finally {
                    this.savingOrder = false;
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 清除复制粘贴的草稿
            async clearPasteSave() {


                const confirmed = await this.$refs.alertDialog.confirm('确定要清除所有草稿吗？');
                if (!confirmed) {
                    console.log('❌ [clearPasteSave] 用户取消清除操作');
                    return;
                }

                // 将"已处理"文件夹中的文件移动到"已完成"文件夹
                let folderPath = this.customerFolderPath;

                // 如果文件夹路径为空，尝试重新加载（特别是对于 auto 模式）
                if (!folderPath && this.uploadType === 'auto' && this.selectedAllCustomer) {
                    console.log('📂 [clearPasteSave] 文件夹路径为空，尝试重新加载');
                    try {
                        await this.loadCustomerFolderPath();
                        folderPath = this.customerFolderPath;
                        console.log('   - 重新加载后的文件夹路径:', folderPath);
                    } catch (error) {
                        console.error('❌ [clearPasteSave] 重新加载文件夹路径失败:', error);
                    }
                }


                this.orderItems = [];
                this.pasteInputText = '';
                this.pasteInputContent = '';
                this.pasteSaveCount = null;
                this.pasteInvalidLineIndices = [];
                this.pasteInvalidSegments = [];
                this.pasteNoValidOrder = false;

                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

            },

            /** 按上传类型清空本地订单、文件等状态 */
            clearLocalByUploadType(sourceType) {
                const st = sourceType || this.uploadType || 'image';
                if (st === 'paste') {
                    this.orderItems = [];
                    this.pasteInputText = '';
                    this.pasteInputContent = '';
                    this.pasteOriginText = '';
                    this.pasteSaveCount = null;
                    this.pasteInvalidLineIndices = [];
                    this.pasteInvalidSegments = [];
                    this.pasteNoValidOrder = false;
                } else if (st === 'excel-paste') {
                    this.orderItems = [];
                    this.excelPasteSaveCount = null;
                    this.excelPasteTableData = Array.from({length: 50}, () => ({
                        goodsName: '', quantity: '', specification: '', specificationWeight: '',
                        cartonQuantity: '', cartonName: '', remark: ''
                    }));
                    this.excelPasteRawData = [];
                } else {
                    this.orderItems = [];
                    if (st === 'image') {
                        this.uploadedImageFile = null;
                        this.imagePreview = null;
                        this.stopAllReading();
                        if (this.$refs.imageFileInput) this.$refs.imageFileInput.value = '';
                    } else if (st === 'excel') {
                        this.uploadedExcelFile = null;
                        this.uploadedExcelPreview = null;
                        if (this.$refs.excelFileInput) this.$refs.excelFileInput.value = '';
                    } else if (st === 'auto') {
                        this.uploadedImageFile = null;
                        this.uploadedExcelFile = null;
                        this.uploadedExcelPreview = null;
                        this.customerFolderPath = null;
                        this.autoProcessFiles = [];
                        this.autoProcessImagePreviews = {};
                        this.autoProcessExcelPreviews = {};
                        this.activeProcessedFileTab = null;
                        this.autoProcessImagePreview = null;
                        this.autoProcessImagePreviewFileName = '';
                        this.autoProcessResults = [];
                    }
                }
                this.resetSearchAndMatchedGoodsState();
            },

            /** 刷新当前上传类型的任务列表 */
            refreshTaskList(sourceType) {
                this.$nextTick(() => {
                    if (sourceType === 'paste' && this.$refs.pasteUploadRef?.loadTaskList) {
                        this.$refs.pasteUploadRef.loadTaskList();
                    } else if (sourceType === 'excel-paste' && this.$refs.excelPasteUploadRef?.loadTaskList) {
                        this.$refs.excelPasteUploadRef.loadTaskList();
                    } else if (sourceType === 'image' && this.$refs.imageUploadRef?.loadTaskList) {
                        const taskType = this.currentTask?.nxOcrTaskType != null ? this.currentTask.nxOcrTaskType : 1;
                        this.$refs.imageUploadRef.loadTaskList(null, {type: taskType});
                    }
                });
            },

            // 重新上传：删除任务并清空本地（所有模式统一使用 deleteTaskData）
            async reUpload() {
                if (!this.selectedAllCustomer) {
                    await this.$refs.alertDialog.alert('请先选择客户', 'warning');
                    return;
                }
                const sourceType = this.uploadType || 'image';
                const uploadTypeName = sourceType === 'manual' ? '手动录入' : sourceType === 'paste' ? '复制粘贴' : sourceType === 'excel-paste' ? 'Excel粘贴' :
                    sourceType === 'excel' ? 'Excel上传' : sourceType === 'auto' ? '转订单' : '图片上传';
                const confirmMsg = this.currentTaskId != null
                    ? `确定要删除该任务并重新${uploadTypeName}吗？`
                    : `确定要清空当前显示并重新${uploadTypeName}吗？`;
                const confirmed = await this.$refs.alertDialog.confirm(confirmMsg);
                if (!confirmed) return;

                try {
                    this.$store.commit('SET_LOADING', true);
                    if (this.currentTaskId != null) {
                        const res = await api.deleteTaskData(this.currentTaskId);
                        if (!res || !res.data || res.data.code !== 0) {
                            await this.$refs.alertDialog.alert(res?.data?.msg || res?.data?.message || '删除失败', 'error');
                            return;
                        }
                    }

                    this.$emit('task-added');
                    this.clearLocalByUploadType(sourceType);
                    this.currentTaskId = null;
                    this.currentTask = null;
                    if (sourceType === 'auto' && this.customerFolderPath && window.electronAPI?.moveProcessedToParent) {
                        try {
                            await window.electronAPI.moveProcessedToParent(this.customerFolderPath);
                        } catch (e) {
                            console.error('[reUpload] 移动文件失败:', e);
                        }
                        if (this.selectedAllCustomer) {
                            try {
                                await this.loadCustomerFolderPath();
                            } catch (e) {
                                console.error('[reUpload] 重新加载文件夹失败:', e);
                            }
                        }
                    }
                    this.refreshTaskList(sourceType);
                    this.$emit('order-updated');
                } catch (e) {
                    console.error('[reUpload] 失败:', e);
                    await this.$refs.alertDialog.alert('删除失败：' + (e.message || '请检查网络'), 'error');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },


            // ---------- 统一 TTS 逻辑（paste / image / excelPaste / excel 共用） ----------
            // 扩展 excel / excelPaste 朗读：在对应 OrderList 上 @tts-state="(p) => onTTSState('excelPaste', p)" 等，
            // 传 :tts-playing="getTTSState('excelPaste').isTTSPlaying" 及 @read-order-list="() => handleReadOrderList('excelPaste')" 等即可。
            /** 各模式 TTS 状态，mode: 'paste' | 'image' | 'excelPaste' | 'excel' */
            getTTSState(mode) {
                const state = this.ttsStateByMode[mode];
                return state || {isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1};
            },
            /** 按模式取 OrderList 的 ref，便于统一调用 readOrderList / pauseReading 等 */
            getOrderListRef(mode) {
                const refMap = {
                    paste: 'pasteOrderListRef',
                    image: 'imageOrderListRef',
                    excelPaste: 'excelPasteOrderListRef',
                    excel: 'excelOrderListRef',
                    auto: 'autoOrderListRef'
                };
                const refName = refMap[mode];
                return refName ? this.$refs[refName] : null;
            },
            /** 统一：接收某模式的 TTS 状态（OrderList 通过 @tts-state 上报） */
            onTTSState(mode, payload) {
                if (!this.ttsStateByMode[mode]) return;
                this.ttsStateByMode[mode] = {
                    isTTSPlaying: !!payload.isTTSPlaying,
                    isTTSLoading: !!payload.isTTSLoading,
                    stoppedIndex: payload.stoppedIndex != null ? payload.stoppedIndex : -1
                };
            },
            /** 统一：开始朗读 */
            handleReadOrderList(mode) {
                const ref = this.getOrderListRef(mode);
                if (ref && ref.readOrderList) ref.readOrderList();
            },
            /** 统一：暂停朗读 */
            handlePauseReading(mode) {
                const ref = this.getOrderListRef(mode);
                if (ref && ref.pauseReading) ref.pauseReading();
            },
            /** 统一：重读（从暂停处重播） */
            handleRestartReading(mode) {
                this.showMatchedGoods = {}; // 关闭已展开的推荐商品
                const ref = this.getOrderListRef(mode);
                if (ref && ref.restartReading) ref.restartReading();
            },
            /** 统一：停止朗读 */
            handleStopReading(mode) {
                const ref = this.getOrderListRef(mode);
                if (ref && ref.stopReading) {
                    const stoppedIndex = ref.stopReading();
                    console.log('[PlaceOrder] 已停止朗读，模式:', mode, '停止的序号:', stoppedIndex);
                }
            },
            /** 统一：继续朗读 */
            handleContinueReading(mode) {
                const ref = this.getOrderListRef(mode);
                if (ref && ref.continueReading) ref.continueReading();
            },

            // 获取当前朗读的订单文本（图片模式用，其他模式可传 mode 扩展）
            getCurrentReadingText(mode = 'image') {
                const ref = this.getOrderListRef(mode);
                return (ref && ref.currentReadingText) ? ref.currentReadingText : '';
            },
            // 获取当前朗读的订单索引
            getCurrentReadingIndex(mode = 'image') {
                const ref = this.getOrderListRef(mode);
                return (ref && ref.currentReadingIndex !== undefined) ? ref.currentReadingIndex : -1;
            },

            // 处理从弹窗修改订单
            handleEditOrderFromPopup(data) {
                console.log('[PlaceOrder] 从弹窗修改订单，数据:', data);
                const {item, index} = data;

                if (!item) {
                    console.error('[PlaceOrder] 订单项为空，无法修改');
                    return;
                }

                console.log('[PlaceOrder] 订单项详情:', {
                    nxDepartmentOrdersId: item.nxDepartmentOrdersId,
                    nxDoGoodsName: item.nxDoGoodsName,
                    nxDoQuantity: item.nxDoQuantity,
                    nxDoStandard: item.nxDoStandard
                });

                // 调用修改订单方法（使用 image 模式）
                this.handleUpdateOrder(item, index, 'image');
            },


            // // 处理AI再次解析（从订单中获取taskId或使用图片模式）
            // async handleAiParseAgain() {
            //     if (!this.selectedAllCustomer) {
            //         await this.$refs.alertDialog.alert('', 'warning');
            //         return;
            //     }
            //
            //     const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
            //
            //     // 优先从订单中获取 taskId（nxDoOcrTaskId）
            //     let taskId = null;
            //
            //     // 从订单列表中查找第一个有 nxDoOcrTaskId 的订单
            //     if (this.orderItems && this.orderItems.length > 0) {
            //         const orderWithTaskId = this.orderItems.find(order => order.nxDoOcrTaskId);
            //         if (orderWithTaskId && orderWithTaskId.nxDoOcrTaskId) {
            //             taskId = orderWithTaskId.nxDoOcrTaskId;
            //         }
            //     }
            //
            //     // 如果订单中没有，尝试从已完成的任务中获取
            //     if (!taskId) {
            //         const allTasks = taskQueue.getAllTasks();
            //         const completedTask = allTasks.find(t =>
            //             String(t.depId) === String(targetDepId) &&
            //             t.status === taskQueue.TASK_STATUS.COMPLETED &&
            //             t.type === taskQueue.TASK_TYPE.IMAGE
            //         );
            //
            //         if (completedTask) {
            //             taskId = completedTask.taskId;
            //         }
            //     }
            //
            //
            //
            //     // 设置识别中状态
            //     this.hasRunningTask = true;
            //     this.recognizingImage = true;
            //
            //     try {
            //         let requestData;
            //
            //         if (taskId) {
            //             // 模式1：使用 taskId
            //             console.log('🤖 [handleAiParseAgain] 调用AI识别接口（模式1：taskId模式）', {taskId});
            //             requestData = {
            //                 taskId: taskId
            //             };
            //         } else {
            //             // 模式2：使用图片（需要图片base64）
            //             if (!this.imagePreview) {
            //                 await this.$refs.alertDialog.alert('', 'warning');
            //                 return;
            //             }
            //
            //             // 将图片DataURL转换为Base64
            //             const imageBase64 = this.imagePreview.includes(',')
            //                 ? this.imagePreview.split(',')[1]
            //                 : this.imagePreview;
            //
            //             requestData = {
            //                 ImageBase64: imageBase64,
            //                 depId: targetDepId,
            //                 depFatherId: this.selectedAllCustomer,
            //                 disId: this.disUser?.nxDiuDistributerId,
            //                 userId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId
            //             };
            //         }
            //
            //         const res = await api.recognizeOrderOCRWithAi(requestData, {showLoading: false});
            //
            //         if (res && res.data && res.data.code === 0) {
            //             // 检查后端是否已经保存了订单
            //             if (Array.isArray(res.data.data) && res.data.data.length > 0) {
            //                 this.orderItems = res.data.data;
            //             } else {
            //                 // 检查后端是否返回了解析后的商品列表
            //                 const items = res.data.items || (res.data.data && res.data.data.items);
            //                 if (items && items.length > 0) {
            //                     this.orderItems = items;
            //                 } else {
            //                     this.orderItems = [];
            //                 }
            //             }
            //         } else {
            //             const errorMsg = res?.data?.msg || res?.data?.message || 'AI识别失败';
            //             await this.$refs.alertDialog.alert(errorMsg);
            //         }
            //     } catch (error) {
            //         await this.$refs.alertDialog.alert('AI识别失败：' + (error.message || '未知错误'));
            //     } finally {
            //         // 清除识别中状态
            //         this.hasRunningTask = false;
            //         this.recognizingImage = false;
            //     }
            // },

            async handleImageUpload(event) {
                const file = event.target?.files?.[0];
                if (!file) return;

                // 验证文件类型
                if (!file.type.startsWith('image/')) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 验证文件大小（限制10MB）
                if (file.size > 10 * 1024 * 1024) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                if (!this.selectedAllCustomer) {
                    console.warn('[PlaceOrder] handleImageUpload 未选择客户，已拦截');
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 检查是否选择了子部门（如果有子部门的话）
                if (!(await this.checkSubDepartmentSelected())) {
                    // 清空文件输入
                    if (this.$refs.imageFileInput) {
                        this.$refs.imageFileInput.value = '';
                    }
                    return;
                }

                // 保存原始文件（用于裁剪）
                this.originalImageFile = file;

                // 保存上传的文件信息（用于缓存和显示）
                this.uploadedImageFile = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                };

                // 创建预览并打开弹窗
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.previewImageDataUrl = e.target.result;
                    // 保存预览数据到文件信息中
                    if (this.uploadedImageFile) {
                        this.uploadedImageFile.dataUrl = e.target.result;
                    }

                    // 重置图片变换和裁剪模式（确保图片完整显示）
                    this.imageScale = 1;
                    this.imageTranslateX = 0;
                    this.imageTranslateY = 0;
                    this.showCropMode = false;

                    // 打开预览弹窗
                    this.showImagePreviewModal = true;

                    // 图片加载完成后，初始化裁剪框位置和大小
                    this.$nextTick(() => {
                        const img = new Image();
                        img.onload = () => {
                            this.$nextTick(() => {
                                const imgElement = this.$refs.previewImageModal;
                                if (imgElement) {
                                    const imgRect = imgElement.getBoundingClientRect();
                                    const imgDisplayWidth = imgRect.width;
                                    const imgDisplayHeight = imgRect.height;

                                    // 裁剪框默认大小为图片显示尺寸的80%
                                    this.cropBox.width = Math.max(100, imgDisplayWidth * 0.8);
                                    this.cropBox.height = Math.max(100, imgDisplayHeight * 0.8);
                                    // 居中显示
                                    this.cropBox.x = (imgDisplayWidth - this.cropBox.width) / 2;
                                    this.cropBox.y = (imgDisplayHeight - this.cropBox.height) / 2;
                                }
                            });
                        };
                        img.src = e.target.result;
                    });
                };
                reader.readAsDataURL(file);
            },

            // 关闭图片预览弹窗
            closeImagePreviewModal() {
                this.showImagePreviewModal = false;
                // 延后清空 src，避免弹窗尚未卸载时传入 null 触发 Vue prop 警告
                this.$nextTick(() => {
                    this.previewImageDataUrl = null;
                });
                // 清空文件输入
                if (this.$refs.imageFileInput) {
                    this.$refs.imageFileInput.value = '';
                }
            },

            // 处理直接识别（不裁剪）- 直接调单列接口，不走任务队列
            async handleDirectRecognize(imageDataUrl) {
                this.closeImagePreviewModal();
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;
                if (!targetDepId || !this.disUser) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                this.imagePreview = imageDataUrl;
                this.uploadedImageFile = {
                    name: '单列识别',
                    size: 0,
                    type: 'image/jpeg',
                    dataUrl: imageDataUrl
                };
                const imageBase64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;
                const ocrData = {
                    ImageBase64: imageBase64,
                    depId: targetDepId,
                    depFatherId: this.selectedAllCustomer,
                    disId: this.disUser.nxDiuDistributerId,
                    userId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
                };
                try {
                    const res = await api.recognizeOrderOCR(ocrData);
                    if (res && res.data && res.data.code === 0) {
                        const taskId = res.data.taskId;
                        const task = res.data.task;
                        this.currentTaskId = taskId;
                        this.currentTask = task;
                        this.orderItems = res.data.items;
                        // fast 模式：刷新任务列表并默认选中本次返回的任务
                        if (taskId != null && task && this.uploadType === 'image') {
                            this.$nextTick(() => {
                                if (this.$refs.imageUploadRef && typeof this.$refs.imageUploadRef.loadTaskList === 'function') {
                                    const taskType = task.nxOcrTaskType != null ? task.nxOcrTaskType : 1;
                                    this.$refs.imageUploadRef.loadTaskList(taskId, {type: taskType});
                                }
                            });
                        }
                    } else {
                        const msg = res?.data?.msg || res?.data?.message || '识别失败';
                        await this.$refs.alertDialog.alert(msg);
                    }
                } catch (err) {
                    await this.$refs.alertDialog.alert(err?.message || '单列识别失败，请重试');
                }
            },

            // 点击「添加新图片」：先保存当前状态，再清空显示上传区
            handleImageAddNew() {
                if (this.currentTaskId != null || (this.orderItems && this.orderItems.length > 0)) {
                    this.imageLastState = {
                        currentTaskId: this.currentTaskId,
                        currentTask: this.currentTask,
                        orderItems: (this.orderItems || []).slice(),
                        uploadedImageFile: this.uploadedImageFile,
                        imagePreview: this.imagePreview,
                        imageScale: this.imageScale,
                        imageTranslateX: this.imageTranslateX,
                        imageTranslateY: this.imageTranslateY
                    };
                }
                this.currentTaskId = null;
                this.currentTask = null;
                this.orderItems = [];
                this.uploadedImageFile = null;
                this.imagePreview = null;
                this.imageScale = 1;
                this.imageTranslateX = 0;
                this.imageTranslateY = 0;
            },
            // 在「添加新图片」状态下再次点击「+」：仅恢复上次保存的状态，不请求接口
            handleImageCloseNewContent() {
                if (!this.imageLastState) return;
                const s = this.imageLastState;
                this.currentTaskId = s.currentTaskId;
                this.currentTask = s.currentTask;
                this.orderItems = s.orderItems || [];
                this.uploadedImageFile = s.uploadedImageFile;
                this.imagePreview = s.imagePreview;
                this.imageScale = s.imageScale != null ? s.imageScale : 1;
                this.imageTranslateX = s.imageTranslateX != null ? s.imageTranslateX : 0;
                this.imageTranslateY = s.imageTranslateY != null ? s.imageTranslateY : 0;
                this.imageLastState = null;
            },

            // 点击「添加新内容」：先保存当前状态，再清空显示输入区
            handlePasteAddNew() {
                if (this.currentTaskId != null) {
                    this.pasteLastState = {
                        currentTaskId: this.currentTaskId,
                        currentTask: this.currentTask,
                        orderItems: (this.orderItems || []).slice(),
                        pasteInputText: this.pasteInputText || '',
                        pasteSaveCount: this.pasteSaveCount,
                        pasteInputContent: this.pasteInputContent || ''
                    };
                }
                this.currentTaskId = null;
                this.currentTask = null;
                this.orderItems = [];
                this.pasteInputText = '';
                this.pasteSaveCount = null;
                this.pasteInputContent = '';
            },
            // 在「添加新内容」状态下再次点击「+」：仅恢复上次保存的状态，不请求接口
            handlePasteCloseNewContent() {
                if (!this.pasteLastState) return;
                const s = this.pasteLastState;
                this.currentTaskId = s.currentTaskId;
                this.currentTask = s.currentTask;
                this.orderItems = s.orderItems || [];
                this.pasteInputText = s.pasteInputText || '';
                this.pasteSaveCount = s.pasteSaveCount;
                this.pasteInputContent = s.pasteInputContent || '';
                this.pasteLastState = null;
            },

            // Excel 粘贴：点击「+」进入添加新表格
            handleExcelPasteAddNew() {
                if (this.currentTaskId != null) {
                    this.excelPasteLastState = {
                        currentTaskId: this.currentTaskId,
                        currentTask: this.currentTask,
                        orderItems: (this.orderItems || []).slice(),
                        excelPasteSaveCount: this.excelPasteSaveCount,
                        excelPasteTableData: (this.excelPasteTableData || []).map(row => ({...row}))
                    };
                }
                this.currentTaskId = null;
                this.currentTask = null;
                this.orderItems = [];
                this.excelPasteSaveCount = null;
                this.excelPasteTableData = Array.from({length: 50}, () => ({
                    goodsName: '',
                    quantity: '',
                    specification: '',
                    specificationWeight: '',
                    cartonQuantity: '',
                    cartonName: '',
                    remark: ''
                }));
            },
            // Excel 粘贴：在「添加新表格」状态下再次点击「+」恢复上一任务
            handleExcelPasteCloseNewContent() {
                if (!this.excelPasteLastState) return;
                const s = this.excelPasteLastState;
                this.currentTaskId = s.currentTaskId;
                this.currentTask = s.currentTask;
                this.orderItems = s.orderItems || [];
                this.excelPasteSaveCount = s.excelPasteSaveCount;
                this.excelPasteTableData = s.excelPasteTableData && s.excelPasteTableData.length ? s.excelPasteTableData.slice() : Array.from({length: 50}, () => ({
                    goodsName: '',
                    quantity: '',
                    specification: '',
                    specificationWeight: '',
                    cartonQuantity: '',
                    cartonName: '',
                    remark: ''
                }));
                this.excelPasteLastState = null;
            },
            // Excel 粘贴模式：选中任务后拉取该任务订单
            async handleSelectExcelPasteTask({taskId, task}) {
                if (taskId == null) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                this.taskLoading = true;
                // 刷新/切换任务时清空右侧列表的播放、选择、编辑等状态
                this.draftSelectedOrderIndex = -1;
                this.orderArrIndex = -1;
                this.cancelAddOrderBefore();
                if (this.ttsStateByMode.excelPaste) {
                    this.ttsStateByMode.excelPaste = {isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1};
                }
                const excelPasteRef = this.getOrderListRef('excelPaste');
                if (excelPasteRef && excelPasteRef.stopReading) excelPasteRef.stopReading();
                this.resetSearchAndMatchedGoodsState();
                try {
                    const pageSize = 10;
                    const res = await api.getTaskOrders(taskId, {
                        page: 1,
                        limit: pageSize,
                        processStatus: true,
                        showLoading: false
                    });
                    const data = res && res.data;
                    if (!data || data.code !== 0) return;
                    const resTask = data.task || task || null;
                    const pageInfo = data.page || data;
                    const totalPages = pageInfo.totalPage != null ? pageInfo.totalPage : 1;
                    const resPageSize = pageInfo.pageSize != null ? pageInfo.pageSize : pageSize;
                    let orderArr = Array.isArray(pageInfo.list) ? pageInfo.list : (Array.isArray(pageInfo.data) ? pageInfo.data : []);

                    this.orderItems = orderArr;
                    this.currentTaskId = taskId;
                    this.currentTask = resTask;
                    this.excelPasteSaveCount = this.orderItems.length > 0 ? this.orderItems.length : null;
                    // 从 nxOcrTaskOcrText（CSV）还原左侧表格
                    const taskOcrText = (resTask && (resTask.nxOcrTaskOcrText != null ? resTask.nxOcrTaskOcrText : resTask.ocrText)) || '';
                    this.excelPasteTableData = this.parseCsvToExcelPasteTableData(taskOcrText);

                    if (totalPages > 1) {
                        const fetchRemainingPages = (page) => {
                            if (page > totalPages) return Promise.resolve();
                            // 已切换客户/任务时不再请求下一页，避免旧请求结果覆盖新客户数据
                            if (this.currentTaskId !== taskId) return Promise.resolve();
                            return api.getTaskOrders(taskId, {
                                page,
                                limit: resPageSize,
                                processStatus: true,
                                showLoading: false
                            }).then(r => {
                                const d = r && r.data;
                                if (d && d.code === 0 && d.page && Array.isArray(d.page.list) && d.page.list.length > 0 && this.currentTaskId === taskId) {
                                    orderArr = [...orderArr, ...d.page.list];
                                    this.orderItems = orderArr;
                                    this.excelPasteSaveCount = orderArr.length;
                                }
                                if (this.currentTaskId !== taskId) return Promise.resolve();
                                return fetchRemainingPages(page + 1);
                            }).catch(() => {
                            });
                        };
                        fetchRemainingPages(2).catch(() => {
                        });
                    }
                } catch (e) {
                    console.error('[PlaceOrder] handleSelectExcelPasteTask failed:', e);
                    await this.$refs.alertDialog.alert('加载任务订单失败：' + (e.message || '请稍后重试'));
                } finally {
                    this.taskLoading = false;
                }
            },

            // 粘贴模式：选中任务后拉取该任务订单（先第一页+蒙板，多页静默加载）
            async handleSelectPasteTask({taskId, task}) {
                if (taskId == null) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                this.taskLoading = true;
                // 刷新/切换任务时清空右侧列表的播放、选择、编辑等状态
                this.draftSelectedOrderIndex = -1;
                this.orderArrIndex = -1;
                this.cancelAddOrderBefore();
                if (this.ttsStateByMode.paste) {
                    this.ttsStateByMode.paste = {isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1};
                }
                const pasteRef = this.getOrderListRef('paste');
                if (pasteRef && pasteRef.stopReading) pasteRef.stopReading();
                this.resetSearchAndMatchedGoodsState();
                try {
                    const pageSize = 10;
                    const res = await api.getTaskOrders(taskId, {
                        page: 1,
                        limit: pageSize,
                        processStatus: true,
                        showLoading: false
                    });
                    const data = res && res.data;
                    if (!data || data.code !== 0) {
                        return;
                    }
                    const resTask = data.task || task || null;
                    const pageInfo = data.page || data;
                    const totalPages = pageInfo.totalPage != null ? pageInfo.totalPage : 1;
                    const resPageSize = pageInfo.pageSize != null ? pageInfo.pageSize : pageSize;
                    let orderArr = Array.isArray(pageInfo.list) ? pageInfo.list : (Array.isArray(pageInfo.data) ? pageInfo.data : []);

                    this.orderItems = orderArr;
                    this.currentTaskId = taskId;
                    this.currentTask = resTask;
                    this.pasteSaveCount = this.orderItems.length > 0 ? this.orderItems.length : null;
                    // 同步任务原文到左侧输入框，切换任务时左侧内容及时更新
                    const taskOcrText = (resTask && (resTask.nxOcrTaskOcrText != null ? resTask.nxOcrTaskOcrText : resTask.ocrText)) || '';
                    this.pasteInputText = taskOcrText;
                    this.pasteInputContent = taskOcrText;

                    if (totalPages <= 1) return;

                    const fetchRemainingPages = (page) => {
                        if (page > totalPages) return Promise.resolve();
                        if (this.currentTaskId !== taskId) return Promise.resolve();
                        return api.getTaskOrders(taskId, {
                            page,
                            limit: resPageSize,
                            processStatus: true,
                            showLoading: false
                        }).then(r => {
                            const d = r && r.data;
                            if (d && d.code === 0 && d.page && Array.isArray(d.page.list) && d.page.list.length > 0) {
                                if (this.currentTaskId === taskId) {
                                    orderArr = [...orderArr, ...d.page.list];
                                    this.orderItems = orderArr;
                                    this.pasteSaveCount = orderArr.length;
                                }
                            }
                            if (this.currentTaskId !== taskId) return Promise.resolve();
                            return fetchRemainingPages(page + 1);
                        }).catch(() => {
                        });
                    };
                    fetchRemainingPages(2).catch(() => {
                    });
                } catch (e) {
                    console.error('[PlaceOrder] handleSelectPasteTask failed:', e);
                    await this.$refs.alertDialog.alert('加载任务订单失败：' + (e.message || '请稍后重试'));
                } finally {
                    this.taskLoading = false;
                }
            },

            // 在任务列表中选中某个任务：先拉第一页展示，多页时后台静默加载剩余页（参考小程序 _initTaskOrder）
            async handleSelectImageTask({taskId, task}) {
                if (taskId == null) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                this.clearTaskStatusPollTimer();
                this.taskLoading = true;
                // 刷新/切换任务时清空右侧列表的播放、选择、编辑等状态
                this.draftSelectedOrderIndex = -1;
                this.orderArrIndex = -1;
                this.cancelAddOrderBefore();
                if (this.ttsStateByMode.image) {
                    this.ttsStateByMode.image = {isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1};
                }
                const imageRef = this.getOrderListRef('image');
                if (imageRef && imageRef.stopReading) imageRef.stopReading();
                this.resetSearchAndMatchedGoodsState();
                try {
                    const pageSize = 10;
                    const res = await api.getTaskOrders(taskId, {
                        page: 1,
                        limit: pageSize,
                        processStatus: true,
                        showLoading: false
                    });
                    const data = res && res.data;
                    if (!data || data.code !== 0) {
                        console.warn('[PlaceOrder] getTaskOrders 返回异常', data);
                        return;
                    }
                    const resTask = data.task || task || null;
                    const totalOrders = data.totalOrders;
                    const pageInfo = data.page || data;
                    const totalPages = pageInfo.totalPage != null ? pageInfo.totalPage : 1;
                    const resPageSize = pageInfo.pageSize != null ? pageInfo.pageSize : pageSize;
                    let orderArr = Array.isArray(pageInfo.list) ? pageInfo.list : (Array.isArray(pageInfo.data) ? pageInfo.data : []);

                    this.orderItems = orderArr;
                    this.currentTaskId = taskId;
                    this.currentTask = resTask;

                    // nxOcrTaskStatus===0 表示后台异步处理中，轮询直到状态变为 1 或 2
                    if (resTask && resTask.nxOcrTaskStatus === 0) {
                        this.startTaskStatusPolling(taskId, pageSize);
                        return;
                    }

                    if (resTask && resTask.nxOcrTaskImagePath) {
                        const base = (api.getImageServerURL && api.getImageServerURL()) || '';
                        const path = String(resTask.nxOcrTaskImagePath);
                        this.imagePreview = path.startsWith('http') ? path : (base.replace(/\/$/, '') + '/' + path.replace(/^\//, ''));
                        this.uploadedImageFile = {
                            name: resTask.nxOcrTaskFileName || '任务图片',
                            size: 0,
                            type: 'image/jpeg',
                            dataUrl: this.imagePreview
                        };
                    }

                    if (totalPages <= 1) return;

                    const fetchRemainingPages = (page) => {
                        if (page > totalPages) return Promise.resolve();
                        // 已切换客户/任务时不再请求下一页，避免旧请求结果覆盖新客户数据
                        if (this.currentTaskId !== taskId) return Promise.resolve();
                        return api.getTaskOrders(taskId, {
                            page,
                            limit: resPageSize,
                            processStatus: true,
                            showLoading: false
                        }).then(r => {
                            const d = r && r.data;
                            if (d && d.code === 0 && d.page && Array.isArray(d.page.list) && d.page.list.length > 0) {
                                if (this.currentTaskId === taskId) {
                                    orderArr = [...orderArr, ...d.page.list];
                                    this.orderItems = orderArr;
                                }
                            }
                            if (this.currentTaskId !== taskId) return Promise.resolve();
                            return fetchRemainingPages(page + 1);
                        }).catch(() => {
                        });
                    };
                    fetchRemainingPages(2).catch(() => {
                    });
                } catch (e) {
                    console.error('[PlaceOrder] handleSelectImageTask failed:', e);
                    await this.$refs.alertDialog.alert('加载任务订单失败：' + (e.message || '请稍后重试'));
                } finally {
                    this.taskLoading = false;
                }
            },

            /** 清除任务状态轮询定时器（切换任务、离开页面时调用） */
            clearTaskStatusPollTimer() {
                if (this.taskStatusPollTimer) {
                    clearInterval(this.taskStatusPollTimer);
                    this.taskStatusPollTimer = null;
                }
            },

            /** 切换部门时由 Bills 调用，立即清除任务状态和轮询，避免「后台处理中」蒙版残留；同时清空手动录入区 */
            clearTaskStatusOnCustomerChange() {
                this.clearTaskStatusPollTimer();
                this._taskStatusPollProcessed = null;
                this.currentTaskId = null;
                this.currentTask = null;
                this.orderItems = [];
                this.hasRunningTask = false;
                this.uploadedImageFile = null;
                this.imagePreview = null;
                this.taskLoading = false;
                // 清空 ManualEntryUpload：参考文字、参考图片、添加订单表单
                this.manualRefText = '';
                this.manualRefImageDataUrl = null;
                this.addingOrderBeforeIndex = -1;
                this.beforeOrderForm = {
                    goodsName: '',
                    quantity: '',
                    standard: '',
                    remark: '',
                    selectedGoods: null,
                    searchResults: [],
                    disArr: [],
                    nxArr: [],
                    showSearchResults: false
                };
            },

            /** nxOcrTaskStatus===0 时轮询 getTaskOrders，直到状态变为 1 或 2 */
            startTaskStatusPolling(taskId, pageSize = 10) {
                this.clearTaskStatusPollTimer();
                this._taskStatusPollProcessed = null; // 防止多个 poll 并发时重复处理
                const poll = async () => {
                    if (this.currentTaskId !== taskId) return;
                    try {
                        const res = await api.getTaskOrders(taskId, {
                            page: 1,
                            limit: pageSize,
                            processStatus: true,
                            showLoading: false
                        });
                        const data = res && res.data;
                        if (!data || data.code !== 0) return;
                        const resTask = data.task || null;
                        const status = resTask && resTask.nxOcrTaskStatus;
                        if (status === 1 || status === 2) {
                            if (this._taskStatusPollProcessed === taskId) return; // 已由其他并发 poll 处理，避免重复请求
                            this._taskStatusPollProcessed = taskId;
                            this.clearTaskStatusPollTimer();
                            const pageInfo = data.page || data;
                            const totalPages = pageInfo.totalPage != null ? pageInfo.totalPage : 1;
                            const resPageSize = pageInfo.pageSize != null ? pageInfo.pageSize : pageSize;
                            let orderArr = Array.isArray(pageInfo.list) ? pageInfo.list : (Array.isArray(pageInfo.data) ? pageInfo.data : []);
                            this.orderItems = orderArr;
                            this.currentTask = resTask;
                            if (resTask && resTask.nxOcrTaskImagePath) {
                                const base = (api.getImageServerURL && api.getImageServerURL()) || '';
                                const path = String(resTask.nxOcrTaskImagePath);
                                this.imagePreview = path.startsWith('http') ? path : (base.replace(/\/$/, '') + '/' + path.replace(/^\//, ''));
                                this.uploadedImageFile = {
                                    name: resTask.nxOcrTaskFileName || '任务图片',
                                    size: 0,
                                    type: 'image/jpeg',
                                    dataUrl: this.imagePreview
                                };
                            }
                            if (totalPages > 1) {
                                const fetchRemainingPages = (page) => {
                                    if (page > totalPages) return Promise.resolve();
                                    if (this.currentTaskId !== taskId) return Promise.resolve();
                                    return api.getTaskOrders(taskId, { page, limit: resPageSize, processStatus: true, showLoading: false }).then(r => {
                                        const d = r && r.data;
                                        if (d && d.code === 0 && d.page && Array.isArray(d.page.list) && d.page.list.length > 0 && this.currentTaskId === taskId) {
                                            orderArr = [...orderArr, ...d.page.list];
                                            this.orderItems = orderArr;
                                        }
                                        return this.currentTaskId === taskId ? fetchRemainingPages(page + 1) : Promise.resolve();
                                    }).catch(() => {});
                                };
                                fetchRemainingPages(2).catch(() => {});
                            }
                        }
                    } catch (e) {
                        console.warn('[PlaceOrder] 任务状态轮询失败:', e);
                    }
                };
                this.taskStatusPollTimer = setInterval(poll, 20000);
                poll(); // 立即执行一次（3秒后再执行）
            },

            // 处理AI识别（带DeepSeek，不裁剪）
            async handleDirectRecognizeAi(imageDataUrl) {
                if (!this.selectedAllCustomer) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 关闭弹窗
                this.closeImagePreviewModal();

                // 确定要使用的部门ID（如果有子部门选择，使用子部门ID，否则使用父部门ID）
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                // 将图片DataURL转换为Base64（去掉data:image/...;base64,前缀）
                const imageBase64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;

                // 确保 uploadedImageFile 已设置
                if (!this.uploadedImageFile) {
                    const fileName = this.originalImageFile?.name || 'image.jpg';
                    const fileSize = this.originalImageFile?.size || 0;
                    const fileType = this.originalImageFile?.type || 'image/jpeg';
                    this.uploadedImageFile = {
                        name: fileName,
                        size: fileSize,
                        type: fileType,
                        dataUrl: imageDataUrl
                    };
                } else {
                    this.uploadedImageFile.dataUrl = imageDataUrl;
                }

                // 设置预览图片
                this.imagePreview = imageDataUrl;

                // 设置识别中状态
                this.hasRunningTask = true;
                this.recognizingImage = true;

                try {
                    // 调用AI识别接口（模式2：图片模式）
                    const requestData = {
                        ImageBase64: imageBase64,
                        depId: targetDepId,
                        depFatherId: this.selectedAllCustomer,
                        disId: this.disUser?.nxDiuDistributerId,
                        userId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId
                    };

                    const res = await api.recognizeOrderOCRWithAi(requestData, {showLoading: false});
                    if (res && res.data && res.data.code === 0) {
                        const taskId = res.data.taskId;
                        const task = res.data.task || null;
                        if (taskId != null && taskId > 0) {
                            await this.handleSelectImageTask({ taskId, task });
                            if (this.uploadType === 'image' && this.$refs.imageUploadRef?.loadTaskList) {
                                this.$nextTick(() => {
                                    this.$refs.imageUploadRef.loadTaskList(taskId, { type: 1 });
                                });
                            }
                            this.$emit('task-added');
                        }
                    } else {
                        const errorMsg = res?.data?.msg || res?.data?.message || 'AI识别失败';
                        await this.$refs.alertDialog.alert(errorMsg);
                    }
                } catch (error) {
                    await this.$refs.alertDialog.alert('AI识别失败：' + (error.message || '未知错误'));
                } finally {
                    // 清除识别中状态
                    this.hasRunningTask = false;
                    this.recognizingImage = false;
                }
            },

            // 处理裁剪确认
            async handleCropConfirm(result) {
                // result 包含 { croppedDataUrl, cropRect, naturalWidth, naturalHeight, zoom, panX, panY }
                const croppedDataUrl = result.croppedDataUrl;

                // 关闭弹窗
                this.closeImagePreviewModal();

                // 更新预览
                this.imagePreview = croppedDataUrl;
                if (this.uploadedImageFile) {
                    this.uploadedImageFile.dataUrl = croppedDataUrl;
                }

                // 重置变换
                this.resetImageTransform();

                // 执行OCR识别
                await this.recognizeImage(croppedDataUrl);
            },

            // 执行OCR识别（使用当前预览的图片或裁剪后的图片）
            async recognizeImage(imageDataUrl) {
                if (!this.selectedAllCustomer) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 确定要使用的部门ID（如果有子部门选择，使用子部门ID，否则使用父部门ID）
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                console.log('🔍 [recognizeImage] 准备创建任务，当前客户信息:', {
                    selectedAllCustomer: this.selectedAllCustomer,
                    selectedSubDepartment: this.selectedSubDepartment,
                    selectedCustomerName: this.selectedCustomerName,
                    targetDepId: targetDepId,
                    disId: this.disUser?.nxDiuDistributerId,
                    userId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId
                });

                // 检查是否已有进行中的任务
                if (taskQueue.hasActiveTask(targetDepId)) {
                    console.log('⏸️ [recognizeImage] 该部门已有进行中的任务，跳过');
                    // 不再弹窗提示，静默处理
                    return;
                }

                // 将图片DataURL转换为Base64（去掉data:image/...;base64,前缀）
                const imageBase64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;

                // 确保 uploadedImageFile 已设置（如果还没有设置）
                if (!this.uploadedImageFile) {
                    // 从 originalImageFile 或使用默认值
                    const fileName = this.originalImageFile?.name || 'image.jpg';
                    const fileSize = this.originalImageFile?.size || 0;
                    const fileType = this.originalImageFile?.type || 'image/jpeg';
                    this.uploadedImageFile = {
                        name: fileName,
                        size: fileSize,
                        type: fileType,
                        dataUrl: imageDataUrl
                    };
                } else {
                    // 如果已有文件信息，更新 dataUrl
                    this.uploadedImageFile.dataUrl = imageDataUrl;
                }

                // 确保 imagePreview 已设置
                if (!this.imagePreview) {
                    this.imagePreview = imageDataUrl;
                }

                // 创建任务
                const taskInfo = {
                    depId: targetDepId,
                    depFatherId: this.selectedAllCustomer,
                    depName: this.selectedCustomerName || '客户',
                    type: taskQueue.TASK_TYPE.IMAGE,
                    imageList: [{
                        base64: imageBase64,
                        dataUrl: imageDataUrl,
                        name: this.uploadedImageFile.name,
                        size: this.uploadedImageFile.size,
                        type: this.uploadedImageFile.type
                    }],
                    disId: this.disUser?.nxDiuDistributerId,
                    userId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId
                };

                console.log('📝 [recognizeImage] 创建任务，任务信息:', taskInfo);

                const taskId = taskQueue.addTask(taskInfo);

                if (!taskId) {
                    // 不再弹窗提示，静默处理
                    return;
                }

                // 设置识别中状态
                this.hasRunningTask = true;
                this.recognizingImage = true;

                console.log('✅ [recognizeImage] 任务创建成功，设置状态:', {
                    taskId,
                    hasRunningTask: this.hasRunningTask,
                    recognizingImage: this.recognizingImage,
                    uploadedImageFile: this.uploadedImageFile,
                    imagePreview: !!this.imagePreview
                });

                // 确保任务执行器已启动
                taskExecutor.checkAndStartExecutor();

                // 不再弹窗提示，静默处理
            },

            // 清除图片预览
            clearImagePreview() {
                this.imagePreview = null;
                this.uploadedImageFile = null;
                this.orderItems = [];
                this.resetImageTransform();
                if (this.$refs.imageFileInput) {
                    this.$refs.imageFileInput.value = '';
                }
            },

            // 重置图片变换
            resetImageTransform() {
                this.imageScale = 1;
                this.imageTranslateX = 0;
                this.imageTranslateY = 0;
            },

            // 处理图片加载事件，记录尺寸信息并自动调整缩放
            handleImageLoad(event, sourceType) {
                const img = event.target;
                const naturalWidth = img.naturalWidth;
                const naturalHeight = img.naturalHeight;

                // 获取图片的实际显示尺寸
                const imgRect = img.getBoundingClientRect();
                const computedStyle = window.getComputedStyle(img);

                // 查找容器
                let container = null;
                if (sourceType === 'image') {
                    container = img.closest('.border.rounded');
                } else if (sourceType === 'auto') {
                    container = img.closest('.card-body');
                }

                const containerRect = container ? container.getBoundingClientRect() : null;

                console.log('🖼️ [handleImageLoad] 图片加载完成:', {
                    sourceType,
                    naturalWidth,
                    naturalHeight,
                    naturalAspectRatio: (naturalWidth / naturalHeight).toFixed(2),
                    displayWidth: imgRect.width,
                    displayHeight: imgRect.height,
                    computedWidth: computedStyle.width,
                    computedMaxWidth: computedStyle.maxWidth,
                    computedHeight: computedStyle.height,
                    transform: computedStyle.transform,
                    imageScale: this.imageScale,
                    imageTranslateX: this.imageTranslateX,
                    imageTranslateY: this.imageTranslateY,
                    containerWidth: containerRect?.width || 'N/A',
                    containerHeight: containerRect?.height || 'N/A',
                    isOverflow: containerRect ? imgRect.width > containerRect.width : false,
                    overflowAmount: containerRect ? (imgRect.width - containerRect.width).toFixed(2) : 'N/A',
                    imgSrc: img.src.substring(0, 50) + '...'
                });

                // 如果图片宽度超出容器，自动调整缩放比例
                if (containerRect && imgRect.width > containerRect.width) {
                    console.warn('⚠️ [handleImageLoad] 图片宽度超出容器，自动调整缩放:', {
                        imgWidth: imgRect.width,
                        containerWidth: containerRect.width,
                        overflow: (imgRect.width - containerRect.width).toFixed(2) + 'px',
                        oldScale: this.imageScale,
                        naturalWidth,
                        computedWidth: computedStyle.width
                    });

                    // 计算合适的缩放比例
                    // 如果图片设置了 width: 100% 或 max-width: 100%，图片的基础宽度应该是容器宽度
                    // transform scale 是在这个基础上缩放的
                    let baseWidth;
                    if (computedStyle.width === '100%' || computedStyle.maxWidth === '100%') {
                        // 图片已经限制为容器宽度，scale 是在这个基础上应用的
                        baseWidth = containerRect.width;
                    } else {
                        // 图片使用自然宽度，scale 是在自然宽度基础上应用的
                        baseWidth = naturalWidth;
                    }

                    // 计算目标缩放比例：容器宽度 / 基础宽度 * 0.98（留一点边距）
                    const targetScale = (containerRect.width / baseWidth) * 0.98;

                    console.log('🔧 [handleImageLoad] 调整缩放比例:', {
                        baseWidth,
                        targetScale,
                        oldScale: this.imageScale,
                        computedWidth: computedStyle.width,
                        computedMaxWidth: computedStyle.maxWidth
                    });

                    // 只在首次加载时自动调整（如果缩放比例是默认值1，说明是首次加载）
                    const isFirstLoad = this.imageScale === 1 && this.imageTranslateX === 0 && this.imageTranslateY === 0;

                    if (isFirstLoad || sourceType === 'image') {
                        // 图片上传模式或首次加载时，自动调整缩放
                        this.imageScale = Math.max(0.1, Math.min(targetScale, 5)); // 限制在 0.1-5 倍之间
                        this.imageTranslateX = 0; // 重置X偏移
                        this.imageTranslateY = 0; // 重置Y偏移
                    } else {
                        // 转订单模式下，如果用户已经手动调整过，只调整缩放比例，不重置位置
                        console.log('🔧 [handleImageLoad] 转订单模式，保留用户手动调整的位置');
                        const currentScale = this.imageScale;
                        const scaleRatio = targetScale / currentScale;
                        // 如果新缩放比例和当前比例差异很大，才调整
                        if (Math.abs(scaleRatio - 1) > 0.1) {
                            this.imageScale = Math.max(0.1, Math.min(targetScale, 5));
                        }
                    }

                    // 等待下一帧后再次检查
                    this.$nextTick(() => {
                        const newImgRect = img.getBoundingClientRect();
                        console.log('✅ [handleImageLoad] 调整后的尺寸:', {
                            newWidth: newImgRect.width,
                            containerWidth: containerRect.width,
                            newScale: this.imageScale,
                            imageTranslateX: this.imageTranslateX,
                            imageTranslateY: this.imageTranslateY,
                            isFixed: newImgRect.width <= containerRect.width,
                            remainingOverflow: newImgRect.width > containerRect.width ? (newImgRect.width - containerRect.width).toFixed(2) : 0
                        });
                    });
                }
            },

            // 放大图片
            zoomIn() {
                console.log('🔍 [zoomIn] 放大图片，当前缩放:', this.imageScale);
                this.imageScale = Math.min(this.imageScale + 0.2, 5); // 最大5倍
                console.log('🔍 [zoomIn] 放大后缩放:', this.imageScale);
            },

            // 缩小图片
            zoomOut() {
                console.log('🔍 [zoomOut] 缩小图片，当前缩放:', this.imageScale);
                this.imageScale = Math.max(this.imageScale - 0.2, 0.5); // 最小0.5倍
                console.log('🔍 [zoomOut] 缩小后缩放:', this.imageScale);
            },

            // 鼠标滚轮缩放
            onWheel(event) {
                event.preventDefault();
                const delta = event.deltaY > 0 ? -0.1 : 0.1;
                const newScale = Math.max(0.5, Math.min(5, this.imageScale + delta));
                this.imageScale = newScale;
            },

            // 开始拖拽
            startDrag(event) {
                if (event.button !== 0) return; // 只响应左键
                // 如果点击的是按钮，不触发拖拽
                if (event.target.closest('button')) {
                    console.log('🖱️ [startDrag] 点击的是按钮，跳过拖拽');
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                console.log('🖱️ [startDrag] 开始拖拽:', {
                    clientX: event.clientX,
                    clientY: event.clientY,
                    imageTranslateX: this.imageTranslateX,
                    imageTranslateY: this.imageTranslateY
                });
                this.isDragging = true;
                this.dragStartX = event.clientX - this.imageTranslateX;
                this.dragStartY = event.clientY - this.imageTranslateY;

                // 添加全局事件监听，确保鼠标移出容器外也能继续拖拽
                document.addEventListener('mousemove', this.onDrag);
                document.addEventListener('mouseup', this.endDrag);
            },

            // 拖拽中
            onDrag(event) {
                if (!this.isDragging) return;
                event.preventDefault();
                event.stopPropagation();
                this.imageTranslateX = event.clientX - this.dragStartX;
                this.imageTranslateY = event.clientY - this.dragStartY;
            },

            // 结束拖拽
            endDrag(event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                this.isDragging = false;
                // 移除全局事件监听
                document.removeEventListener('mousemove', this.onDrag);
                document.removeEventListener('mouseup', this.endDrag);
            },

            // 将图片文件转换为Base64（Electron环境）
            imageToBase64(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        // 移除 data:image/xxx;base64, 前缀
                        const base64 = e.target.result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = (error) => {
                        reject(error);
                    };
                    reader.readAsDataURL(file);
                });
            },

            // ========== 复制粘贴相关方法 ==========

            // 输入框实时更新（参考小程序 onInput）
            onPasteInput(e) {
                const text = e.target.value;
                // 同时更新 pasteInputText 和 pasteInputContent，保持同步
                this.pasteInputText = text;
                this.pasteInputContent = text.trim() !== '' ? text : '';
                // 用户编辑时清除校验不合格行高亮和未解析有效订单标记
                if (this.pasteInvalidLineIndices.length > 0 || this.pasteInvalidSegments.length > 0 || this.pasteNoValidOrder) {
                    this.pasteInvalidLineIndices = [];
                    this.pasteInvalidSegments = [];
                    this.pasteNoValidOrder = false;
                }
            },

            // PasteUpload 组件的事件适配器
            handlePasteInput(e) {
                this.onPasteInput(e);
            },

            // DraftOrderList 组件的事件适配器（Paste 模式草稿状态）
            handleDraftOrderListGoodsNameInput({item, orderIndex, value}) {
                // 更新 item.nxDoGoodsName
                this.orderItems[orderIndex].nxDoGoodsName = value;
                // 调用 handleGoodsNameInput 来设置 currentSourceType 和 orderArrIndex，并触发搜索
                // this.handleGoodsNameInput(item, orderIndex, 'paste');
            },
            handleDraftOrderListQuantityInput({item, orderIndex, value}) {
                this.orderItems[orderIndex].nxDoQuantity = value;
            },
            handleDraftOrderListStandardChange({item, orderIndex, value}) {
                this.orderItems[orderIndex].nxDoStandard = value;
            },
            handleDraftOrderListDeleteOrder({item, orderIndex}) {
                if (orderIndex >= 0 && orderIndex < this.orderItems.length) {
                    this.orderItems.splice(orderIndex, 1);
                }
            },
            handleDraftOrderListAddOrderBefore({orderIndex}) {
                const empty = {nxDoGoodsName: '', nxDoQuantity: '', nxDoStandard: ''};
                this.orderItems.splice(orderIndex, 0, empty);
            },
            handleDraftOrderListAddRemark({item, orderIndex}) {
                const row = this.orderItems[orderIndex];
                row.nxDoAddRemark = true;
                if (row.nxDoRemark === undefined) row.nxDoRemark = '';
            },
            handleDraftOrderListClearRemark({item, orderIndex}) {
                const row = this.orderItems[orderIndex];
                row.nxDoAddRemark = false;
                row.nxDoRemark = '';
            },
            handleDraftOrderListRemarkInput({item, orderIndex, value, field}) {
                if (field) {
                    this.orderItems[orderIndex][field] = value;
                }
            },

            // ========== ExcelPasteUpload 组件事件适配器方法 ==========
            handleExcelPasteCellClick({row, column, rowIndex, columnIndex}) {
                this.handleCellClick({row, column, rowIndex, columnIndex});
            },
            handleExcelPasteEditClosed({row, column, rowIndex, columnIndex}) {
                this.handleEditClosed({row, column, rowIndex, columnIndex});
            },

            // ========== DraftOrderList 组件事件适配器方法（Excel-Paste 模式草稿状态） ==========
            handleExcelPasteDraftGoodsNameInput({item, orderIndex, value}) {
                this.orderItems[orderIndex].nxDoGoodsName = value;
            },
            handleExcelPasteDraftQuantityInput({item, orderIndex, value}) {
                this.orderItems[orderIndex].nxDoQuantity = value;
            },
            handleExcelPasteDraftStandardChange({item, orderIndex, value}) {
                this.orderItems[orderIndex].nxDoStandard = value;
            },
            handleExcelPasteDraftDeleteOrder({item, orderIndex}) {
                this.handleDeleteOrderFromExcel(item, orderIndex, 'excel-paste');
            },
            handleExcelPasteDraftAddOrderBefore({orderIndex}) {
                const empty = {nxDoGoodsName: '', nxDoQuantity: '', nxDoStandard: ''};
                this.orderItems.splice(orderIndex, 0, empty);
            },
            handleExcelPasteDraftAddRemark({item, orderIndex}) {
                const row = this.orderItems[orderIndex];
                row.nxDoAddRemark = true;
                if (row.nxDoRemark === undefined) row.nxDoRemark = '';
            },
            handleExcelPasteDraftClearRemark({item, orderIndex}) {
                const row = this.orderItems[orderIndex];
                row.nxDoAddRemark = false;
                row.nxDoRemark = '';
            },
            handleExcelPasteDraftRemarkInput({item, orderIndex, value, field}) {
                if (field) {
                    this.orderItems[orderIndex][field] = value;
                }
            },

            // ========== OrderList 组件事件适配器方法（Excel-Paste 模式已保存状态） ==========
            handleSaveBeforeOrderExcelPaste({item, orderIndex}) {
                this.saveBeforeOrder(item, orderIndex, 'excel-paste');
            },
            handleOrderListGoodsNameInputExcelPaste({item, orderIndex, value}) {
                item.nxDoGoodsName = value;
                this.handleGoodsNameInput(item, orderIndex, 'excel-paste');
            },
            handleOrderListGoodsNameFocusExcelPaste({item, orderIndex}) {
                this.handleGoodsNameFocus(item, orderIndex, 'excel-paste');
            },
            handleOrderListGoodsNameBlurExcelPaste({item, orderIndex}) {
                this.handleGoodsNameBlur(item, orderIndex, 'excel-paste');
            },
            handleOrderListQuantityInputExcelPaste({item, orderIndex, value}) {
                item.nxDoQuantity = value;
            },
            handleOrderListStandardChangeExcelPaste({item, orderIndex, value}) {
                item.nxDoStandard = value;
            },
            handleOrderListUpdateOrderExcelPaste({item, orderIndex}) {
                this.handleUpdateOrder(item, orderIndex, 'excel-paste');
            },
            handleOrderListSaveNewGoodsExcelPaste({item, orderIndex, goodsName}) {
                this.handleSaveNewGoods(item, orderIndex, 'excel-paste', goodsName);
            },
            handleOrderListAddNewOrderBeforeExcelPaste({item, orderIndex}) {
                this.handleAddNewOrderBefore(item, orderIndex, 'excel-paste');
            },
            handleOrderListDeleteOrderExcelPaste({item, orderIndex}) {
                this.handleDeleteOrderFromExcel(item, orderIndex, 'excel-paste');
            },
            handleOrderListRemarkInputExcelPaste({item, orderIndex, value, field}) {
                if (field) {
                    item[field] = value;
                    this.handleRemarkInput(item, orderIndex, 'excel-paste');
                }
            },
            handleOrderListSelectMatchedGoodsExcelPaste({item, orderIndex, goodsIndex}) {
                this.selectMatchedGoods(item, orderIndex, goodsIndex, 'excel-paste');
            },
            handleOrderListSelectSearchResultExcelPaste({goods, orderIndex}) {
                this.selectSearchResult(goods, orderIndex, 'excel-paste');
            },

            // ========== AutoUpload 组件事件适配器方法 ==========
            handleActiveProcessedFileTabChange(filePath) {
                this.activeProcessedFileTab = filePath;
            },
            handleImageLoadAuto(event) {
                this.handleImageLoad(event, 'auto');
            },

            // ========== OrderList 组件事件适配器方法（Auto 模式） ==========
            handleSaveBeforeOrderAuto({item, orderIndex}) {
                this.saveBeforeOrder(item, orderIndex, 'auto');
            },
            handleOrderListGoodsNameInputAuto({item, orderIndex, value}) {
                item.nxDoGoodsName = value;
                this.handleGoodsNameInput(item, orderIndex, 'auto');
            },
            handleOrderListGoodsNameFocusAuto({item, orderIndex}) {
                this.handleGoodsNameFocus(item, orderIndex, 'auto');
            },
            handleOrderListGoodsNameBlurAuto({item, orderIndex}) {
                this.handleGoodsNameBlur(item, orderIndex, 'auto');
            },
            handleOrderListQuantityInputAuto({item, orderIndex, value}) {
                item.nxDoQuantity = value;
            },
            handleOrderListStandardChangeAuto({item, orderIndex, value}) {
                item.nxDoStandard = value;
            },
            handleOrderListUpdateOrderAuto({item, orderIndex}) {
                this.handleUpdateOrder(item, orderIndex, 'auto');
            },
            handleOrderListSaveNewGoodsAuto({item, orderIndex, goodsName}) {
                this.handleSaveNewGoods(item, orderIndex, 'auto', goodsName);
            },
            handleOrderListAddNewOrderBeforeAuto({item, orderIndex}) {
                this.handleAddNewOrderBefore(item, orderIndex, 'auto');
            },
            handleOrderListDeleteOrderAuto({item, orderIndex}) {
                this.handleDeleteOrderFromExcel(item, orderIndex, 'auto');
            },
            handleOrderListRemarkInputAuto({item, orderIndex, value, field}) {
                if (field) {
                    item[field] = value;
                    this.handleRemarkInput(item, orderIndex, 'auto');
                }
            },
            handleOrderListSelectMatchedGoodsAuto({item, orderIndex, goodsIndex}) {
                this.selectMatchedGoods(item, orderIndex, goodsIndex, 'auto');
            },
            handleOrderListSelectSearchResultAuto({goods, orderIndex}) {
                this.selectSearchResult(goods, orderIndex, 'auto');
            },


            // 本地解析粘贴文本为订单（不调用 DeepSeek，参考 cankao/formatOrder.js）
            async handlePasteLocalParse() {
                const content = this.pasteInputContent || this.pasteInputText;
                if (!content || (typeof content === 'string' && content.trim() === '')) {
                    console.warn('[handlePasteLocalParse] 内容为空，跳过解析');
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                this.resetSearchAndMatchedGoodsState();
                const result = parseOrderFromText(content);
                const orders = (result.orders || []).map(o => ({
                    ...o,
                    nxDoGoodsNameOriginal: o.nxDoGoodsOrignialName || o.nxDoGoodsName || ''
                }));
                const invalidLineIndices = result.invalidLineIndices || [];
                const invalidSegments = result.invalidSegments || [];
                console.log('[handlePasteLocalParse] 解析结果:', {
                    ordersCount: orders.length,
                    invalidLineIndices,
                    invalidSegments,
                    invalidCount: invalidSegments.length
                });
                if (orders.length === 0) {
                    console.warn('[handlePasteLocalParse] 未解析到有效订单');
                    this.pasteNoValidOrder = true;
                    this.pasteInvalidLineIndices = invalidLineIndices;
                    this.pasteInvalidSegments = invalidSegments;
                    return;
                }
                if (invalidSegments.length > 0) {
                    console.warn('[handlePasteLocalParse] 存在校验不合格片段，不更新订单列表，仅高亮提示。不合格片段:', invalidSegments);
                    this.pasteInvalidLineIndices = invalidLineIndices;
                    this.pasteInvalidSegments = invalidSegments;
                    return;
                }
                this.orderItems = orders;
                this.pasteInvalidLineIndices = [];
                this.pasteInvalidSegments = [];
                this.pasteNoValidOrder = false;
                console.log('[handlePasteLocalParse] 解析通过，已更新订单列表');
            },

            // AI识别优化文本（参考小程序 aiRecogniseFirst）
            async aiRecogniseFirst() {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                // 优先使用 pasteInputContent，因为用户修改输入框时更新的是 pasteInputContent
                // 如果没有 pasteInputContent，再使用 pasteInputText
                const content = this.pasteInputContent || this.pasteInputText;

                if (!content || content.trim() === '') {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                console.log('开始第一次 AI 识别，输入内容:', content);

                this.showDeepSeekLoading = true;

                try {
                    const optimizedText = await this.optimizeTextWithDeepSeek(content, 0.2, []);
                    console.log('第一次 AI 识别完成，优化后内容:', optimizedText);

                    // 将JSON格式转换为逗号分隔格式显示
                    let displayText = optimizedText;
                    let ordersJson = null;
                    try {
                        let jsonStr = optimizedText.trim();
                        // 移除可能的 markdown 代码块标记
                        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
                        jsonStr = jsonStr.trim();

                        // 尝试解析 JSON
                        ordersJson = JSON.parse(jsonStr);

                        if (Array.isArray(ordersJson) && ordersJson.length > 0) {
                            // 转换为格式：商品名称(备注) 数量 单位,
                            displayText = ordersJson.map(item => {
                                const name = item.name || '';
                                const qty = item.qty || '';
                                const unit = item.unit || '斤';
                                const remark = item.remark || '';

                                // 格式：商品名称(备注) 数量 单位,
                                let line = '';

                                // 如果有备注，用括号括起来放在商品名称后面
                                if (remark && remark.trim() !== '') {
                                    line = `${name}(${remark}) ${qty} ${unit},`;
                                } else {
                                    line = `${name} ${qty} ${unit},`;
                                }

                                return line;
                            }).join('\n');
                        }
                    } catch (jsonError) {
                        // 如果JSON解析失败，使用原始文本
                        console.log('JSON解析失败，使用原始文本:', jsonError.message);
                        displayText = optimizedText;
                    }

                    this.pasteInputText = displayText;
                    this.pasteInputContent = displayText;
                    this.pasteOriginText = content; // 保存原始内容用于再次识别

                    // 重新进行订单解析
                    // 如果成功解析了JSON，直接使用JSON格式解析（更准确）
                    // 否则使用显示格式（逗号分隔格式）解析
                    if (ordersJson && Array.isArray(ordersJson) && ordersJson.length > 0) {
                        // 使用JSON格式进行解析（更准确）
                        this.parseTextToOrders(optimizedText);
                    } else {
                        // 使用显示格式进行解析
                        this.parsePasteText();
                    }
                } catch (error) {
                    console.error('第一次 AI 识别失败:', error);
                    await this.$refs.alertDialog.alert('AI识别失败：' + (error.message || '未知错误'));
                } finally {
                    this.showDeepSeekLoading = false;
                }
            },

            // DeepSeek API 优化文本（参考小程序 optimizeTextWithDeepSeek）
            async optimizeTextWithDeepSeek(text, temperature = 0.2, brandList = []) {
                try {
                    console.log('开始调用 DeepSeek API，输入文本:', text, '温度:', temperature);

                    // 从接口获取 prompt
                    let systemPrompt = '';
                    try {
                        const promptRes = await api.getPromptByKey('OCR_PASTE');
                        if (promptRes && promptRes.data && promptRes.data.code === 0) {
                            // 尝试多种可能的数据结构
                            const promptData = promptRes.data.prompt || promptRes.data.data;

                            console.log('📥 [DeepSeek API] promptData:', promptData);
                            console.log('📥 [DeepSeek API] promptData 类型:', typeof promptData);

                            if (promptData) {
                                // 如果 promptData 是一个对象，尝试获取其内容字段
                                if (typeof promptData === 'object') {
                                    systemPrompt = promptData?.promptContent ||
                                        promptData?.content ||
                                        promptData?.prompt ||
                                        promptData?.text ||
                                        promptData?.value ||
                                        JSON.stringify(promptData);
                                } else if (typeof promptData === 'string') {
                                    // 如果 promptData 本身就是字符串
                                    systemPrompt = promptData;
                                }
                            }

                            if (systemPrompt) {
                                console.log('✅ [DeepSeek API] 成功从接口获取 prompt，长度:', systemPrompt.length);
                                console.log('✅ [DeepSeek API] 从接口获取的 prompt（前500字符）:', systemPrompt.substring(0, 500));
                            } else {
                                console.warn('⚠️ [DeepSeek API] 接口返回数据中未找到 prompt 内容');
                                console.warn('⚠️ [DeepSeek API] 完整响应数据:', JSON.stringify(promptRes.data, null, 2));
                                throw new Error('未找到 prompt 内容');
                            }
                        } else {
                            console.warn('⚠️ [optimizeTextWithDeepSeek] 接口返回格式不正确，使用默认 prompt');
                            throw new Error('接口返回格式不正确');
                        }
                    } catch (promptError) {
                        console.error('❌ [optimizeTextWithDeepSeek] 获取 prompt 失败，使用默认 prompt:', promptError);
                        // 如果接口获取失败，使用默认的 prompt（作为后备方案）
                        systemPrompt = `你是一个专业的餐饮行业订单解析助手。请将用户输入的语音识别文本转换为标准化的订单 JSON 数据。

重要规则：
1. **输入来源**：内容来自腾讯语音识别，可能存在大量同音词错误，需要智能纠正为正确的商品名称。
2. **品牌识别优先级最高**：
   - 即使识别出的词在字面意思上是通顺的（如"冬菇"），如果它的发音与品牌库中的品牌（如"东古"）完全一致或极度相似，且上下文符合调料/商品场景，必须优先纠正为品牌名！
   - "一品鲜"、"酱油"、"陈醋"、"生抽"等词前面的通常是品牌名，需要特别注意识别。
3. **特殊商品名**：以下商品名称是完整的，不要拆分：
   - "去叶中葱"、"去叶大葱"、"去根胡萝卜"、"去皮土豆" 等
   - "西兰苔"、"板蓝根" 等
4. **语音识别错误纠正**：
   - "实质" → "10只"
   - "死机" → "4斤"
   - "无间" → "5斤"
   - "溜达" → "6大"
   - "9枝话梅" → "九制话梅"
   - "诸侯酱" → "柱侯酱"
   - "小米腊" → "小米辣"
   - "第儿" → "地儿"
5. **同音词归一**："1000元餐盒" → "1000圆餐盒"
6. **"各"字处理**："红黄彩椒各" 视为一个完整商品名

输出要求：
- 必须输出一个标准的 JSON 数组，不要包含 Markdown 标记、代码块标记或其他文字说明
- 只输出纯 JSON 数组，格式如下：
[{"name": "商品名称", "qty": "数量", "unit": "单位", "remark": "备注"}]

字段说明：
- name: 商品名称（必填，字符串）
- qty: 数量（必填，字符串，如 "5"、"10"）
- unit: 单位（必填，字符串，如 "斤"、"个"、"包"、"根"、"棵"、"条"、"盒"、"捆"、"袋"、"瓶"、"罐"、"桶"、"箱"）
- remark: 备注（可选，字符串，如 "要新鲜的"、"小颗的"）

默认值：
- 如果数量后没有单位，默认使用 "斤"
- 如果没有备注，使用空字符串 ""

请严格按照上述格式输出，只输出 JSON 数组，不要添加任何其他内容。`;
                    }

                    // 动态导入 config（Vue 项目中使用 import）
                    const configModule = await import('@/config/index');
                    const config = configModule.default;
                    const DEEPSEEK_API_KEY = config.deepSeek?.apiKey || '';
                    const DEEPSEEK_API_URL = config.deepSeek?.apiUrl || 'https://api.deepseek.com/v1/chat/completions';
                    const DEEPSEEK_MODEL = config.deepSeek?.model || 'deepseek-chat';

                    if (!DEEPSEEK_API_KEY) {
                        throw new Error('DeepSeek API Key 未配置');
                    }

                    const response = await fetch(DEEPSEEK_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                        },
                        body: JSON.stringify({
                            model: DEEPSEEK_MODEL,
                            messages: (() => {
                                const messages = [{
                                    role: "system",
                                    content: systemPrompt
                                }];

                                // 如果有品牌列表，添加品牌识别提示
                                if (Array.isArray(brandList) && brandList.length > 0) {
                                    const brandPrompt = `以下是当前配送商的常见品牌词列表：${brandList.join('、')}。

在识别商品名称时，如果商品名称中包含品牌词，请遵循以下规则（优先级最高）：
1. **品牌识别优先级最高**：即使识别出的词在字面意思上是通顺的（如"冬菇"），如果它的发音与品牌库中的品牌（如"东古"）完全一致或极度相似，且上下文符合调料/商品场景，必须优先纠正为品牌名！
2. 将用户语音中的品牌词转换为拼音后，与列表中品牌的拼音比较，寻找读音或结构最接近的项。
3. 如果存在同音、近音或常见错别字，必须输出列表中的标准写法。
4. 当有多个候选时，选择距离最小（发音最接近或编辑距离最短）的品牌。
5. 只有在确认列表中没有合适的对应项时，才保留用户原始品牌词。
6. 品牌词应该包含在商品名称（name字段）中，而不是单独作为备注。

特别注意：
- "一品鲜"、"酱油"、"陈醋"、"生抽"、"老抽"等词前面的通常是品牌名，需要特别注意识别。
- 即使"冬菇"、"紫菱"等词在字面意思上通顺，但在调料/商品场景下，如果发音与品牌列表中的品牌相似，必须优先纠正为品牌名。`;
                                    messages.push({
                                        role: 'system',
                                        content: brandPrompt
                                    });
                                }

                                messages.push({
                                    role: "user",
                                    content: text
                                });

                                return messages;
                            })(),
                            temperature: temperature
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`API 请求失败，状态码: ${response.status}`);
                    }

                    const data = await response.json();

                    // 检查 API 是否返回错误信息
                    if (data.error) {
                        throw new Error(data.error.message || 'API 返回错误');
                    }

                    if (!data.choices || !data.choices[0]) {
                        throw new Error('API 响应格式不正确');
                    }

                    const optimizedText = data.choices[0].message.content;
                    return optimizedText;
                } catch (error) {
                    throw error;
                }
            },

            // ========== Excel 粘贴表格 AI 识别 ==========

            // DeepSeek API 优化文本（用于 Excel 表格数据）
            async optimizeTextWithDeepSeekForTable(userMessage, temperature = 0.2) {
                try {
                    console.log('========== [DeepSeek API] Excel 表格模式开始调用 ==========');
                    console.log('📤 [DeepSeek API] 用户消息长度:', userMessage.length);

                    // 从接口获取 prompt
                    let systemPrompt = '';
                    try {
                        const promptRes = await api.getPromptByKey('OCR_PASTE');
                        console.log('📥 [DeepSeek API] 接口响应:', promptRes);
                        console.log('📥 [DeepSeek API] promptRes.data:', promptRes?.data);

                        if (promptRes && promptRes.data && promptRes.data.code === 0) {
                            // 尝试多种可能的数据结构
                            const promptData = promptRes.data.prompt || promptRes.data.data;

                            console.log('📥 [DeepSeek API] promptData:', promptData);
                            console.log('📥 [DeepSeek API] promptData 类型:', typeof promptData);

                            if (promptData) {
                                // 如果 promptData 是一个对象，尝试获取其内容字段
                                if (typeof promptData === 'object') {
                                    systemPrompt = promptData?.promptContent ||
                                        promptData?.content ||
                                        promptData?.prompt ||
                                        promptData?.text ||
                                        promptData?.value ||
                                        JSON.stringify(promptData);
                                } else if (typeof promptData === 'string') {
                                    // 如果 promptData 本身就是字符串
                                    systemPrompt = promptData;
                                }
                            }

                            if (systemPrompt) {
                                console.log('✅ [DeepSeek API] 成功从接口获取 prompt，长度:', systemPrompt.length);
                                console.log('✅ [DeepSeek API] 从接口获取的 prompt（前500字符）:', systemPrompt.substring(0, 500));
                            } else {
                                console.warn('⚠️ [DeepSeek API] 接口返回数据中未找到 prompt 内容');
                                console.warn('⚠️ [DeepSeek API] 完整响应数据:', JSON.stringify(promptRes.data, null, 2));
                                throw new Error('未找到 prompt 内容');
                            }
                        } else {
                            console.warn('⚠️ [DeepSeek API] 接口返回格式不正确，使用默认 prompt');
                            console.warn('⚠️ [DeepSeek API] 响应数据:', promptRes?.data);
                            throw new Error('接口返回格式不正确');
                        }
                    } catch (promptError) {
                        console.error('❌ [DeepSeek API] 获取 prompt 失败，使用默认 prompt:', promptError);
                        // 如果接口获取失败，使用默认的 prompt（作为后备方案）
                        systemPrompt = `你是一个【生鲜订单 Excel（CSV）解析引擎】。
输入为 CSV 格式的 Excel 表格文本（第一行通常是表头）。你的输出将直接用于真实下单，请严格遵守以下规则。

==============================
【P0 级｜绝对禁止规则（最高优先级）】
==============================

1) 你【绝对不允许】因为不确定、列名混乱、内容不规范等原因，丢弃任何可能的订单行。
2) Excel 数据被视为"人工输入/导出的结构化数据"，你【不需要 OCR 纠错】，也【不需要 rawName】。
3) 你必须只输出 JSON，不得输出任何解释、分析、注释文字。

==============================
【P1 级｜输入与识别任务】
==============================

- 输入是 CSV 文本：用逗号分隔列；第一行通常是表头。
- 你要做两件事：
  A) 识别列映射 columnMapping：哪一列是商品名称、订货数量、订货单位/规格、备注（可能不存在）。
  B) 将每一行转换为结构化订单条目 data[]。

==============================
【P1.1 级｜列映射规则】
==============================

你需要尽量识别以下字段对应的列（列字母从左到右 A、B、C、D...）：

- 商品名称列（必选）：可能的表头关键词：
  "商品", "商品名称", "品名", "名称", "物料", "货品", "货名"

- 订货数量列（尽量识别）：可能关键词：
  "数量", "订货数量", "下单数量", "订购数量", "要货", "件数", "数"

- 订货单位/规格列（尽量识别）：可能关键词：
  "单位", "规格", "订货规格", "订货单位", "计量单位", "规格单位"

- 备注列（可选）：可能关键词：
  "备注", "说明", "要求", "备注信息"

注意：
- 有些表会把"数量+单位"合在一列，例如 "15斤"、"6箱"。你必须能识别这种情况，并拆分 quantity/spec。
- 有些表会把包装结构写在"商品名称列"或"规格列"里（例如：伊利优酸乳250ml/盒*36/箱），你必须解析。

==============================
【P1.2 级｜行有效性规则（不丢行）】
==============================

- 如果某一行商品名称为空，但其他列有内容：仍输出该行，name 置为空字符串，note 写明"商品名缺失"。
- 如果某一行明显是表头重复/小计/合计/空行：
  - 允许跳过"完全空行"
  - 但若含商品相关文本则不得跳过（宁可输出并在 note 标注"疑似非订单行"）

==============================
【P1.5 级｜包装规格与大包装结构解析（必须执行）】
==============================

当"商品名称"或"规格/单位"字段中包含包装结构时，你必须识别并拆解以下字段：

- standardWeight：规格重量（如 250ml、1.9L、5L、500g、10kg）
- itemUnit：最小包装单位（如 盒、瓶、袋、听、包、杯）
- itemsPerCarton：每个大包装中包含的小包装数量（如 36、24、12）
- cartonUnit：大包装单位（如 箱、件、提、包）

【典型结构模式（只允许按字形与结构匹配，原样提取，禁止猜测）】

A) 重量/容量 + /小单位 + *数量 + /大单位
   示例：伊利优酸乳250ml/盒*36/箱
   -> standardWeight="250ml"
   -> itemUnit="盒"
   -> itemsPerCarton="36"
   -> cartonUnit="箱"

B) 重量/容量 + 小单位 + *数量 + 大单位（斜杠可能缺失）
   示例：250ml盒*36箱

C) 乘号的多种 OCR/文本形式必须识别为包装结构：
   "*", "x", "X", "×", "乘"

【名称清洗规则（必须执行）】
- 输出 name 时，必须尽量为"纯商品名"，将包装结构从名称中剥离：
  原：伊利优酸乳250ml/盒*36/箱
  name：伊利优酸乳
【与下单数量的关系（重要）】
- quantity/spec 表示"本行订货数量与订货单位"，不得被包装结构覆盖。
- 包装结构 ≠ 下单数量。
- 若本行没有明确的订货数量（只有商品名+包装结构），仍输出条目，quantity/spec 允许为空，但包装字段必须提取。

【无法识别时】
- 若不满足上述结构模式，standardWeight/itemUnit/itemsPerCarton/cartonUnit 全部输出空字符串。
- 严禁根据常识推测"36/箱"之类的值。

==============================
【P1.6 级｜商品名称清洗规则（数据库搜索专用｜必须执行）】
==============================

【一】括号内容处理规则（强制）

1. name 字段中【绝对不允许】出现任何括号及括号内内容。
   包括但不限于：() （） [] 【】。

2. 业务约束（不可忽略）：
   - name 字段将用于数据库商品精确搜索；
   - 括号内容会导致搜索失败，必须清洗。

示例：
- name = "香蕉(进口)"
  -> name = "香蕉"

- name = "柠檬(进口) Lemon"
  -> note = "进口"

【二】英文内容去留判定规则（必须判断）

当商品名称中包含英文或英文字母时，你必须判断其业务含义，仅允许以下两种情况之一：

A) 英文仅为中文翻译 / 说明（必须删除）

满足以下任一条件时：
- 英文与中文语义一致，仅为翻译；
- 英文是类别或说明性词汇（如 Vegetable / Fruit / Fungus / Lettuce 等）；
- 删除英文不会影响商品在数据库中的唯一性。

处理规则：
- 英文必须从 name 中删除；
- 不要求写入 note（除非英文本身有额外业务含义）。

示例：
- "黄瓜 Cucumber" -> name = "黄瓜"
- "彩椒 Vegetable" -> name = "彩椒"
- "杏鲍菇 Fungus" -> name = "杏鲍菇"
- "罗马生菜 Lettuce" -> name = "罗马生菜"

B) 英文 / 字母代表型号 / 等级 / 系列 / 业务区分（必须保留）

满足以下任一条件时：
- 英文用于区分型号、等级、系列、版本；
- 删除英文会导致商品无法唯一识别；
- 英文不是翻译，而是商品业务属性的一部分。

处理规则：
- 英文必须保留在 name 中。

示例：
- "V9酸奶" -> name = "V9酸奶"
- "牛奶 UHT" -> name = "牛奶UHT"
- "A果苹果" -> name = "A果苹果"
- "AB级牛肉" -> name = "AB级牛肉"

==============================
【P2 级｜字段输出规范（与 OCR 输出对齐）】
==============================

data[] 中每条订单对象必须包含字段：

- name：最终下单商品名（尽量为纯商品名）
- quantity：订货数量（字符串）
- spec：订货单位（斤/把/箱/件/袋/瓶...）
- standardWeight：规格重量（字符串）
- itemUnit：最小包装单位（字符串）
- itemsPerCarton：每箱小包装数量（字符串）
- cartonUnit：大包装单位（字符串）
- note：备注（只放 Excel 原始备注或额外说明；不输出系统推理）

补充规则：
- 如果"数量列"里是 15斤 / 6箱 这种：拆分 quantity="15" spec="斤"
- 如果 spec 列里出现 "桶(1.9L)" 这种：spec="桶"，standardWeight="1.9L"
- 如果备注列不存在：note 输出空字符串

==============================
【P0 级｜JSON 返回格式要求（必须严格遵守）】
==============================

你必须返回标准 JSON 对象，格式如下（字段名必须一致）：

{
  "columnMapping": {
    "商品名称": "A",
    "订货数量": "B",
    "订货规格": "C",
    "备注": "D"
  },
  "data": [
    {
      "name": "",
      "quantity": "",
      "spec": "",
      "standardWeight": "",
      "itemUnit": "",
      "itemsPerCarton": "",
      "cartonUnit": "",
      "note": ""
    }
  ]
}

要求：
- columnMapping 必须给出列字母（A/B/C...），如果某字段找不到，对应值输出空字符串 ""。
- data 数组必须包含所有有效订单行。
- 只输出 JSON，不要输出任何其他文字。`;
                    }

                    // 动态导入 config
                    const configModule = await import('@/config/index');
                    const config = configModule.default;
                    const DEEPSEEK_API_KEY = config.deepSeek?.apiKey || '';
                    const DEEPSEEK_API_URL = config.deepSeek?.apiUrl || 'https://api.deepseek.com/v1/chat/completions';
                    const DEEPSEEK_MODEL = config.deepSeek?.model || 'deepseek-chat';

                    if (!DEEPSEEK_API_KEY) {
                        throw new Error('DeepSeek API Key 未配置');
                    }

                    console.log('📋 [DeepSeek API] 系统 Prompt 长度:', systemPrompt.length);
                    console.log('📋 [DeepSeek API] 系统 Prompt（完整内容）:', systemPrompt);
                    console.log('📋 [DeepSeek API] 用户消息长度:', userMessage.length);
                    console.log('📋 [DeepSeek API] 用户消息（完整内容）:', userMessage);
                    console.log('📋 [DeepSeek API] Temperature:', temperature);
                    console.log('📋 [DeepSeek API] 模型:', DEEPSEEK_MODEL);
                    console.log('📋 [DeepSeek API] API URL:', DEEPSEEK_API_URL);

                    const requestBody = {
                        model: DEEPSEEK_MODEL,
                        messages: [
                            {
                                role: "system",
                                content: systemPrompt
                            },
                            {
                                role: "user",
                                content: userMessage
                            }
                        ],
                        temperature: temperature
                    };

                    console.log('📤 [DeepSeek API] 完整请求体:', JSON.stringify(requestBody, null, 2));

                    const response = await fetch(DEEPSEEK_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        throw new Error(`API 请求失败，状态码: ${response.status}`);
                    }

                    const data = await response.json();

                    // 检查 API 是否返回错误信息
                    if (data.error) {
                        throw new Error(data.error.message || 'API 返回错误');
                    }

                    if (!data.choices || !data.choices[0]) {
                        throw new Error('API 响应格式不正确');
                    }

                    const optimizedText = data.choices[0].message.content;
                    console.log('✅ [DeepSeek API] 返回内容长度:', optimizedText.length);
                    console.log('✅ [DeepSeek API] 返回内容（前500字符）:', optimizedText.substring(0, 500));
                    return optimizedText;
                } catch (error) {
                    throw error;
                }
            },

            // 解析 Excel 粘贴表格的 AI 识别结果为订单
            parseExcelPasteOrders(optimizedText) {
                if (!optimizedText || !optimizedText.trim()) {
                    return [];
                }

                // 确定要使用的部门ID
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                // 解析 JSON 结果
                let resultJson = null;
                let ordersData = [];
                try {
                    let jsonStr = optimizedText.trim();
                    // 移除可能的 markdown 代码块标记
                    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
                    jsonStr = jsonStr.trim();

                    // 尝试解析 JSON
                    resultJson = JSON.parse(jsonStr);

                    // 检查返回格式：可能是 {columnMapping, data} 或直接是数组
                    if (resultJson && typeof resultJson === 'object') {
                        if (resultJson.data && Array.isArray(resultJson.data)) {
                            // 新格式：包含 columnMapping 和 data
                            ordersData = resultJson.data;
                            console.log('✅ [parseExcelPasteOrders] 解析到列映射:', resultJson.columnMapping);
                        } else if (Array.isArray(resultJson)) {
                            // 旧格式：直接是数组
                            ordersData = resultJson;
                        } else {
                            throw new Error('返回的 JSON 格式不正确');
                        }
                    } else {
                        throw new Error('返回的不是有效的 JSON 对象');
                    }

                    if (!ordersData || ordersData.length === 0) {
                        throw new Error('返回的数据数组为空');
                    }
                } catch (jsonError) {
                    console.error('❌ [parseExcelPasteOrders] JSON 解析失败:', jsonError);
                    console.error('❌ [parseExcelPasteOrders] 返回的原始内容:', optimizedText);
                    throw new Error('AI 返回的数据格式不正确：' + jsonError.message);
                }

                // 转换为系统需要的完整订单项格式
                // 注意：兼容两种字段格式
                // 1. Excel 格式：name, quantity, spec, standardWeight, itemUnit, itemsPerCarton, cartonUnit, note
                // 2. OCR 粘贴格式：name, qty, unit, standardWeight, itemUnit, itemsPerCarton, cartonUnit, remark
                const formattedOrders = ordersData.map(item => {
                    // 兼容数量字段：quantity 或 qty
                    const quantity = item.quantity || item.qty || '';
                    // 兼容规格/单位字段：spec 或 unit
                    const spec = item.spec || item.unit || '';
                    // 兼容备注字段：note 或 remark
                    const note = item.note || item.remark || '';

                    return {
                        nxDoGoodsName: item.name || '',
                        nxDoGoodsNameOriginal: item.name || '',
                        nxDoQuantity: quantity,
                        nxDoStandard: spec,
                        nxDoRemark: note,
                        nxDoAddRemark: !!(note && note.trim()),
                        // Excel 特有字段
                        standardWeight: item.standardWeight || '',
                        itemUnit: item.itemUnit || '',
                        itemsPerCarton: item.itemsPerCarton || '',
                        cartonUnit: item.cartonUnit || '',
                        // 完整字段（参考 parseTextToOrders）
                        nxDoStatus: -2, // 草稿状态（注意：这里是 -2，不是 -1）
                        nxDoDepartmentId: targetDepId,
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoDisGoodsId: null,
                        nxDoStandardWarn: 0,
                        goodsNameWarn: 0,
                        nxDoDistributerId: this.disUser?.nxDiuDistributerId,
                        nxDoPurchaseUserId: -1,
                        nxDoOrderUserId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId,
                        nxDoIsAgent: -1,
                    };
                });

                // 过滤掉无效订单
                const validOrders = formattedOrders.filter(order =>
                    order.nxDoGoodsName && order.nxDoGoodsName.trim()
                );

                console.log('✅ [parseExcelPasteOrders] 有效订单数量:', validOrders.length);
                console.log('✅ [parseExcelPasteOrders] 转换后的订单项:', validOrders);

                return validOrders;
            },

            // AI 识别 Excel 粘贴表格数据（统一处理方法）
            async aiRecogniseExcelPasteTable(csvData, userPrompt = '') {
                try {
                    console.log('========== [AI识别 Excel粘贴] 开始执行 ==========');
                    console.log('📋 [AI识别] CSV 数据长度:', csvData?.length);
                    console.log('📋 [AI识别] CSV 数据（前500字符）:', csvData?.substring(0, 500));
                    console.log('📝 [AI识别] 用户附加 Prompt:', userPrompt || '(无)');

                    if (!csvData || !csvData.trim()) {
                        throw new Error('CSV 数据为空');
                    }

                    // 构建用户消息：附加 prompt（如果有）+ CSV 数据
                    let userMessage = '';
                    if (userPrompt && userPrompt.trim()) {
                        userMessage = userPrompt.trim() + '\n\n';
                    }
                    userMessage += '表格数据：\n' + csvData;

                    console.log('📤 [AI识别] 构建的完整用户消息长度:', userMessage.length);
                    console.log('📤 [AI识别] 构建的完整用户消息（前1000字符）:', userMessage.substring(0, 1000));
                    if (userMessage.length > 1000) {
                        console.log('📤 [AI识别] 构建的完整用户消息（后500字符）:', userMessage.substring(userMessage.length - 500));
                    }

                    // 调用 DeepSeek API
                    const optimizedText = await this.optimizeTextWithDeepSeekForTable(userMessage);

                    console.log('✅ [AI识别] AI 识别完成，返回内容长度:', optimizedText.length);
                    console.log('✅ [AI识别] 返回内容（前500字符）:', optimizedText.substring(0, 500));

                    // 解析结果为订单
                    const orderItems = this.parseExcelPasteOrders(optimizedText);

                    console.log('✅ [AI识别] 成功解析订单数量:', orderItems.length);

                    return orderItems;
                } catch (error) {
                    console.error('❌ [AI识别 Excel粘贴] 识别失败:', error);
                    throw error;
                }
            },

            // 从剪贴板粘贴
            async pasteFromClipboard() {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                try {
                    const text = await navigator.clipboard.readText();
                    this.pasteInputText = text;
                    this.pasteInputContent = text;
                } catch (error) {
                    await this.$refs.alertDialog.alert('', 'warning');
                }
            },

            // 解析粘贴文本为订单
            async parsePasteText() {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                if (!this.pasteInputText || !this.pasteInputText.trim()) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                if (!this.selectedAllCustomer) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                // 检查是否选择了子部门（如果有子部门的话）
                if (!(await this.checkSubDepartmentSelected())) {
                    return;
                }

                // 如果是第一次解析，保存原始文本（用于重新粘贴）
                if (!this.pasteOriginText) {
                    this.pasteOriginText = this.pasteInputText;
                }

                // 直接解析文本（parseTextToOrders 会使用 selectedSubDepartment）
                this.parseTextToOrders(this.pasteInputText, null);
            },

            // 清除粘贴文本
            clearPasteText() {
                this.pasteInputText = '';
            },

            // 重新粘贴（清空草稿订单和文本内容）
            againPaste() {


                // 重置相关状态（清空文本内容和订单）
                this.orderItems = [];
                this.pasteInvalidLineIndices = [];
                this.pasteInvalidSegments = [];
                this.pasteNoValidOrder = false;

            },

            // ========== 文本解析为订单（复制粘贴模式专用）==========

            // 解析文本为订单（复制粘贴模式专用）
            async parseTextToOrders(text, depId = null) {
                if (!text || !text.trim()) {
                    return;
                }

                // 确定要使用的部门ID（优先使用传入的depId，否则使用selectedSubDepartment，最后使用selectedAllCustomer）
                const targetDepId = depId || this.selectedSubDepartment || this.selectedAllCustomer;


                // 优先尝试解析 JSON（AI 返回的格式）
                try {
                    let jsonStr = text.trim();
                    // 移除可能的 markdown 代码块标记
                    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
                    jsonStr = jsonStr.trim();

                    // 尝试解析 JSON
                    const ordersJson = JSON.parse(jsonStr);

                    if (Array.isArray(ordersJson) && ordersJson.length > 0) {

                        // 转换为系统需要的格式（含 AI 返回的 standardWeight、itemUnit、itemsPerCarton、cartonUnit）
                        this.orderItems = ordersJson.map(item => ({
                            nxDoGoodsName: item.name || '',
                            nxDoGoodsNameOriginal: item.name || '',
                            nxDoQuantity: item.qty || '',
                            nxDoStandard: item.unit || '斤',
                            nxDoRemark: item.remark || '',
                            nxDoAddRemark: !!(item.remark && item.remark.trim()),
                            standardWeight: item.standardWeight ?? '',
                            itemUnit: item.itemUnit ?? '',
                            itemsPerCarton: item.itemsPerCarton ?? '',
                            cartonUnit: item.cartonUnit ?? '',
                            nxDoStatus: -2,
                            nxDoDepartmentId: targetDepId, // 使用确定的部门ID
                            nxDoDepartmentFatherId: this.selectedAllCustomer,
                            nxDoDisGoodsId: null,
                            nxDoStandardWarn: 0,
                            goodsNameWarn: 0,
                            nxDoDistributerId: this.disUser?.nxDiuDistributerId,
                            nxDoPurchaseUserId: -1,
                            nxDoOrderUserId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId,
                            nxDoIsAgent: -1,
                        }));

                        // 设置复制粘贴模式的订单列表
                        // this.orderItems = formattedOrders;
                        this.pasteSaveCount = null; // 新解析的订单都是未保存的草稿，所以 saveCount 为 null

                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                        return;
                    }
                } catch (jsonError) {
                    await this.$refs.alertDialog.alert("订单格式不正确！")
                    console.log('[parseTextToOrders] JSON 解析失败，使用正则解析:', jsonError.message);
                }

                // JSON 解析失败，使用正则解析
                const content = text
                    .replace(/(\d)\s+/g, '$1') // 处理数字后的空格
                    .replace(/[^\S\r\n]+/g, ' '); // 只替换水平空白，保留换行符

                const orders = this._formatOrderContent(content, targetDepId);

                // 设置复制粘贴模式的订单列表
                this.orderItems = orders;
                // 注意：不设置 pasteHasCache，因为此时还没有保存缓存
                // pasteHasCache 只在从缓存加载或保存缓存后设置为 true
                this.pasteSaveCount = null; // 新解析的订单都是未保存的草稿，所以 saveCount 为 null

                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();
            },

            // 格式化订单内容（参考 paste.js 的 _formatOrderContent，简化版）
            _formatOrderContent(content, depId = null) {
                // 确定要使用的部门ID
                const targetDepId = depId || this.selectedSubDepartment || this.selectedAllCustomer;
                let orders = [];

                // 按行拆分
                let lines = content.split(/\r?\n/);

                // 过滤无效行
                lines = lines.filter(line => {
                    line = line.trim();
                    if (!line) return false;
                    if (/^备注[:：]/.test(line)) return true;

                    let orderRegex = /^\d+[、，\.．]\s*(.+?)[:：]\s*(.+)$/;
                    if (orderRegex.test(line)) return true;

                    let commaRegex = /^(.*?)\s*[\,，]\s*(.+)$/;
                    if (commaRegex.test(line)) return true;

                    let hasNumber = /[\d零一二两三四五六七八九十百千万半]/.test(line);
                    return hasNumber;
                });

                // 中文数字转阿拉伯数字
                function chineseNumberToArabic(chineseNum) {
                    const map = {
                        '零': 0, '一': 1, '二': 2, '两': 2, '三': 3,
                        '四': 4, '五': 5, '六': 6, '七': 7, '八': 8,
                        '九': 9, '十': 10, '百': 100, '千': 1000,
                        '万': 10000, '半': 0.5
                    };
                    let result = 0, temp = 0;
                    for (let i = 0; i < chineseNum.length; i++) {
                        const char = chineseNum[i];
                        if (char === '半') {
                            result += 0.5;
                        } else if (map[char] >= 10) {
                            if (temp === 0) temp = 1;
                            result += temp * map[char];
                            temp = 0;
                        } else if (map[char] !== undefined) {
                            temp = temp * 10 + map[char];
                        }
                    }
                    result += temp;
                    return result;
                }

                // 从尾部解析「名称 + 括号备注 + 数量+单位」
                function parseSegmentEndOfLine(segment) {
                    segment = segment.trim().replace(/[,，、。.]+$/g, '');

                    const bracketRegex = /(?:（|\(|【)(.+?)(?:）|\)|】)/;
                    let remarkText = '';
                    const bracketMatch = segment.match(bracketRegex);
                    if (bracketMatch) {
                        remarkText = bracketMatch[1];
                        segment = segment.replace(bracketRegex, '').trim();
                    }

                    const hasArabic = /[0-9]/.test(segment);
                    let name = segment, qtyVal = '', qtyUnit = '', regex;

                    if (hasArabic) {
                        regex = /^(.*?)([\d\.]+)(\S*)$/;
                    } else {
                        regex = /^(.*?)([一二两三四五六七八九十百千万半]+)(\S*)$/;
                    }
                    const m = segment.match(regex);
                    if (m) {
                        let potentialName = m[1].trim().replace(/\s+/g, '');
                        let potentialQty = m[2].trim();
                        let potentialUnit = m[3].trim();
                        name = potentialName;

                        // 数量值
                        if (/^[\d\.]+$/.test(potentialQty)) {
                            qtyVal = potentialQty;
                        } else {
                            qtyVal = chineseNumberToArabic(potentialQty).toString();
                        }

                        // 单位列表
                        const validUnits = ['斤', '个', '包', '根', '棵', '条', '盒', '捆', '袋', '跟', '块', '瓶', '罐', '桶', '箱', '件'];
                        let foundUnit = '';
                        for (let u of validUnits) {
                            if (potentialUnit.startsWith(u)) {
                                foundUnit = u;
                                break;
                            }
                        }
                        if (foundUnit) {
                            qtyUnit = foundUnit;
                        } else {
                            qtyUnit = potentialUnit || '斤'; // 默认单位
                        }
                    }

                    return {
                        nxDoGoodsName: name,
                        nxDoGoodsNameOriginal: name,
                        nxDoQuantity: qtyVal,
                        nxDoStandard: qtyUnit,
                        nxDoRemark: remarkText,
                    };
                }

                // 逐行处理
                lines.forEach(line => {
                    line = line.trim();
                    if (!line) return;

                    if (/^备注[:：]/.test(line)) {
                        if (orders.length) {
                            let last = orders[orders.length - 1];
                            last.nxDoRemark = (last.nxDoRemark || '') + ' ' + line.replace(/^备注[:：]/, '').trim();
                        }
                        return;
                    }

                    // 尝试解析
                    let parsed = parseSegmentEndOfLine(line);
                    if (parsed && parsed.nxDoQuantity) {
                        orders.push({
                            ...parsed,
                            nxDoAddRemark: !!parsed.nxDoRemark,
                            nxDoStatus: -2,
                            nxDoDepartmentId: targetDepId, // 使用确定的部门ID
                            nxDoDepartmentFatherId: this.selectedAllCustomer,
                            nxDoDisGoodsId: null,
                            nxDoStandardWarn: 0,
                            goodsNameWarn: 0,
                            nxDoDistributerId: this.disUser?.nxDiuDistributerId,
                            nxDoPurchaseUserId: -1,
                            nxDoOrderUserId: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId,
                            nxDoIsAgent: -1,
                        });
                    }
                });

                // 过滤掉无效订单
                const validOrders = orders.filter(order =>
                    order.nxDoGoodsName && order.nxDoGoodsName.trim() && order.nxDoQuantity
                );

                return validOrders;
            },


            // ========== 转订单相关方法 ==========

            // 加载客户文件夹路径
            async loadCustomerFolderPath() {
                if (!window.electronAPI || !this.selectedAllCustomer) {
                    return;
                }

                if (typeof window.electronAPI.getCustomerFolderPath !== 'function') {
                    console.warn('getCustomerFolderPath API 不可用，请重启应用');
                    return;
                }

                try {
                    // 确定要加载的客户ID（如果有子部门且已选择，使用子部门ID；否则使用主客户ID）
                    const hasSubDepartments = this.selectedCustomerEntity &&
                        this.selectedCustomerEntity.nxDepartmentEntities &&
                        Array.isArray(this.selectedCustomerEntity.nxDepartmentEntities) &&
                        this.selectedCustomerEntity.nxDepartmentEntities.length > 0;
                    const targetCustomerId = hasSubDepartments && this.selectedSubDepartment
                        ? this.selectedSubDepartment
                        : this.selectedAllCustomer;

                    const result = await window.electronAPI.getCustomerFolderPath(
                        targetCustomerId
                    );


                    if (result.success) {
                        this.customerFolderPath = result.path;
                        // 如果有路径，自动扫描文件
                        if (this.customerFolderPath) {
                            await this.scanFolderFiles();
                        } else {
                            // 如果没有路径，清空文件列表，避免显示旧数据
                            this.autoProcessFiles = [];
                            this.autoProcessImagePreviews = {};
                            this.autoProcessExcelPreviews = {};
                            this.activeProcessedFileTab = null;
                            this.autoProcessImagePreview = null;
                            this.autoProcessImagePreviewFileName = '';
                            this.autoProcessResults = [];
                        }
                    } else {
                        // 获取路径失败，清空文件列表
                        this.customerFolderPath = null;
                        this.autoProcessFiles = [];
                        this.autoProcessImagePreviews = {};
                        this.autoProcessExcelPreviews = {};
                        this.activeProcessedFileTab = null;
                        this.autoProcessImagePreview = null;
                        this.autoProcessImagePreviewFileName = '';
                        this.autoProcessResults = [];
                    }
                } catch (error) {
                    console.error('加载文件夹路径失败:', error);
                }
            },

            // 选择客户文件夹（自动上传订单保存路径）
            async selectCustomerFolder() {
                if (!window.electronAPI) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                if (typeof window.electronAPI.selectFolder !== 'function') {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                try {
                    this.selectingFolder = true;
                    const result = await window.electronAPI.selectFolder();
                    if (result.success && result.path) {
                        const hasSubDepartments = this.selectedCustomerEntity &&
                            this.selectedCustomerEntity.nxDepartmentEntities &&
                            Array.isArray(this.selectedCustomerEntity.nxDepartmentEntities) &&
                            this.selectedCustomerEntity.nxDepartmentEntities.length > 0;
                        const targetCustomerId = hasSubDepartments && this.selectedSubDepartment
                            ? this.selectedSubDepartment
                            : this.selectedAllCustomer;
                        const saveResult = await window.electronAPI.saveCustomerFolderPath(targetCustomerId, result.path);
                        if (saveResult.success) {
                            this.customerFolderPath = result.path;
                            await this.$refs.alertDialog.alert('', 'warning');
                            await this.loadCustomerFolderPath();
                        } else {
                            await this.$refs.alertDialog.alert('保存文件夹路径失败：' + (saveResult.error || '未知错误'));
                        }
                    }
                } catch (error) {
                    console.error('选择文件夹失败:', error);
                    await this.$refs.alertDialog.alert('选择文件夹失败：' + (error && error.message ? error.message : '未知错误'));
                } finally {
                    this.selectingFolder = false;
                }
            },

            // 清除客户文件夹路径
            async clearCustomerFolder() {
                if (!window.electronAPI || typeof window.electronAPI.saveCustomerFolderPath !== 'function') {
                    return;
                }
                if (!await this.$refs.alertDialog.confirm('')) return;
                try {
                    const hasSubDepartments = this.selectedCustomerEntity &&
                        this.selectedCustomerEntity.nxDepartmentEntities &&
                        Array.isArray(this.selectedCustomerEntity.nxDepartmentEntities) &&
                        this.selectedCustomerEntity.nxDepartmentEntities.length > 0;
                    const targetCustomerId = hasSubDepartments && this.selectedSubDepartment
                        ? this.selectedSubDepartment
                        : this.selectedAllCustomer;
                    const result = await window.electronAPI.saveCustomerFolderPath(targetCustomerId, '');
                    if (result.success) {
                        this.customerFolderPath = null;
                        await this.$refs.alertDialog.alert('', 'warning');
                        await this.loadCustomerFolderPath();
                    }
                } catch (error) {
                    console.error('清除文件夹路径失败:', error);
                }
            },

            // 扫描文件夹中的文件
            async scanFolderFiles() {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                try {
                    this.scanningFiles = true;
                    // 在转订单模式下，总是扫描"已处理"文件夹（无论是否有缓存）
                    const includeProcessed = this.uploadType === 'auto';
                    const result = await window.electronAPI.scanFolderFiles(this.customerFolderPath, includeProcessed);

                    if (result.success) {
                        // 初始化文件列表，设置状态为待处理
                        this.autoProcessFiles = result.files.map(file => ({
                            ...file,
                            status: file.isProcessed ? 'processed' : 'pending', // 已处理的文件状态为 'processed'
                            progress: 0,
                            orderCount: 0,
                            error: null
                        }));

                        // 清空之前的结果
                        this.autoProcessResults = [];

                        // 为已处理的图片文件加载完整图片预览
                        this.loadProcessedImagePreviews();

                        // 为已处理的Excel文件加载预览
                        this.loadProcessedExcelPreviews();

                        // 设置默认激活的标签（第一个已处理的文件）
                        const processedFiles = this.autoProcessFiles.filter(f => f.status === 'processed');
                        if (processedFiles.length > 0 && !this.activeProcessedFileTab) {
                            this.activeProcessedFileTab = processedFiles[0].filePath;
                        }

                    } else {
                        await this.$refs.alertDialog.alert('扫描文件夹失败：' + (result.error || '未知错误'));
                    }
                } catch (error) {
                    console.error('扫描文件夹失败:', error);
                    await this.$refs.alertDialog.alert('扫描文件夹失败：' + error.message);
                } finally {
                    this.scanningFiles = false;
                }
            },

            // 开始自动处理
            async startAutoProcess() {
                if (!this.customerFolderPath || this.autoProcessFiles.length === 0) {
                    return;
                }

                // 检查是否选择了子部门
                if (!(await this.checkSubDepartmentSelected())) {
                    return;
                }

                // 确定要使用的部门ID
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                this.processingFiles = true;
                this.autoProcessProgress = {
                    current: 0,
                    total: this.autoProcessFiles.length,
                    percent: 0
                };
                this.autoProcessResults = [];

                // 收集所有成功处理的订单数据
                const allProcessedOrders = [];

                // 逐个处理文件
                for (let i = 0; i < this.autoProcessFiles.length; i++) {
                    const file = this.autoProcessFiles[i];

                    // 更新进度
                    this.autoProcessProgress.current = i + 1;
                    this.autoProcessProgress.percent = Math.round(
                        ((i + 1) / this.autoProcessFiles.length) * 100
                    );

                    // 更新文件状态为处理中
                    file.status = 'processing';
                    file.progress = 50;

                    try {
                        let result;

                        if (file.fileType === 'excel') {
                            // 处理 Excel 文件
                            result = await this.processExcelFile(file, targetDepId);
                        } else if (file.fileType === 'image') {
                            // 处理图片文件
                            result = await this.processImageFile(file, targetDepId);
                        } else {
                            throw new Error('不支持的文件类型');
                        }

                        // 处理成功
                        file.status = 'success';
                        file.progress = 100;
                        file.orderCount = result.orderCount || 0;

                        // 收集订单数据（如果有）
                        if (result.orders && Array.isArray(result.orders) && result.orders.length > 0) {
                            // 为每个订单添加来源文件信息
                            const ordersWithSource = result.orders.map(order => ({
                                ...order,
                                sourceFile: file.fileName, // 记录来源文件
                                sourceFileType: file.fileType // 记录文件类型
                            }));
                            allProcessedOrders.push(...ordersWithSource);
                        }

                        // 移动到"已处理"文件夹
                        const moveResult = await window.electronAPI.moveFileToProcessed(
                            file.filePath,
                            this.customerFolderPath
                        );

                        if (moveResult.success) {
                            // 添加到结果列表
                            this.autoProcessResults.push({
                                fileName: file.fileName,
                                success: true,
                                orderCount: result.orderCount || 0
                            });
                        } else {
                            console.warn('移动文件失败:', moveResult.error);
                            // 即使移动失败，也记录为成功（因为订单已处理）
                            this.autoProcessResults.push({
                                fileName: file.fileName,
                                success: true,
                                orderCount: result.orderCount || 0,
                                warning: '文件移动失败，但订单已处理'
                            });
                        }

                    } catch (error) {
                        // 处理失败
                        file.status = 'error';
                        file.error = error.message || '未知错误';

                        // 添加到结果列表（失败）
                        this.autoProcessResults.push({
                            fileName: file.fileName,
                            success: false,
                            error: error.message || '未知错误'
                        });

                        console.error(`处理文件 ${file.fileName} 失败:`, error);
                    }
                }

                this.processingFiles = false;

                // 如果有处理成功的订单，显示在右侧
                if (allProcessedOrders.length > 0) {
                    // 合并到现有订单列表（如果已有订单，追加；否则替换）
                    if (this.orderItems.length > 0) {
                        // 追加到现有订单
                        this.orderItems = [...this.orderItems, ...allProcessedOrders];
                    } else {
                        // 替换订单列表
                        this.orderItems = allProcessedOrders;
                    }

                    // 重置搜索和匹配商品列表状态
                    this.resetSearchAndMatchedGoodsState();

                    // 切换到显示订单列表（确保右侧显示订单）
                    console.log(`✅ 转订单完成，共处理 ${allProcessedOrders.length} 条订单`);
                }

                // 显示处理完成提示
                const successCount = this.autoProcessResults.filter(r => r.success).length;
                const failCount = this.autoProcessResults.length - successCount;
                const orderCount = allProcessedOrders.length;
                await this.$refs.alertDialog.alert(`处理完成！成功：${successCount}，失败：${failCount}${orderCount > 0 ? `，共 ${orderCount} 条订单已显示在右侧` : ''}`);

                // 处理完成后，重新扫描文件夹（包括已处理文件夹），以便显示已处理的文件
                if (this.customerFolderPath) {
                    // 延迟一下，确保文件移动操作已完成
                    setTimeout(async () => {
                        try {
                            // 使用 scanFolderFiles 方法，确保状态正确更新
                            await this.scanFolderFiles();
                            // scanFolderFiles 方法已经更新了文件列表、预览和激活标签，无需额外处理
                        } catch (error) {
                            console.error('重新扫描已处理文件夹失败:', error);
                        }
                    }, 500); // 延迟500ms，确保文件移动操作完成
                }

                // 通知父组件刷新客户列表
                this.$emit('order-saved');
            },

            // 处理 Excel 文件
            async processExcelFile(file, targetDepId) {
                if (!window.electronAPI) {
                    throw new Error('Electron API 不可用');
                }

                // 读取文件
                const readResult = await window.electronAPI.readFile(file.filePath);
                if (!readResult.success) {
                    throw new Error('读取文件失败：' + readResult.error);
                }

                // 将 base64 转换为 Blob
                const byteCharacters = atob(readResult.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });

                // 创建 File 对象
                const fileObj = new File([blob], readResult.fileName, {
                    type: blob.type
                });

                // 创建 FormData
                const formData = new FormData();
                formData.append('file', fileObj);
                formData.append('depId', targetDepId);
                formData.append('depFatherId', this.selectedAllCustomer);
                formData.append('disId', this.disUser.nxDiuDistributerId);
                formData.append('userId', this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1);

                // 调用 Excel 解析接口
                const res = await api.recognizeOrderFromExcel(formData);

                if (res && res.data) {
                    if (res.data.code === 200 || res.data.code === 0) {
                        this.currentTaskId = res.data.taskId;
                        this.currentTask = res.data.task;
                        this.orderItems = res.data.items;
                    } else {
                        throw new Error(res.data.msg || 'Excel解析失败');
                    }
                } else {
                    throw new Error('接口返回数据异常');
                }
            },

            // 处理图片文件
            async processImageFile(file, targetDepId) {
                if (!window.electronAPI) {
                    throw new Error('Electron API 不可用');
                }

                // 读取文件
                const readResult = await window.electronAPI.readFile(file.filePath);
                if (!readResult.success) {
                    throw new Error('读取文件失败：' + readResult.error);
                }

                // 使用 base64 数据（已经是 base64 格式）
                const imageBase64 = readResult.data;

                // 调用 OCR 识别接口
                const ocrData = {
                    ImageBase64: imageBase64,
                    depId: targetDepId,
                    depFatherId: this.selectedAllCustomer,
                    disId: this.disUser.nxDiuDistributerId,
                    userId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
                };

                const res = await api.recognizeOrderOCR(ocrData);

                if (res && res.data && res.data.code === 0) {
                    // 检查是否返回了已保存的订单
                    this.orderCount = res.data.data.length;
                    console.log("Rrrrrrrccccc", res);
                    this.currentTaskId = res.data.taskId;
                    this.currentTask = res.data.task;
                    this.orderItems = res.data.items;
                    if (res.data.taskId != null) this.$emit('task-added');
                }
            },

            // 清除转订单模式下的图片预览
            clearAutoProcessImagePreview() {
                this.autoProcessImagePreview = null;
                this.autoProcessImagePreviewFileName = '';
                // 重置图片变换
                this.imageScale = 1;
                this.imageTranslateX = 0;
                this.imageTranslateY = 0;
                this.isDragging = false;
            },

            // 为已处理的图片文件加载完整图片预览
            async loadProcessedImagePreviews() {
                if (!window.electronAPI) {
                    return;
                }

                if (typeof window.electronAPI.readFile !== 'function') {
                    return;
                }

                // 筛选出已处理的图片文件
                const processedImageFiles = this.autoProcessFiles.filter(
                    file => file.fileType === 'image' && file.status === 'processed'
                );

                // 确保 autoProcessImagePreviews 已初始化
                if (!this.autoProcessImagePreviews) {
                    this.autoProcessImagePreviews = {};
                }

                // 并发加载所有图片
                const loadPromises = processedImageFiles.map(async (file) => {
                    // 如果已经有预览，跳过
                    if (this.autoProcessImagePreviews && this.autoProcessImagePreviews[file.filePath]) {
                        return;
                    }

                    try {
                        const result = await window.electronAPI.readFile(file.filePath);

                        if (result.success && result.data) {
                            // 将 Base64 转换为 data URL
                            let imageBase64 = result.data;
                            if (!imageBase64.startsWith('data:')) {
                                const ext = file.fileName.toLowerCase().split('.').pop();
                                const mimeTypes = {
                                    'jpg': 'image/jpeg',
                                    'jpeg': 'image/jpeg',
                                    'png': 'image/png',
                                    'gif': 'image/gif',
                                    'bmp': 'image/bmp',
                                    'webp': 'image/webp'
                                };
                                const mimeType = mimeTypes[ext] || 'image/jpeg';
                                imageBase64 = `data:${mimeType};base64,${imageBase64}`;
                            }

                            // Vue 3 中直接赋值即可，不需要 $set
                            if (!this.autoProcessImagePreviews) {
                                this.autoProcessImagePreviews = {};
                            }
                            this.autoProcessImagePreviews[file.filePath] = imageBase64;
                        }
                    } catch (error) {
                        console.error('加载图片预览失败:', file.fileName, error);
                        // 不显示错误，静默失败
                    }
                });

                // 等待所有图片加载完成（不阻塞UI）
                Promise.all(loadPromises).catch(error => {
                    console.error('批量加载图片预览时出错:', error);
                });
            },

            // 处理图片预览加载错误
            handleImagePreviewError(filePath) {
                // 如果图片加载失败，从缓存中移除，以便重新加载
                if (this.autoProcessImagePreviews && this.autoProcessImagePreviews[filePath]) {
                    // Vue 3 中直接删除即可，不需要 $delete
                    delete this.autoProcessImagePreviews[filePath];
                }
            },

            // 为已处理的Excel文件加载预览
            async loadProcessedExcelPreviews() {
                if (!window.electronAPI) {
                    return;
                }

                if (typeof window.electronAPI.readFile !== 'function') {
                    return;
                }

                // 动态导入 xlsx 库
                let XLSX;
                try {
                    XLSX = await import('xlsx');
                } catch (error) {
                    console.error('无法加载 xlsx 库:', error);
                    return;
                }

                // 筛选出已处理的Excel文件
                const processedExcelFiles = this.autoProcessFiles.filter(
                    file => file.fileType === 'excel' && file.status === 'processed'
                );

                // 确保 autoProcessExcelPreviews 已初始化
                if (!this.autoProcessExcelPreviews) {
                    this.autoProcessExcelPreviews = {};
                }

                // 并发加载所有Excel文件
                const loadPromises = processedExcelFiles.map(async (file) => {
                    // 如果已经有预览，跳过
                    if (this.autoProcessExcelPreviews && this.autoProcessExcelPreviews[file.filePath]) {
                        return;
                    }

                    try {
                        const result = await window.electronAPI.readFile(file.filePath);

                        if (result.success && result.data) {
                            // 将 Base64 转换为二进制数据
                            const binaryString = atob(result.data);
                            const bytes = new Uint8Array(binaryString.length);
                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }

                            // 使用 xlsx 读取 Excel
                            const workbook = XLSX.read(bytes, {type: 'array'});

                            // 提取所有工作表的数据
                            const sheets = workbook.SheetNames.map((sheetName, index) => {
                                const worksheet = workbook.Sheets[sheetName];
                                // 转换为 JSON 数组（保留原始格式）
                                const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                                    header: 1,
                                    defval: '',
                                    raw: false
                                });

                                return {
                                    name: sheetName,
                                    index: index,
                                    data: jsonData
                                };
                            });

                            // 保存预览数据
                            if (!this.autoProcessExcelPreviews) {
                                this.autoProcessExcelPreviews = {};
                            }
                            this.autoProcessExcelPreviews[file.filePath] = {
                                sheets: sheets,
                                currentSheet: 0
                            };
                        }
                    } catch (error) {
                        console.error('加载Excel预览失败:', file.fileName, error);
                        // 保存错误状态
                        if (!this.autoProcessExcelPreviews) {
                            this.autoProcessExcelPreviews = {};
                        }
                        this.autoProcessExcelPreviews[file.filePath] = {
                            sheets: [],
                            currentSheet: 0,
                            error: error.message
                        };
                    }
                });

                // 等待所有Excel文件加载完成（不阻塞UI）
                Promise.all(loadPromises).catch(error => {
                    console.error('批量加载Excel预览时出错:', error);
                });
            },

            // 获取当前工作表的数据
            getCurrentExcelSheetData(filePath) {
                if (!this.autoProcessExcelPreviews || !this.autoProcessExcelPreviews[filePath]) {
                    return [];
                }

                const preview = this.autoProcessExcelPreviews[filePath];
                const currentSheetIndex = preview.currentSheet || 0;

                if (preview.sheets && preview.sheets[currentSheetIndex]) {
                    return preview.sheets[currentSheetIndex].data || [];
                }

                return [];
            },

            // 切换Excel工作表
            changeExcelSheet(filePath, sheetIndex) {
                if (this.autoProcessExcelPreviews && this.autoProcessExcelPreviews[filePath]) {
                    this.autoProcessExcelPreviews[filePath].currentSheet = parseInt(sheetIndex);
                }
            },

            // 打开文件（用默认程序打开，如果文件在"已处理"文件夹，则从"已处理"文件夹打开）
            async openFile(filePath) {
                if (!window.electronAPI) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                if (typeof window.electronAPI.openFile !== 'function') {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                try {
                    const result = await window.electronAPI.openFile(filePath, this.customerFolderPath);
                    if (!result.success) {
                        await this.$refs.alertDialog.alert('打开文件失败：' + (result.error || '未知错误'));
                    }
                } catch (error) {
                    console.error('打开文件失败:', error);
                    await this.$refs.alertDialog.alert('打开文件失败：' + error.message);
                }
            },

            // 预览转订单模式下的图片
            async previewAutoProcessImage(file) {
                console.log('🖼️ [previewAutoProcessImage] 开始预览图片:', {
                    fileName: file.fileName,
                    filePath: file.filePath,
                    fileType: file.fileType
                });

                if (!window.electronAPI) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                if (typeof window.electronAPI.readFile !== 'function') {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }

                try {
                    // 先尝试读取原始路径的图片
                    let imageBase64 = null;
                    let filePathToRead = file.filePath;

                    try {
                        const result = await window.electronAPI.readFile(filePathToRead);
                        if (result.success && result.data) {
                            imageBase64 = result.data;
                        }
                    } catch (error) {
                        console.log('原始路径读取失败，尝试从已处理文件夹读取:', error);
                        // 如果原始路径读取失败，尝试从已处理文件夹读取
                        if (this.customerFolderPath) {
                            // 使用字符串拼接处理路径（Vue 中不能使用 Node.js 的 path 模块）
                            const processedFolder = this.customerFolderPath.endsWith('/') || this.customerFolderPath.endsWith('\\')
                                ? this.customerFolderPath + '已处理'
                                : this.customerFolderPath + (this.customerFolderPath.includes('\\') ? '\\' : '/') + '已处理';

                            // 从文件路径中提取文件名
                            const fileName = file.filePath.split(/[/\\]/).pop();
                            const processedFilePath = processedFolder + (processedFolder.endsWith('/') || processedFolder.endsWith('\\') ? '' : (processedFolder.includes('\\') ? '\\' : '/')) + fileName;

                            try {
                                const processedResult = await window.electronAPI.readFile(processedFilePath);
                                if (processedResult.success && processedResult.data) {
                                    imageBase64 = processedResult.data;
                                    filePathToRead = processedFilePath;
                                }
                            } catch (processedError) {
                                // 如果文件名不匹配，尝试查找带时间戳的文件
                                console.log('尝试查找带时间戳的文件...');
                                // 这里可以进一步优化，查找匹配的文件
                            }
                        }
                    }

                    if (!imageBase64) {
                        await this.$refs.alertDialog.alert('', 'warning');
                        return;
                    }

                    // 将 Base64 转换为 data URL
                    // 检查 Base64 是否包含 data URL 前缀
                    if (!imageBase64.startsWith('data:')) {
                        // 根据文件扩展名确定 MIME 类型
                        const ext = file.fileName.toLowerCase().split('.').pop();
                        const mimeTypes = {
                            'jpg': 'image/jpeg',
                            'jpeg': 'image/jpeg',
                            'png': 'image/png',
                            'gif': 'image/gif',
                            'bmp': 'image/bmp',
                            'webp': 'image/webp'
                        };
                        const mimeType = mimeTypes[ext] || 'image/jpeg';
                        imageBase64 = `data:${mimeType};base64,${imageBase64}`;
                    }


                    this.autoProcessImagePreview = imageBase64;
                    this.autoProcessImagePreviewFileName = file.fileName;

                    // 重置图片变换（缩放和位置）
                    this.imageScale = 1;
                    this.imageTranslateX = 0;
                    this.imageTranslateY = 0;
                    this.isDragging = false;

                } catch (error) {
                    await this.$refs.alertDialog.alert('预览图片失败：' + error.message);
                }
            },

            // ========== OrderList 组件事件适配器方法（Excel模式） ==========
            // 处理商品名称输入
            handleOrderListGoodsNameInput({item, orderIndex, value}) {
                // 更新 item.nxDoGoodsName
                item.nxDoGoodsName = value;
                // 使用辅助方法确定 sourceType
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleGoodsNameInput(item, orderIndex, sourceType);
            },

            // 处理商品名称获得焦点
            handleOrderListGoodsNameFocus({item, orderIndex}) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleGoodsNameFocus(item, orderIndex, sourceType);
            },

            // 处理商品名称失去焦点
            handleOrderListGoodsNameBlur({item, orderIndex}) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleGoodsNameBlur(item, orderIndex, sourceType);
            },

            // 处理数量输入
            handleOrderListQuantityInput({item, orderIndex, value}) {
                item.nxDoQuantity = value;
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
            },

            // 处理规格变更
            handleOrderListStandardChange({item, orderIndex, value}) {
                item.nxDoStandard = value;
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
            },

            // 处理更新订单
            handleOrderListUpdateOrder({item, orderIndex}) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleUpdateOrder(item, orderIndex, sourceType);
            },

            // 处理保存新商品
            handleOrderListSaveNewGoods({item, orderIndex, goodsName}) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleSaveNewGoods(item, orderIndex, sourceType, goodsName);
            },

            // 处理之前添加订单
            handleOrderListAddNewOrderBefore({item, orderIndex}) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleAddNewOrderBefore(item, orderIndex, sourceType);
            },

            // 处理删除订单
            handleOrderListDeleteOrder({item, orderIndex}) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleDeleteOrderFromExcel(item, orderIndex, sourceType);
            },

            // 处理备注输入（包括规格单位、规格重量、大包装、备注等所有字段）
            handleOrderListRemarkInput({item, orderIndex, value, field}) {
                // 根据字段名更新对应的字段
                if (field) {
                    if (field === 'itemsPerCarton') {
                        item[field] = value ? parseFloat(value) : null;
                    } else {
                        item[field] = value;
                    }
                }
                // 调用 handleRemarkInput 更新缓存等
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleRemarkInput(item, orderIndex, sourceType);
            },

            // 处理选择匹配商品
            handleOrderListSelectMatchedGoods({item, orderIndex, goodsIndex}) {
                // 使用辅助方法确定 sourceType
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.selectMatchedGoods(item, orderIndex, goodsIndex, sourceType);
            },

            // 处理选择搜索结果
            handleOrderListSelectSearchResult({goods, orderIndex}) {
                // 使用辅助方法确定 sourceType（需要先获取对应的 item）
                const item = this.orderItems?.[orderIndex] ||
                    this.orderItems?.[orderIndex] ||
                    this.orderItems?.[orderIndex];
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.selectSearchResult(goods, orderIndex, sourceType);
            },

            // 处理之前添加订单的商品名称输入
            handleBeforeOrderQuantityInput(value) {
                this.beforeOrderForm.quantity = value;
            },

            // 处理之前添加订单的规格输入：首次清空时自动填入大包装规格，第二次清空不再自动填入
            handleBeforeOrderStandardInput(value) {
                const trimmed = (value || '').trim();
                if (trimmed !== '') {
                    this.beforeOrderForm.standard = value;
                    return;
                }
                if (this._beforeOrderStandardHasAutoFilledCarton) {
                    this.beforeOrderForm.standard = '';
                    return;
                }
                const g = this.beforeOrderForm.selectedGoods;
                const carton = g?.nxDgCartonUnit ?? g?.nxGoodsCartonUnit;
                if (carton && String(carton).trim()) {
                    this.beforeOrderForm.standard = carton;
                    this._beforeOrderStandardHasAutoFilledCarton = true;
                } else {
                    this.beforeOrderForm.standard = '';
                }
            },

            // 处理之前添加订单的备注输入
            handleBeforeOrderRemarkInput(value) {
                this.beforeOrderForm.remark = value;
            },

            // 处理保存之前添加的订单
            handleSaveBeforeOrder({item, orderIndex}) {
                this.saveBeforeOrder(item, orderIndex, 'excel');
            },

            // ========== OrderList 组件事件适配器方法（Image模式） ==========
            // 处理商品名称输入
            handleOrderListGoodsNameInputImage({item, orderIndex, value}) {
                item.nxDoGoodsName = value;
                this.handleGoodsNameInput(item, orderIndex, 'image');
            },

            // 处理商品名称获得焦点
            handleOrderListGoodsNameFocusImage({item, orderIndex}) {
                this.handleGoodsNameFocus(item, orderIndex, 'image');
            },

            // 处理商品名称失去焦点
            handleOrderListGoodsNameBlurImage({item, orderIndex}) {
                this.handleGoodsNameBlur(item, orderIndex, 'image');
            },

            // 处理数量输入
            handleOrderListQuantityInputImage({item, orderIndex, value}) {
                item.nxDoQuantity = value;
            },

            // 处理规格变更
            handleOrderListStandardChangeImage({item, orderIndex, value}) {
                item.nxDoStandard = value;
            },

            // 处理更新订单
            handleOrderListUpdateOrderImage({item, orderIndex}) {
                this.handleUpdateOrder(item, orderIndex, 'image');
            },

            // 处理保存新商品
            handleOrderListSaveNewGoodsImage({item, orderIndex, goodsName}) {
                this.handleSaveNewGoods(item, orderIndex, 'image', goodsName);
            },

            // 处理之前添加订单
            handleOrderListAddNewOrderBeforeImage({item, orderIndex}) {
                this.handleAddNewOrderBefore(item, orderIndex, 'image');
            },

            // 处理删除订单
            handleOrderListDeleteOrderImage({item, orderIndex}) {
                this.handleDeleteOrderFromExcel(item, orderIndex, 'image');
            },

            // 处理备注输入
            handleOrderListRemarkInputImage({item, orderIndex, value, field}) {
                if (field) {
                    if (field === 'itemsPerCarton') {
                        item[field] = value ? parseFloat(value) : null;
                    } else {
                        item[field] = value;
                    }
                }
                this.handleRemarkInput(item, orderIndex, 'image');
            },

            // 处理选择匹配商品
            handleOrderListSelectMatchedGoodsImage({item, orderIndex, goodsIndex}) {
                this.selectMatchedGoods(item, orderIndex, goodsIndex, 'image');
            },

            // 处理选择搜索结果
            handleOrderListSelectSearchResultImage({goods, orderIndex}) {
                this.selectSearchResult(goods, orderIndex, 'image');
            },

            // 处理保存之前添加的订单（Image模式）
            handleSaveBeforeOrderImage({item, orderIndex}) {
                this.saveBeforeOrder(item, orderIndex, 'image');
            },

            // 手动录入：修改订单
            handleManualUpdateOrder({ item, orderIndex }) {
                this.handleUpdateOrder(item, orderIndex, 'manual');
            },
            // 手动录入：向上插入订单
            handleManualAddOrderBefore({ item, orderIndex }) {
                this.handleAddNewOrderBefore(item, orderIndex, 'manual');
            },
            handleSaveBeforeOrderManual({ item, orderIndex }) {
                this.saveBeforeOrder(item, orderIndex, 'manual');
            },
            handleManualDownloadGoodsNx(eventData) {
                this.downLoadGoodsNx(eventData);
            },
            // 手动录入：保存订单（使用 saveManulOrder 接口）
            async handleManualSaveOrder({ rowIndex, row }) {
                const goodsName = (row.goodsName || '').trim();
                if (!goodsName) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                // 保存新商品：只要商品名，数量默认1、规格默认斤
                if (row.selectedGoods && (!row.quantity || !row.quantity.toString().trim())) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                if (row.selectedGoods && (!row.standard || !row.standard.toString().trim())) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                const depId = this.selectedSubDepartment || this.selectedAllCustomer;
                if (!depId) {
                    await this.$refs.alertDialog.alert('', 'warning');
                    return;
                }
                let itemDis = row.selectedGoods;
                // 无搜索结果时添加为新商品：先调用 saveNxDisLinshiGoods 创建商品
                if (!itemDis) {
                    this.$store.commit('SET_LOADING', true);
                    const disId = this.disUser?.nxDiuDistributerId;
                    if (!disId) {
                        await this.$refs.alertDialog.alert('', 'warning');
                        return;
                    }
                    const arriveDate = this._getTodayDate();
                    const goodsData = {
                        nxDgGoodsId: '-1',
                        nxDgPullOff: 0,
                        nxDgGoodsStatus: 0,
                        nxDgBuyingPriceIsGrade: 0,
                        nxDgBuyingPrice: '1',
                        nxDgBuyingPriceUpdate: arriveDate,
                        nxDgDistributerId: disId,
                        nxDgGoodsName: goodsName,
                        nxDgGoodsStandardname: (row.standard || '').trim() || '斤',
                        nxDgGoodsStandardWeight: '-1',
                        nxDgItemUnit: (row.standard || '').trim() || '',
                        nxDgGoodsBrand: '-1',
                        nxDgGoodsPlace: '-1',
                        nxDgGoodsInventoryType: 1,
                        nxDgNxGoodsFatherColor: '#20afb8',
                        nxDgGoodsFile: 'goodsImage/logo.jpg',
                        nxDistributerStandardEntities: [],
                        nxDgCartonUnit: '',
                        nxDgItemsPerCarton: ''
                    };
                    try {
                        const goodsRes = await api.saveNxDisLinshiGoods(goodsData);
                        if (goodsRes?.data?.code === 0 && goodsRes.data.data) {
                            itemDis = goodsRes.data.data;
                        } else {
                            const msg = goodsRes?.data?.message || '保存新商品失败，可能存在相同商品';
                            await this.$refs.alertDialog.alert(msg);
                            return;
                        }
                    } catch (e) {
                        console.error('保存新商品失败:', e);
                        await this.$refs.alertDialog.alert('', 'warning');
                        return;
                    } finally {
                        this.$store.commit('SET_LOADING', false);
                    }
                }
                try {
                    this.$store.commit('SET_LOADING', true);
                    const quantity = row.selectedGoods ? (parseFloat(row.quantity) || 0) : (parseFloat(row.quantity) || 1);
                    const standard = (row.standard || '').trim() || '斤';
                    const level = '1';
                    let depDisGoodsId = -1;
                    let price = null;
                    let weight = null;
                    let subtotal = null;
                    let printStandard = null;
                    let costSubtotal = null;
                    let profitSubtotal = 0;
                    let profitScale = 0;
                    let costPrice = 0;
                    let costPriceUpdate = null;
                    if (level == '1') {
                        costPrice = itemDis.nxDgBuyingPriceOne || 0;
                        costPriceUpdate = itemDis.nxDgBuyingPriceOneUpdate || this._getTodayDate();
                        price = itemDis.nxDgWillPriceOne || 0;
                        printStandard = standard || itemDis.nxDgGoodsStandardname;  // 优先用户输入的规格
                        if (standard == itemDis.nxDgGoodsStandardname) {
                            weight = quantity;
                            subtotal = (Number(price) * Number(quantity)).toFixed(1);
                            costSubtotal = (Number(costPrice) * Number(quantity)).toFixed(1);
                            profitSubtotal = (Number(subtotal) - Number(costSubtotal)).toFixed(1);
                            profitScale = Number((Number(price) - Number(costPrice)) / Number(price) * 100).toFixed(2);
                        }
                    } else if (level == '2') {
                        printStandard = standard || itemDis.nxDgWillPriceTwoStandard;  // 优先用户输入的规格
                        weight = quantity;
                        costPriceUpdate = itemDis.nxDgBuyingPriceTwoUpdate || this._getTodayDate();
                        costPrice = itemDis.nxDgBuyingPriceTwo || 0;
                        price = itemDis.nxDgWillPriceTwo || 0;
                        subtotal = (Number(price) * Number(quantity)).toFixed(1);
                        costSubtotal = (Number(costPrice) * Number(quantity)).toFixed(1);
                        profitSubtotal = (Number(subtotal) - Number(costSubtotal)).toFixed(1);
                        profitScale = Number((Number(price) - Number(costPrice)) / Number(price) * 100).toFixed(2);
                    }
                    if (itemDis.departmentDisGoodsEntity != null && itemDis.departmentDisGoodsEntity !== undefined) {
                        depDisGoodsId = itemDis.departmentDisGoodsEntity.nxDepartmentDisGoodsId || -1;
                        if (standard == itemDis.departmentDisGoodsEntity.nxDdgOrderStandard) {
                            price = itemDis.departmentDisGoodsEntity.nxDdgOrderPrice || price;
                            weight = quantity;
                            subtotal = (Number(price) * Number(quantity)).toFixed(1);
                            costSubtotal = (Number(costPrice) * Number(weight)).toFixed(1);
                            profitSubtotal = (Number(subtotal) - Number(costSubtotal)).toFixed(1);
                            profitScale = Number((Number(price) - Number(costPrice)) / Number(price) * 100).toFixed(2);
                        }
                    }
                    const arriveDate = this._getTodayDate();
                    const arriveOnlyDate = this._getTodayDate().split('-')[2];
                    const orderData = {
                        nxDoOrderUserId: this.disUser?.nxDepartmentUserId || this.disUser?.nxDistributerUserId || -1,
                        nxDoDepDisGoodsId: depDisGoodsId,
                        nxDoDisGoodsFatherId: itemDis.nxDgDfgGoodsFatherId || -1,
                        nxDoDisGoodsGrandId: itemDis.nxDgDfgGoodsGrandId || -1,
                        nxDoDisGoodsId: itemDis.nxDistributerGoodsId,
                        nxDoDepartmentId: depId,
                        nxDoDistributerId: this.disUser?.nxDiuDistributerId,
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoQuantity: quantity,
                        nxDoPrice: price || 0,
                        nxDoWeight: weight || null,
                        nxDoSubtotal: subtotal || null,
                        nxDoStandard: standard,
                        nxDoRemark: row.remark || '',
                        nxDoIsAgent: -1,
                        nxDoArriveDate: arriveDate,
                        nxDoArriveWeeksYear: '',
                        nxDoArriveOnlyDate: arriveOnlyDate,
                        nxDoArriveWhatDay: '',
                        nxDoCostPriceUpdate: costPriceUpdate || arriveDate,
                        nxDoCostPrice: costPrice || 0,
                        nxDoPurchaseGoodsId: -1,
                        nxDoCostSubtotal: costSubtotal || null,
                        nxDoProfitSubtotal: profitSubtotal || 0,
                        nxDoProfitScale: profitScale || 0,
                        nxDoNxGoodsId: itemDis.nxDgNxGoodsId || -1,
                        nxDoNxGoodsFatherId: itemDis.nxDgNxFatherId || -1,
                        nxDoGoodsType: itemDis.nxDgPurchaseAuto || 0,
                        nxDoPurchaseUserId: this.disUser?.nxDistributerUserId || -1,
                        nxDoPrintStandard: printStandard || standard,
                        nxDoCostPriceLevel: level,
                        nxDoGoodsName: itemDis.nxDgGoodsName || '',
                        nxDoOcrTaskId: this.currentTaskId,
                    };
                    const res = await api.saveManulOrder(orderData);
                    if (res && res.data && res.data.code === 0 && res.data.data) {
                        const newOrder = {
                            ...res.data.data,
                            nxDoGoodsNameOriginal: res.data.data.nxDoGoodsName || '',
                            nxDoStandardWarn: 0,
                            goodsNameWarn: 0,
                            nxDistributerGoodsEntityList: [],
                            nxGoodsEntities: [],
                        };
                        // 普通添加（非向上插入）：新订单显示在底部，赋予最小序号
                        const seq = (o) => o?.getNxDoTodayOrder ?? o?.nxDoTodayOrder ?? 0;
                        const existingSeqs = this.orderItems.map(o => seq(o));
                        const minSeq = existingSeqs.length ? Math.min(...existingSeqs) : 0;
                        newOrder.nxDoTodayOrder = minSeq - 1;
                        newOrder.getNxDoTodayOrder = minSeq - 1;
                        this.orderItems.push(newOrder);
                        // 按订单序号 getNxDoTodayOrder 排序
                        this.orderItems.sort((a, b) => seq(a) - seq(b));
                        this.$refs.manualEntryRef?.clearRowAfterSave(rowIndex);
                    } else {
                        const errorMsg = res?.data?.msg || res?.data?.message || '保存失败';
                        await this.$refs.alertDialog.alert(errorMsg);
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    await this.$refs.alertDialog.alert('', 'warning');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            }
        }
    }
</script>

<style scoped>
    .save-order-tab {
        display: flex;
        flex-direction: column;
    }

    /* 修改订单弹窗样式（参考 TodayOrders.vue） */
    .order-edit-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1050;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .order-edit-popup {
        background: white;
        border-radius: 8px;
        min-width: 500px;
        max-width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .popup-header {
        position: sticky;
        top: 0;
        z-index: 1;
    }

    .popup-body {
        max-height: calc(90vh - 200px);
        overflow-y: auto;
    }

    /* 弹窗输入框边框：默认深灰色，编辑/聚焦时淡蓝色 */
    .order-edit-popup .form-control {
        border-color: #6c757d;
    }
    .order-edit-popup .form-control:focus {
        border-color: #86b7fe;
        box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.15);
    }

    .popup-footer {
        position: sticky;
        bottom: 0;
        z-index: 1;
    }

    /* 规格按钮样式 */
    .standard-btn {
        min-width: 60px;
        margin-right: 8px;
        margin-bottom: 8px;
    }

    .standard-btn.btn-primary {
        background-color: #007bff;
        border-color: #007bff;
        color: white;
    }

    .standard-btn.btn-outline-secondary {
        border-color: #6c757d;
        color: #6c757d;
    }

    .standard-btn.btn-outline-secondary:hover {
        background-color: #6c757d;
        color: white;
    }

    .brand {
        background-color: #ffc107;
        color: #000;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
    }

    .table-cell {
        border-right: 1px solid #dee2e6;
        padding: 0 8px;
    }

    .table-cell:last-child {
        border-right: none;
    }

    /* 隐藏数量输入框的 spinner 按钮 */
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        appearance: none;
        margin: 0;
    }

    input[type="number"] {
        -moz-appearance: textfield;
        appearance: textfield;
    }

    /* 当订单状态为 0 时，隐藏输入框边框 */
    input:disabled {
        border: none !important;
        box-shadow: none !important;
    }

    .form-control-add {
        border: 1px solid gray;
        border-radius: 2px;
        padding: 4px 6px;
    }

</style>


