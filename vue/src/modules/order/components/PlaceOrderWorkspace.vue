<template>
    <div class="save-order-tab"
         style="height: 100%; overflow: hidden; display: flex; flex-direction: column;">
        <OrderModeSelector
                v-if="showModeSelector"
                :model-value="uploadType"
                :variant="modeSelectorVariant"
                @change="handleUploadTypeChange"
        />

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
import controller from '../services/placeOrderController';

export default controller;
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
