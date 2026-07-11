<template>
    <div class="save-order-tab"
         style="height: 100%; overflow: hidden; display: flex; flex-direction: column;">

        <!-- 内容区域 -->
        <div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
            <!-- 任务 tab：先展示，支持切换任务（简单实现，不做缓存） -->
            <div v-if="isTaskOrderFromBills && (loadingTaskListFromParent || taskListFromParent.length > 0)" class="border-bottom bg-light px-2 py-2 d-flex align-items-center flex-wrap gap-2" style="flex-shrink: 0;">
                <span class="small text-muted" style="min-width: 36px;">任务</span>
                <template v-if="loadingTaskListFromParent">
                    <span class="small text-muted">加载中...</span>
                </template>
                <template v-else>
                    <button
                        v-for="t in taskListFromParent"
                        :key="t.nxOcrTaskId"
                        type="button"
                        class="btn btn-sm"
                        :class="(selectedTaskFromList && selectedTaskFromList.nxOcrTaskId === t.nxOcrTaskId) ? 'btn-primary' : 'btn-outline-secondary'"
                        @click="onSelectTaskFromList(t)">
                        {{ t.nxOcrTaskFileName }}
                    </button>
                </template>
            </div>

            <!-- 复制粘贴模式 -->
            <PasteUpload
                    ref="pasteUploadRef"
                    v-if="uploadType === 'paste'"
                    source="taskOrder"
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
                    @finish-task="onFinishTask"
                    @re-upload="reUpload"
                    @show-fix-items="showFixItems"
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


                    <!-- 已保存状态：使用 OrderList -->
                    <OrderList

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
                            @before-order-goods-name-keydown="handleBeforeOrderGoodsNameKeydown"
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
                    source="taskOrder"
                    :dep-id="selectedSubDepartment || selectedAllCustomer"
                    :task-type="1"
                    :current-task="currentTask"
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
                    @finish-task="onFinishTask"
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
                    :tts-playing="imageTTSState.isTTSPlaying"
                    :tts-loading="imageTTSState.isTTSLoading"
                    :tts-stopped-index="imageTTSState.stoppedIndex"
                    @read-order-list="() => handleReadOrderList('image')"
                    @pause-reading="() => handlePauseReading('image')"
                    @restart-reading="() => handleRestartReading('image')"
                    @stop-reading="() => handleStopReading('image')"
                    @edit-order="handleEditOrderFromPopup"
                    @continue-reading="() => handleContinueReading('image')"
                    @ai-parse-again="handleAiParseAgain"
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
                            @before-order-goods-name-keydown="handleBeforeOrderGoodsNameKeydown"
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
                            @select-search-result="handleOrderListSelectSearchResultImage" />
                </template>
            </ImageUpload>

            <!-- Excel 粘贴区域 -->
            <ExcelPasteUpload
                    ref="excelPasteUploadRef"
                    v-if="uploadType === 'excel-paste'"
                    :task-type="2"
                    source="taskOrder"
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
                    @ai-recognise-complete="handleExcelPasteAiRecogniseComplete"
                    @direct-table-to-orders="handleDirectExcelPasteTableToOrders"
                    @select-task="handleSelectExcelPasteTask"
                    @re-upload="reUpload"
                    @show-fix-items="showFixItems"
                    @clear-order-items="clearExcelPasteOrderItems"
                    @save-orders="saveExcelPasteOrders"
                    @finish-task="onFinishTask"
                    @table-data-update="handleExcelPasteTableDataUpdate"
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

                    <!-- 已保存状态：使用 OrderList -->
                    <OrderList

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
                            @before-order-goods-name-keydown="handleBeforeOrderGoodsNameKeydown"
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
                            @select-search-result="handleOrderListSelectSearchResultExcelPaste" />
                </template>
            </ExcelPasteUpload>
            

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
                    <div v-if="currentEditOrderItem?.nxDoTrainingDataId" style="width: 48px; flex-shrink: 0;"></div>
                    <button
                            v-if="currentEditOrderItem?.nxDoTrainingDataId"
                            class="btn btn-sm btn-warning"
                            @click="handleRevertOrderFromEditModal"
                            style="flex: 0 0 auto; width: 90px;">
                        重新识别
                    </button>
                    <div v-if="currentEditOrderItem?.nxDoTrainingDataId" style="width: 48px; flex-shrink: 0;"></div>
                    <div v-else style="width: 186px; flex-shrink: 0;"></div>
                    <button
                            class="btn btn-sm btn-secondary"
                            @click="closeEditOrderModal"
                            style="flex: 0 0 auto; width: 80px;">
                        取消
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
    <Teleport to="body">
        <div v-if="false && showTaskCompleteModal" class="order-edit-overlay" @click.self="closeTaskCompleteModal">
            <div class="order-edit-popup" style="max-width: 420px;" ref="taskCompleteModalRef" tabindex="-1" @click.stop>
                <div class="popup-header text-center p-3 bg-light border-bottom">
                    <h5 class="mb-0">提示</h5>
                </div>
                <div class="popup-body p-3 text-center">
                    <div class="mb-3">这个任务订单已经全部完成</div>
                </div>
                <div class="popup-footer d-flex p-3 border-top bg-light justify-content-center gap-2">
                    <button class="btn btn-sm btn-secondary" @click="closeTaskCompleteModal"
                            style="flex: 0 0 auto; width: 100px;">检查</button>
                    <button ref="taskCompleteModalCompleteBtn" class="btn btn-sm btn-primary" @click="confirmTaskCompleteModal"
                            style="flex: 0 0 auto; width: 100px;">完成</button>
                </div>
            </div>
        </div>
    </Teleport>

    <!-- 保存新商品弹窗 -->
    <!-- 保存新商品弹窗 -->
    <div v-if="showSaveNewGoodsModal" class="order-edit-overlay" @click.self="closeSaveNewGoodsModal">
        <div class="order-edit-popup" style="max-width: 600px;">
            <!-- 顶部标题 -->
            <div class="popup-header text-center p-3 bg-light border-bottom">
                <h5 class="mb-0">保存新商品</h5>
                <div class="small text-muted mt-2">请确认并修改商品信息</div>
            </div>

            <!-- 输入内容 -->
            <div class="popup-body p-3">
                <!-- 商品名称 -->
                <div class="mb-3 d-flex gap-3">
                    <label class="form-label fw-bold mb-0" style="min-width: 120px; flex-shrink: 0; padding-top: 8px;">商品名称：</label>
                    <div class="d-flex flex-column flex-grow-1">
                        <input
                                type="text"
                                class="form-control-add"
                                v-model="saveNewGoodsForm.goodsName"
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

    <!-- Toast 提示组件 -->
    <Toast
            v-model:visible="toastVisible"
            :message="toastMessage"
            :type="toastType"
            :duration="toastDuration"
    />

    <!-- AlertDialog 自定义弹窗组件 -->
    <AlertDialog ref="alertDialog" />



</template>

<script>
    import api from "../api/all";
    import taskQueue from "../utils/taskQueue";
    import taskExecutor from "../utils/taskExecutor";
    import { parseOrderFromText } from '../utils/pasteOrderParser';
    import ImageCropperModal from './ImageCropperModal.vue';
    import ExcelUpload from './upload/ExcelUpload.vue';
    import ImageUpload from './upload/ImageUpload.vue';
    import PasteUpload from './upload/PasteUpload.vue';
    import ExcelPasteUpload from './upload/ExcelPasteUpload.vue';
    import AutoUpload from './upload/AutoUpload.vue';
    import OrderList from './OrderList.vue';
    import DraftOrderList from './DraftOrderList.vue';
    import Toast from './Toast.vue';
    import AlertDialog from './AlertDialog.vue';

    export default {
        name: 'TaskOrder',
        components: {
            ImageCropperModal,
            ExcelUpload,
            ImageUpload,
            PasteUpload,
            ExcelPasteUpload,
            OrderList,
            DraftOrderList,
            Toast,
            AlertDialog
        },
        emits: ['order-saved', 'upload-type-change', 'order-updated', 'task-list-changed', 'taskListChanged'],
        props: {
            initialTaskId: { type: [Number, String], default: null },
            initialTask: { type: Object, default: null },
            /** 今日任务客户：选中的父级部门 id（Bills 传入） */
            selectedAllCustomer: { type: [Number, String], default: null },
            selectedSubDepartment: { type: [Number, String], default: null }
        },
        data() {
            return {
                // 上传类型
                uploadType: '',

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

                ttsStateByMode: {
                    paste: { isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1 },
                    image: { isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1 },
                    excelPaste: { isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1 },
                    excel: { isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1 }
                },

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
                    lastSearchStr: null, // 上次搜索的字符串
                    selectedSearchIndex: 0 // 当前选中的搜索结果索引
                },

                // 调整订单内容弹窗相关
                showFixItemsModal: false, // 是否显示调整订单内容弹窗
                fixItemsRequirement: '', // 用户输入的修改要求
                isProcessingFixItems: false, // 是否正在处理调整请求

                // 任务全部完成提示弹窗相关
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
                saveNewGoodsForm: { // 保存新商品表单数据
                    goodsName: '',
                    standardName: '', // 商品规格名称
                    standardWeight: '', // 商品规格重量
                    itemUnit: '', // 商品单位
                    cartonUnit: '', // 箱单位
                    itemsPerCarton: '' // 每箱数量
                },

                // 复制粘贴相关
                pasteInputText: '',
                pasteSaveCount: null, // 复制粘贴已保存订单数量（null=草稿，数字=已保存）
                pasteInvalidLineIndices: [],
                pasteInvalidSegments: [],
                pasteNoValidOrder: false,
                showDeepSeekLoading: false,

                // Excel 粘贴相关
                excelPasteSaveCount: null, // Excel 粘贴已保存订单数量（null=草稿，数字=已保存）
                excelPasteTableData: Array.from({ length: 50 }, () => ({
                    goodsName: '', quantity: '', specification: '', specificationWeight: '', cartonQuantity: '', cartonName: '', remark: ''
                })),

                // 今日任务客户：顶部统一任务列表（由 TaskOrder 加载并遍历，子组件只接收当前任务）
                taskListFromParent: [],
                loadingTaskListFromParent: false,
                selectedTaskFromList: null,

                // 右侧页面日志（第一个任务客户选择后在此展示）
                pageLogs: [],
                selectedCustomerEntity: {
                    type: Object,
                    default: null
                },
                selectedCustomerName: {
                    type: String,
                    default: ''
                },

                allOrdersAreDraft: false,

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
            disUser() {
                return this.$store.state.disUser;
            },
            isTaskOrderFromBills() {
                return this.selectedAllCustomer != null && this.selectedAllCustomer !== '';
            },

            currentFixItemsOrderList() {
                const uploadType = this.uploadType;
                return this.getCurrentOrderItems(uploadType);
            },

        },
        watch: {
            showTaskCompleteModal(val) {
                if (val) {
                    // 达到弹窗条件时立即停止朗读，避免影响回车键等操作
                    this.stopAllReading();
                    // Teleport 后 DOM 可能稍晚就绪，用 nextTick + setTimeout 确保能聚焦
                    this.$nextTick(() => {
                        setTimeout(() => {
                            this.$refs.taskCompleteModalCompleteBtn?.focus();
                        }, 50);
                    });
                    // 全局监听回车键（捕获阶段，优先于 OrderList 的 stopPropagation）
                    this._taskCompleteModalKeyHandler = (e) => {
                        if (e.key === 'Enter' && this.showTaskCompleteModal) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.confirmTaskCompleteModal();
                        }
                    };
                    document.addEventListener('keydown', this._taskCompleteModalKeyHandler, true);
                } else {
                    if (this._taskCompleteModalKeyHandler) {
                        document.removeEventListener('keydown', this._taskCompleteModalKeyHandler);
                        this._taskCompleteModalKeyHandler = null;
                    }
                }
            },
            selectedAllCustomer: {
                immediate: true,
                handler(newVal) {
                    if (!this.isTaskOrderFromBills) return;
                    this.clearTaskStatusPollTimer();
                    // 切换任务客户时先清空当前任务，避免 ImageUpload 等仍显示上一客户的 currentTask
                    this.currentTaskId = null;
                    this.currentTask = null;
                    this.loadTaskListAtTop();
                }
            },
            // 监听子部门切换，重新加载缓存
            selectedSubDepartment: {
                handler(newVal, oldVal) {
                    if (newVal !== oldVal && this.selectedAllCustomer) {
                        this.clearTaskStatusPollTimer();
                        // 清空订单数据
                        console.warn('⚠️ [selectedSubDepartment watch] 清空 orderItems，原因: 子部门切换');
                        this.orderItems = [];
                        // 切换客户/子部门时清空当前任务，避免 ImageUpload 显示上一客户的 currentTask
                        this.currentTaskId = null;
                        this.currentTask = null;
                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                    }
                }
            },
            // 监听上传方式切换，如果是转订单模式，加载文件夹路径
            uploadType: {
                handler(newVal, oldVal) {
                    if (newVal !== oldVal && this.selectedAllCustomer) {
                        this.clearTaskStatusPollTimer();
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
        mounted() {},
        beforeUnmount() {
            this.clearTaskStatusPollTimer();
            if (this._taskCompleteModalKeyHandler) {
                document.removeEventListener('keydown', this._taskCompleteModalKeyHandler);
                this._taskCompleteModalKeyHandler = null;
            }
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

            loadTaskListAtTop() {
                if (!this.selectedAllCustomer) return Promise.resolve([]);
                this.loadingTaskListFromParent = true;
                return api.depFatherGetTaskList(this.selectedAllCustomer, { showLoading: false })
                    .then((res) => {
                        const data = res.data?.data ?? res.data?.list ?? [];
                        this.taskListFromParent = Array.isArray(data) ? data : [];
                        this.loadingTaskListFromParent = false;
                        if (this.taskListFromParent.length > 0) {
                            this.onSelectTaskFromList(this.taskListFromParent[0]);
                        }
                        return this.taskListFromParent;
                    })
                    .catch((err) => {
                        this.loadingTaskListFromParent = false;
                        return [];
                    });
            },
            /** 根据任务类型显示图片或粘贴模板：后端 nxOcrTaskType 2=Excel粘贴，3=粘贴，其余=图片；兼容 uploadType 字符串 */
            taskUploadType(t) {
                if (!t) return 'image';
                if (t.uploadType === 'excel-paste') return 'excel-paste';
                if (t.uploadType === 'paste') return 'paste';
                const type = Number(t.nxOcrTaskType);
                if (type === 2) return 'excel-paste';
                if (type === 3) return 'paste';
                return 'image';
            },
            onSelectTaskFromList(t) {
                this.stopAllReading(); // 切换任务时停止当前朗读
                this.selectedTaskFromList = t;
                this.uploadType = this.taskUploadType(t);
                // 使用 $nextTick 确保 Vue 响应式更新完成后再加载任务订单
                this.$nextTick(() => {
                    if (this.uploadType === 'paste') {
                        this.handleSelectPasteTask(t);
                    } else if (this.uploadType === 'excel-paste') {
                        this.handleSelectExcelPasteTask(t);
                    } else {
                        this.handleSelectImageTask(t);
                    }
                });
            },

            /** 从 getTaskOrders 响应中解析订单列表（兼容 data.page.list / data.page.data / data.data.list / data.list） */
            parseOrderListFromResponse(res) {
                const data = res?.data;
                const page = data?.page || data;
                let list = Array.isArray(page?.list) ? page.list : (Array.isArray(page?.data) ? page.data : []);
                if (list.length === 0) list = Array.isArray(data?.data?.list) ? data.data.list : (Array.isArray(data?.list) ? data.list : []);
                return list;
            },

            /** 将 nxOcrTaskOcrText 中的 CSV 解析为表格行数组（与 excelPasteTableData 结构一致） */
            parseCsvToExcelPasteTableData(csvText) {
                const columns = ['goodsName', 'quantity', 'specification', 'specificationWeight', 'cartonQuantity', 'cartonName', 'remark'];
                const emptyRow = () => ({ goodsName: '', quantity: '', specification: '', specificationWeight: '', cartonQuantity: '', cartonName: '', remark: '' });
                if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
                    return Array.from({ length: 50 }, emptyRow);
                }
                const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
                if (lines.length < 2) return Array.from({ length: 50 }, emptyRow);
                const dataLines = lines.slice(1);
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
                    columns.forEach((col, idx) => { row[col] = cells[idx] != null ? String(cells[idx]).trim() : ''; });
                    return row;
                });
                while (rows.length < 50) rows.push(emptyRow());
                return rows.slice(0, 50);
            },

            hasExcelPasteTableData() {
                const data = this.excelPasteTableData || [];
                return data.some(row => row.goodsName && String(row.goodsName).trim() !== '');
            },
            clearExcelPasteTableData() {
                this.excelPasteTableData = Array.from({ length: 50 }, () => ({
                    goodsName: '', quantity: '', specification: '', specificationWeight: '', cartonQuantity: '', cartonName: '', remark: ''
                }));
            },
            handleSelectExcelPasteTask(payload) {
                const task = payload && (payload.task !== undefined ? payload.task : payload);
                if (!task?.nxOcrTaskId) return;
                const taskId = task.nxOcrTaskId;
                this.taskLoading = true;
                const pageSize = 10;
                api.getTaskOrders(taskId, { page: 1, limit: pageSize, processStatus: true, showLoading: true })
                    .then((res) => {
                        const data = res?.data;
                        const resTask = data?.task || task;
                        const orderList = this.parseOrderListFromResponse(res);
                        this.orderItems = orderList;
                        this.currentTaskId = taskId;
                        this.currentTask = resTask;
                        this.excelPasteSaveCount = this.orderItems.length > 0 ? this.orderItems.length : null;
                        const taskOcrText = (resTask && (resTask.nxOcrTaskOcrText != null ? resTask.nxOcrTaskOcrText : resTask.ocrText)) || '';
                        this.excelPasteTableData = this.parseCsvToExcelPasteTableData(taskOcrText);
                        this.taskLoading = false;
                        const pageInfo = data?.page || data;
                        const totalPages = pageInfo?.totalPage != null ? pageInfo.totalPage : 1;
                        const resPageSize = pageInfo?.pageSize != null ? pageInfo.pageSize : pageSize;
                        if (totalPages > 1) {
                            let orderArr = orderList;
                            const fetchRemainingPages = (page) => {
                                if (page > totalPages) return Promise.resolve();
                                return api.getTaskOrders(taskId, { page, limit: resPageSize, processStatus: true, showLoading: false }).then(r => {
                                    const d = r?.data;
                                    const nextList = (d?.page?.list || d?.page?.data || []).filter(Boolean);
                                    if (nextList.length > 0 && this.currentTaskId === taskId) {
                                        orderArr = [...orderArr, ...nextList];
                                        this.orderItems = orderArr;
                                        this.excelPasteSaveCount = orderArr.length;
                                    }
                                    return fetchRemainingPages(page + 1);
                                }).catch(() => {});
                            };
                            fetchRemainingPages(2).catch(() => {});
                        }
                    })
                    .catch(() => { this.taskLoading = false; });
            },
            handleExcelPasteAddNew() {
                if (this.currentTaskId != null) {
                    this.excelPasteLastState = {
                        currentTaskId: this.currentTaskId,
                        currentTask: this.currentTask,
                        orderItems: (this.orderItems || []).slice(),
                        excelPasteSaveCount: this.excelPasteSaveCount,
                        excelPasteTableData: (this.excelPasteTableData || []).map(row => ({ ...row }))
                    };
                }
                this.currentTaskId = null;
                this.currentTask = null;
                this.orderItems = [];
                this.excelPasteSaveCount = null;
                this.excelPasteTableData = Array.from({ length: 50 }, () => ({ goodsName: '', quantity: '', specification: '', specificationWeight: '', cartonQuantity: '', cartonName: '', remark: '' }));
            },
            handleExcelPasteCloseNewContent() {
                if (!this.excelPasteLastState) return;
                const s = this.excelPasteLastState;
                this.currentTaskId = s.currentTaskId ?? s.pasteCurrentTaskId;
                this.currentTask = s.currentTask ?? s.pasteCurrentTask;
                this.orderItems = s.orderItems || s.excelPasteOrderItems || [];
                this.excelPasteSaveCount = s.excelPasteSaveCount;
                this.excelPasteTableData = s.excelPasteTableData && s.excelPasteTableData.length ? s.excelPasteTableData.slice() : Array.from({ length: 50 }, () => ({ goodsName: '', quantity: '', specification: '', specificationWeight: '', cartonQuantity: '', cartonName: '', remark: '' }));
                this.excelPasteLastState = null;
            },
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
            handleExcelPasteAiRecognise() {
                this.$refs.excelPasteUploadRef?.showExcelPastePromptDialog?.();
            },
            async handleExcelPasteAiRecogniseComplete(csvData, userPrompt) {
                this.showDeepSeekLoading = true;
                try {
                    if (typeof this.parseExcelPasteData === 'function') {
                        const orderItems = await this.parseExcelPasteData(csvData, userPrompt);
                        this.orderItems = orderItems || [];
                    }
                } catch (e) {
                    console.error('handleExcelPasteAiRecogniseComplete failed:', e);
                    await this.$refs.alertDialog.alert('AI解析失败：' + (e.message || '未知错误'), 'error');
                } finally {
                    this.showDeepSeekLoading = false;
                }
            },
            async clearExcelPasteOrderItems() {
                if (this.orderItems.length === 0) {
                    return;
                }
                const confirmed = await this.$refs.alertDialog.confirm('确定要清空所有订单商品吗？');
                if (confirmed) {
                    this.orderItems = [];
                    this.resetSearchAndMatchedGoodsState();
                }
            },
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


            handleExcelPasteTableDataUpdate(updates) {
                (updates || []).forEach(({ rowIndex, updates: rowUpdates }) => {
                    if (rowIndex >= 0 && rowIndex < (this.excelPasteTableData || []).length) {
                        Object.assign(this.excelPasteTableData[rowIndex], rowUpdates || {});
                    }
                });
            },
            handleExcelPasteCellClick(payload) {
                this.currentPasteRowIndex = payload?.rowIndex ?? 0;
                this.currentPasteColIndex = payload?.columnIndex ?? 0;
            },
            handleExcelPasteEditClosed() {},
            parseExcelPasteData() {
                return Promise.resolve([]);
            },

            handleSelectImageTask(task) {
                if (!task?.nxOcrTaskId) return;
                const taskId = task.nxOcrTaskId;
                this.clearTaskStatusPollTimer();
                this.taskLoading = true; // 与粘贴任务一致：加载中显示占位动画，不显示空白
                const pageSize = 10;
                api.getTaskOrders(taskId, { page: 1, limit: pageSize, processStatus: true, showLoading: true })
                    .then((res) => {
                        const data = res?.data;
                        const resTask = data?.task || task;
                        const orderList = this.parseOrderListFromResponse(res);
                        this.orderItems = orderList;
                        this.currentTaskId = taskId;
                        this.currentTask = resTask;

                        // nxOcrTaskStatus===0 表示后台异步处理中，轮询直到状态变为 1 或 2
                        if (resTask && resTask.nxOcrTaskStatus === 0) {
                            this.taskLoading = false;
                            this.startTaskStatusPolling(taskId, pageSize);
                            return;
                        }

                        if (resTask?.nxOcrTaskImagePath) {
                            const base = (api.getImageServerURL && api.getImageServerURL()) || '';
                            const path = String(resTask.nxOcrTaskImagePath);
                            this.imagePreview = path.startsWith('http') ? path : (base.replace(/\/$/, '') + '/' + path.replace(/^\//, ''));
                            this.uploadedImageFile = {
                                name: resTask.nxOcrTaskFileName || '任务图片',
                                size: 0,
                                type: 'image/jpeg',
                                dataUrl: this.imagePreview
                            };
                        } else {
                            this.imagePreview = null;
                            this.uploadedImageFile = null;
                        }
                        this.taskLoading = false;
                        const pageInfo = data?.page || data;
                        const totalPages = pageInfo?.totalPage != null ? pageInfo.totalPage : 1;
                        const resPageSize = pageInfo?.pageSize != null ? pageInfo.pageSize : pageSize;
                        if (totalPages <= 1) return;
                        let orderArr = orderList;
                        const fetchRemainingPages = (page) => {
                            if (page > totalPages) return Promise.resolve();
                            return api.getTaskOrders(taskId, { page, limit: resPageSize, processStatus: true, showLoading: false }).then(r => {
                                const d = r?.data;
                                const nextList = (d?.page?.list || d?.page?.data || []).filter(Boolean);
                                if (nextList.length > 0 && this.currentTaskId === taskId) {
                                    orderArr = [...orderArr, ...nextList];
                                    this.orderItems = orderArr;
                                }
                                return fetchRemainingPages(page + 1);
                            }).catch(() => {});
                        };
                        fetchRemainingPages(2).catch(() => {});
                    })
                    .catch(() => {
                        this.taskLoading = false;
                    });
            },

            clearTaskStatusPollTimer() {
                if (this.taskStatusPollTimer) {
                    clearInterval(this.taskStatusPollTimer);
                    this.taskStatusPollTimer = null;
                }
            },

            /** 切换任务客户时由 Bills 调用，立即清除任务状态和轮询，避免「后台处理中」蒙版残留 */
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
            },

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
                        const data = res?.data;
                        if (!data || data.code !== 0) return;
                        const resTask = data?.task || null;
                        const status = resTask && resTask.nxOcrTaskStatus;
                        if (status === 1 || status === 2) {
                            if (this._taskStatusPollProcessed === taskId) return; // 已由其他并发 poll 处理，避免重复请求
                            this._taskStatusPollProcessed = taskId;
                            this.clearTaskStatusPollTimer();
                            const orderList = this.parseOrderListFromResponse(res);
                            this.orderItems = orderList;
                            this.currentTask = resTask;
                            if (resTask?.nxOcrTaskImagePath) {
                                const base = (api.getImageServerURL && api.getImageServerURL()) || '';
                                const path = String(resTask.nxOcrTaskImagePath);
                                this.imagePreview = path.startsWith('http') ? path : (base.replace(/\/$/, '') + '/' + path.replace(/^\//, ''));
                                this.uploadedImageFile = {
                                    name: resTask.nxOcrTaskFileName || '任务图片',
                                    size: 0,
                                    type: 'image/jpeg',
                                    dataUrl: this.imagePreview
                                };
                            } else {
                                this.imagePreview = null;
                                this.uploadedImageFile = null;
                            }
                            const pageInfo = data?.page || data;
                            const totalPages = pageInfo?.totalPage != null ? pageInfo.totalPage : 1;
                            const resPageSize = pageInfo?.pageSize != null ? pageInfo.pageSize : pageSize;
                            if (totalPages > 1) {
                                let orderArr = orderList;
                                const fetchRemainingPages = (page) => {
                                    if (page > totalPages) return Promise.resolve();
                                    if (this.currentTaskId !== taskId) return Promise.resolve();
                                    return api.getTaskOrders(taskId, { page, limit: resPageSize, processStatus: true, showLoading: false }).then(r => {
                                        const d = r?.data;
                                        const nextList = (d?.page?.list || d?.page?.data || []).filter(Boolean);
                                        if (nextList.length > 0 && this.currentTaskId === taskId) {
                                            orderArr = [...orderArr, ...nextList];
                                            this.orderItems = orderArr;
                                        }
                                        return this.currentTaskId === taskId ? fetchRemainingPages(page + 1) : Promise.resolve();
                                    }).catch(() => {});
                                };
                                fetchRemainingPages(2).catch(() => {});
                            }
                        }
                    } catch (e) {
                        console.warn('[TaskOrder] 任务状态轮询失败:', e);
                    }
                };
                this.taskStatusPollTimer = setInterval(poll, 20000);
                poll();
            },

            handleSelectPasteTask(task) {
                if (!task?.nxOcrTaskId) return;
                const taskId = task.nxOcrTaskId;
                this.currentTaskId = taskId;
                this.currentTask = task;
                this.taskLoading = true; // 等待 getTaskOrders 返回前 PasteUpload 显示加载动画，不显示空白输入框
                const pageSize = 10;
                api.getTaskOrders(taskId, { page: 1, limit: pageSize, processStatus: true, showLoading: true })
                    .then((res) => {
                        const data = res?.data;
                        const resTask = data?.task || task;
                        const orderList = this.parseOrderListFromResponse(res);
                        this.orderItems = orderList;
                        this.currentTask = resTask;
                        // 显示任务保存的粘贴文字
                        const taskOcrText = (resTask && (resTask.nxOcrTaskOcrText != null ? resTask.nxOcrTaskOcrText : resTask.ocrText)) || '';
                        this.pasteInputText = taskOcrText;
                        this.taskLoading = false;
                        // 若还有后续页，后台无蒙板继续请求并追加
                        const pageInfo = data?.page || data;
                        const totalPages = pageInfo?.totalPage != null ? pageInfo.totalPage : 1;
                        const resPageSize = pageInfo?.pageSize != null ? pageInfo.pageSize : pageSize;
                        if (totalPages <= 1) return;
                        let orderArr = orderList;
                        const fetchRemainingPages = (page) => {
                            if (page > totalPages) return Promise.resolve();
                            return api.getTaskOrders(taskId, { page, limit: resPageSize, processStatus: true, showLoading: false }).then(r => {
                                const d = r?.data;
                                const nextList = (d?.page?.list || d?.page?.data || []).filter(Boolean);
                                if (nextList.length > 0 && this.currentTaskId === taskId) {
                                    orderArr = [...orderArr, ...nextList];
                                    this.orderItems = orderArr;
                                }
                                return fetchRemainingPages(page + 1);
                            }).catch(() => {});
                        };
                        fetchRemainingPages(2).catch(() => {});
                    })
                    .catch(() => {
                        this.taskLoading = false;
                    });
            },

            currentFixItemsOrderList() {
                const uploadType = this.uploadType || 'image';
                return this.getCurrentOrderItems(uploadType);
            },


            /** 各模式 TTS 状态，mode: 'paste' | 'image' | 'excelPaste' | 'excel' */
            getTTSState(mode) {
                const state = this.ttsStateByMode[mode];
                return state || { isTTSPlaying: false, isTTSLoading: false, stoppedIndex: -1 };
            },
            /** 按模式取 OrderList 的 ref */
            getOrderListRef(mode) {
                const refMap = {
                    paste: 'pasteOrderListRef',
                    image: 'imageOrderListRef',
                    excelPaste: 'excelPasteOrderListRef',
                    excel: 'excelOrderListRef'
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
            /** 停止所有模式的朗读 */
            stopAllReading() {
                ['paste', 'image', 'excelPaste'].forEach(mode => {
                    const ref = this.getOrderListRef(mode);
                    if (ref && ref.stopReading) ref.stopReading();
                });
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



            // 重新上传：批量删除所有订单
            async reUpload() {
                console.log('========== [reUpload] 开始执行 ==========');

                let sourceType = this.uploadType || 'image';



                // 图片模式：有任务 ID 时直接按任务删除，无需遍历订单 ID
                if (sourceType === 'image' && this.currentTaskId != null) {
                    if (!(await this.$refs.alertDialog.confirm('确定要删除该任务并重新上传吗？'))) {
                        return;
                    }
                    try {
                        this.$store.commit('SET_LOADING', true);
                        const res = await api.deleteTaskData(this.currentTaskId);
                        if (res && res.data && res.data.code === 0) {
                            this.orderItems = [];
                            this.uploadedImageFile = null;
                            this.imagePreview = null;
                            this.currentTaskId = null;
                            this.currentTask = null;
                            if (this.$refs.imageFileInput) this.$refs.imageFileInput.value = '';
                            if (this.isTaskOrderFromBills) {
                                this.loadTaskListAtTop();
                                this.$emit('task-list-changed');
                            } else if (this.$refs.imageUploadRef && typeof this.$refs.imageUploadRef.loadTaskList === 'function') {
                                this.$nextTick(() => this.$refs.imageUploadRef.loadTaskList());
                            }
                            this.$emit('order-updated');
                        } else {
                            await this.$refs.alertDialog.alert(res?.data?.msg || res?.data?.message || '删除失败', 'error');
                        }
                    } catch (e) {
                        console.error('[reUpload] deleteTaskData 失败:', e);
                        await this.$refs.alertDialog.alert('删除失败：' + (e.message || '请检查网络'), 'error');
                    } finally {
                        this.$store.commit('SET_LOADING', false);
                    }
                    return;
                }

                // 图片模式只使用 deleteTaskData，没有任务 ID 时仅清空本地，不调用 deleteBatch
                if (sourceType === 'image') {
                    if (!(await this.$refs.alertDialog.confirm('确定要清空当前内容并重新上传吗？'))) return;
                    this.orderItems = [];
                    this.uploadedImageFile = null;
                    this.imagePreview = null;
                    this.currentTaskId = null;
                    this.currentTask = null;
                    if (this.$refs.imageFileInput) this.$refs.imageFileInput.value = '';
                    if (this.$refs.imageUploadRef && typeof this.$refs.imageUploadRef.loadTaskList === 'function') {
                        this.$nextTick(() => this.$refs.imageUploadRef.loadTaskList());
                    }
                    this.$emit('order-updated');
                    return;
                }

                // 粘贴模式：有任务 ID 时按任务删除，然后刷新任务列表
                if (sourceType === 'paste' && this.currentTaskId != null) {
                    if (!(await this.$refs.alertDialog.confirm('确定要删除该任务并重新上传吗？'))) return;
                    try {
                        this.$store.commit('SET_LOADING', true);
                        const res = await api.deleteTaskData(this.currentTaskId);
                        if (res && res.data && res.data.code === 0) {
                            this.orderItems = [];
                            this.pasteSaveCount = null;
                            this.currentTaskId = null;
                            this.currentTask = null;
                            this.pasteInputText = '';
                            if (this.isTaskOrderFromBills) {
                                this.loadTaskListAtTop();
                                this.$emit('task-list-changed');
                            } else if (this.$refs.pasteUploadRef && typeof this.$refs.pasteUploadRef.loadTaskList === 'function') {
                                this.$nextTick(() => this.$refs.pasteUploadRef.loadTaskList());
                            }
                            this.$emit('order-updated');
                        } else {
                            await this.$refs.alertDialog.alert(res?.data?.msg || res?.data?.message || '删除失败', 'error');
                        }
                    } catch (e) {
                        console.error('[reUpload] paste deleteTaskData 失败:', e);
                        await this.$refs.alertDialog.alert('删除失败：' + (e.message || '请检查网络'), 'error');
                    } finally {
                        this.$store.commit('SET_LOADING', false);
                    }
                    return;
                }

                // 粘贴模式只使用 deleteTaskData，没有任务 ID 时仅清空本地
                if (sourceType === 'paste') {
                    if (!(await this.$refs.alertDialog.confirm('确定要清空当前内容并重新上传吗？'))) return;
                    this.orderItems = [];
                    this.pasteSaveCount = null;
                    this.currentTaskId = null;
                    this.currentTask = null;
                    this.pasteInputText = '';
                    if (this.$refs.pasteUploadRef && typeof this.$refs.pasteUploadRef.loadTaskList === 'function') {
                        this.$nextTick(() => this.$refs.pasteUploadRef.loadTaskList());
                    }
                    this.$emit('order-updated');
                    return;
                }

                // Excel 粘贴模式：有任务 ID 时按任务删除，然后刷新任务列表
                if (sourceType === 'excel-paste' && this.currentTaskId != null) {
                    if (!(await this.$refs.alertDialog.confirm('确定要删除该任务并重新上传吗？'))) return;
                    try {
                        this.$store.commit('SET_LOADING', true);
                        const res = await api.deleteTaskData(this.currentTaskId);
                        if (res && res.data && res.data.code === 0) {
                            this.orderItems = [];
                            this.excelPasteSaveCount = null;
                            this.excelPasteTableData = Array.from({ length: 50 }, () => ({ goodsName: '', quantity: '', specification: '', specificationWeight: '', cartonQuantity: '', cartonName: '', remark: '' }));
                            this.currentTaskId = null;
                            this.currentTask = null;
                            if (this.isTaskOrderFromBills) {
                                this.loadTaskListAtTop();
                                this.$emit('task-list-changed');
                            } else if (this.$refs.excelPasteUploadRef && typeof this.$refs.excelPasteUploadRef.loadTaskList === 'function') {
                                this.$nextTick(() => this.$refs.excelPasteUploadRef.loadTaskList());
                            }
                            this.$emit('order-updated');
                        } else {
                            await this.$refs.alertDialog.alert(res?.data?.msg || res?.data?.message || '删除失败', 'error');
                        }
                    } catch (e) {
                        console.error('[reUpload] excel-paste deleteTaskData 失败:', e);
                        await this.$refs.alertDialog.alert('删除失败：' + (e.message || '请检查网络'), 'error');
                    } finally {
                        this.$store.commit('SET_LOADING', false);
                    }
                    return;
                }

                // Excel 粘贴模式：没有任务 ID 时仅清空本地
                if (sourceType === 'excel-paste') {
                    if (!(await this.$refs.alertDialog.confirm('确定要清空当前内容并重新上传吗？'))) return;
                    this.orderItems = [];
                    this.excelPasteSaveCount = null;
                    this.excelPasteTableData = Array.from({ length: 50 }, () => ({ goodsName: '', quantity: '', specification: '', specificationWeight: '', cartonQuantity: '', cartonName: '', remark: '' }));
                    this.currentTaskId = null;
                    this.currentTask = null;
                    if (this.$refs.excelPasteUploadRef && typeof this.$refs.excelPasteUploadRef.loadTaskList === 'function') {
                        this.$nextTick(() => this.$refs.excelPasteUploadRef.loadTaskList());
                    }
                    this.$emit('order-updated');
                    return;
                }

            },

            /** 按上传类型清空本地订单、文件等状态（参考 PlaceOrder） */
            clearLocalByUploadType(sourceType) {
                const st = sourceType || this.uploadType || 'image';
                if (st === 'paste') {
                    this.orderItems = [];
                    this.pasteInputText = '';
                    this.pasteSaveCount = null;
                    this.pasteInvalidLineIndices = [];
                    this.pasteInvalidSegments = [];
                    this.pasteNoValidOrder = false;
                } else if (st === 'excel-paste') {
                    this.orderItems = [];
                    this.excelPasteSaveCount = null;
                    this.excelPasteTableData = Array.from({ length: 50 }, () => ({
                        goodsName: '', quantity: '', specification: '', specificationWeight: '',
                        cartonQuantity: '', cartonName: '', remark: ''
                    }));
                } else {
                    this.orderItems = [];
                    if (st === 'image') {
                        this.uploadedImageFile = null;
                        this.imagePreview = null;
                        this.stopAllReading();
                        if (this.$refs.imageFileInput) this.$refs.imageFileInput.value = '';
                    }
                }
                this.resetSearchAndMatchedGoodsState();
            },

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
            // 切换匹配商品列表显示：与 PlaceOrder 一致，支持 payload 为 number 或 { orderIndex, hasSearchResults }
            toggleMatchedGoods(payload) {
                const orderIndex = typeof payload === 'object' ? payload.orderIndex : payload;
                const hasSearchResultsFromChild = typeof payload === 'object' ? payload.hasSearchResults : undefined;
                const isExpanded = !!this.showMatchedGoods[orderIndex];
                const hasSearchResults = hasSearchResultsFromChild !== undefined
                    ? hasSearchResultsFromChild
                    : (this.orderArrIndex === orderIndex && ((this.strArr?.length || 0) + (this.nxArr?.length || 0)) > 0);
                if (isExpanded || hasSearchResults) {
                    // 关闭：情况1-收起匹配商品；情况2-关闭搜索商品
                    const item = this.orderItems && this.orderItems[orderIndex];
                    if (item) {
                        const original = item.nxDoGoodsNameOriginal;
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

            // 获取当前操作的订单列表（根据 sourceType）
            getCurrentOrderItems(sourceType) {
                return this.orderItems;
            },

            async determineSourceTypeForOrderList(orderIndex, item) {
                // 优先使用 uploadType
                let sourceType = this.uploadType;

                // 如果 uploadType 未设置或是 'excel'，根据订单列表情况推断
                if (!sourceType || sourceType === 'excel') {
                    // 检查订单项所在的列表
                    if (this.orderItems && this.orderItems.length > 0) {
                        // 检查 item 是否在 orderItems 中，或 orderIndex 在范围内
                        const isInPasteList = (orderIndex < this.orderItems.length &&
                            this.orderItems[orderIndex] === item) ||
                            this.orderItems.includes(item);
                        if (isInPasteList) {
                            sourceType = 'paste';
                        }
                    }

                    if (!sourceType || sourceType === 'excel') {
                        if (this.orderItems && this.orderItems.length > 0) {
                            // 检查 item 是否在 orderItems 中（excel-paste 模式）
                            const isInExcelPasteList = (orderIndex < this.orderItems.length &&
                                this.orderItems[orderIndex] === item) ||
                                this.orderItems.includes(item);
                            if (isInExcelPasteList) {
                                sourceType = 'excel-paste';
                            }
                        }
                    }

                    // 如果还是没有确定，弹窗让用户选择
                    if (!sourceType || sourceType === 'excel') {
                        // 构建可用的选项列表
                        const availableOptions = [];
                        const optionLabels = {
                            'excel': 'Excel上传',
                            'paste': '复制粘贴',
                            'excel-paste': 'Excel粘贴',
                            'image': '图片上传',
                            'auto': '转订单'
                        };

                        // 检查哪些订单列表有数据
                        if (this.orderItems && this.orderItems.length > 0) {
                            availableOptions.push({ value: 'excel', label: optionLabels['excel'] });
                        }
                        if (this.orderItems && this.orderItems.length > 0) {
                            availableOptions.push({ value: 'paste', label: optionLabels['paste'] });
                        }
                        if (this.orderItems && this.orderItems.length > 0 && this.uploadType === 'excel-paste') {
                            availableOptions.push({ value: 'excel-paste', label: optionLabels['excel-paste'] });
                        }

                        // 如果没有任何订单列表有数据，默认使用 excel
                        if (availableOptions.length === 0) {
                            console.warn('⚠️ [determineSourceTypeForOrderList] 所有订单列表都为空，默认使用 excel');
                            sourceType = 'excel';
                        } else if (availableOptions.length === 1) {
                            // 只有一个选项，直接使用
                            sourceType = availableOptions[0].value;
                            console.log('✅ [determineSourceTypeForOrderList] 只有一个可用选项，自动选择:', sourceType);
                        } else {
                            // 多个选项，弹窗让用户选择
                            // 构建选择消息
                            let message = '无法自动确定订单类型，请选择：\n\n';
                            availableOptions.forEach((opt, idx) => {
                                message += `${idx + 1}. ${opt.label}\n`;
                            });

                            // 使用循环让用户选择
                            let selected = false;
                            for (let i = 0; i < availableOptions.length; i++) {
                                const option = availableOptions[i];
                                const isLast = i === availableOptions.length - 1;
                                const confirmMessage = isLast
                                    ? `${message}\n点击"确定"选择 ${option.label}，点击"取消"使用默认选项（Excel上传）。`
                                    : `${message}\n点击"确定"选择 ${option.label}，点击"取消"查看下一个选项。`;

                                if (await this.$refs.alertDialog.confirm(confirmMessage)) {
                                    sourceType = option.value;
                                    console.log(`✅ [determineSourceTypeForOrderList] 用户选择: ${option.label} (${option.value})`);
                                    selected = true;
                                    break;
                                }
                            }

                            // 如果用户取消了所有选择，使用默认值
                            if (!selected) {
                                sourceType = 'excel';
                                console.warn('⚠️ [determineSourceTypeForOrderList] 用户取消所有选择，使用默认值 excel');
                            }
                        }
                    }
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

                // 不再在获得焦点时自动查询，只有按回车键或输入时才会查询
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

                        // 根据来源类型更新对应的订单列表
                        if (this.currentEditOrderSourceType === 'paste') {
                            if (this.currentEditOrderIndex >= 0 && this.currentEditOrderIndex < this.orderItems.length) {
                                this.orderItems[this.currentEditOrderIndex] = updatedOrder;
                            }
                        } else if (this.currentEditOrderSourceType === 'auto' && this.uploadType === 'auto') {
                            // auto 模式下，需要找到在 orderItems 中的实际索引
                            const filteredItems = this.filteredOrderItems;
                            if (filteredItems && this.currentEditOrderIndex >= 0 && this.currentEditOrderIndex < filteredItems.length) {
                                const order = filteredItems[this.currentEditOrderIndex];
                                const actualIndex = this.orderItems.findIndex(item => item === order);
                                if (actualIndex >= 0) {
                                    this.orderItems[actualIndex] = updatedOrder;
                                }
                            }
                        } else {
                            // excel 和 image 模式
                            if (this.currentEditOrderIndex >= 0 && this.currentEditOrderIndex < this.orderItems.length) {
                                this.orderItems[this.currentEditOrderIndex] = updatedOrder;
                            }
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
                const uploadType = this.uploadType || 'image';
                console.log("showFixItemsshowFixItems", this.orderItems)
                const currentOrderItems = this.getCurrentOrderItems(uploadType);

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
                    const uploadType = this.uploadType || 'image';
                    const currentOrderItems = this.getCurrentOrderItems(uploadType);

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

                            // 根据 uploadType 更新对应的订单列表
                            if (uploadType === 'paste') {
                                this.orderItems = correctedOrders;
                                console.log('✅ [confirmFixItems] 已更新 orderItems，数量:', this.orderItems.length);
                            } else if (uploadType === 'excel-paste') {
                                this.orderItems = correctedOrders;
                                console.log('✅ [confirmFixItems] 已更新 orderItems，数量:', this.orderItems.length);
                            } else {
                                this.orderItems = correctedOrders;
                                console.log('✅ [confirmFixItems] 已更新 orderItems，数量:', this.orderItems.length);
                            }

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

                            // 再次确认订单列表没有被清空
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
                                if (uploadType === 'paste') {
                                    this.orderItems = correctedOrders;
                                } else if (uploadType === 'excel-paste') {
                                    this.orderItems = correctedOrders;
                                } else {
                                    this.orderItems = correctedOrders;
                                }
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

            // 从编辑弹窗中删除订单（参考 TodayOrders.vue 的 handleDeleteOrderFromEditModal）
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

                        // 选择性合并：只合并 revert 后需要的字段，避免将接口返回的大对象（如 nxGoodsEntities、nxDistributerGoodsEntityList 等）整体转为 Vue 深度响应式，减少内存占用
                        const mergeFields = ['nxDoStatus', 'nxDoGoodsName', 'nxDoGoodsNameOriginal', 'nxDistributerGoodsEntity', 'nxDepartmentOrdersId', 'nxDoQuantity', 'nxDoStandard', 'nxDoRemark', 'nxDoPrintStandard', 'nxDoWeight', 'nxDoPrice', 'nxDoSubtotal'];
                        const newItem = { ...orderItem };
                        mergeFields.forEach(f => {
                            if (Object.prototype.hasOwnProperty.call(updatedOrder, f)) {
                                newItem[f] = updatedOrder[f];
                            }
                        });
                        newItem.nxGoodsEntities = [];
                        newItem.nxDistributerGoodsEntityList = [];

                        if (orderIndex >= 0 && orderIndex < this.orderItems.length) {
                            this.orderItems.splice(orderIndex, 1, newItem);
                        }

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
                        if (this.isTaskOrderFromBills) this.$emit('task-list-changed', { type: 'revert' });
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
                        if (this.isTaskOrderFromBills) this.$emit('task-list-changed');
                        const updatedTask = res.data.task;
                        if (updatedTask && this.currentTaskId != null && updatedTask.nxOcrTaskId === this.currentTaskId) {
                            this.currentTask = { ...this.currentTask, ...updatedTask };
                        }
                        if (updatedTask && Array.isArray(this.taskListFromParent)) {
                            const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === updatedTask.nxOcrTaskId);
                            if (idx >= 0) {
                                this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                    i === idx ? { ...t, ...updatedTask } : t
                                );
                            }
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

                        // 如果是朗读状态（停止的订单），删除完成后继续朗读（forceContinue 跳过 nxDoStatus 检查）
                        if (sourceType && orderIndex >= 0) {
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
                        await this.$refs.alertDialog.alert(res?.data?.msg || '删除失败', 'error');
                    }
                } catch (error) {
                    console.error('❌ [handleDeleteOrder] 删除订单异常:', error);
                    await this.$refs.alertDialog.alert('删除失败，请检查网络', 'error');
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
                    await this.$refs.alertDialog.alert('请填写商品名称', 'warning');
                    return;
                }

                // 如果没有商品单位，则使用订货单位；只有当两者都为空时才提示
                const finalUnit = itemUnit.trim() || standard.trim();
                if (!finalUnit) {
                    await this.$refs.alertDialog.alert('请填写商品单位或订货单位', 'warning');
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

            // 完成任务（任务页：PasteUpload / ExcelPasteUpload / ImageUpload 的「完成」按钮）
            async onFinishTask() {
                const sourceType = this.uploadType;
                const taskId = (sourceType === 'paste' || sourceType === 'excel-paste')
                    ? this.currentTaskId
                    : sourceType === 'image'
                        ? this.currentTaskId
                        : null;
                const task = (sourceType === 'paste' || sourceType === 'excel-paste')
                    ? this.currentTask
                    : sourceType === 'image'
                        ? this.currentTask
                        : null;
                if (taskId == null) {
                    await this.$refs.alertDialog.alert('当前没有可完成的任务', 'warning');
                    return;
                }
                try {
                    await api.finishTask(taskId);
                } catch (e) {
                    console.error('finishTask failed:', e);
                    await this.$refs.alertDialog.alert(e?.message || '完成任务失败', 'error');
                    return;
                }
                // 清空当前任务
                if (sourceType === 'paste' || sourceType === 'excel-paste') {
                    this.currentTaskId = null;
                    this.currentTask = null;
                } else if (sourceType === 'image') {
                    this.currentTaskId = null;
                    this.currentTask = null;
                }
                this.selectedTaskFromList = null;
                // 刷新任务列表：任务页从 Bills 进入时用 loadTaskListAtTop，否则用各上传组件的 loadTaskList
                this.$nextTick(() => {
                    if (this.isTaskOrderFromBills && this.selectedAllCustomer) {
                        this.loadTaskListAtTop();
                        this.$emit('task-list-changed');
                    } else if (sourceType === 'paste' && this.$refs.pasteUploadRef?.loadTaskList) {
                        this.$refs.pasteUploadRef.loadTaskList();
                    } else if (sourceType === 'excel-paste' && this.$refs.excelPasteUploadRef?.loadTaskList) {
                        this.$refs.excelPasteUploadRef.loadTaskList();
                    } else if (sourceType === 'image' && this.$refs.imageUploadRef?.loadTaskList) {
                        const taskType = task?.nxOcrTaskType != null ? task.nxOcrTaskType : 1;
                        this.$refs.imageUploadRef.loadTaskList(null, { type: taskType });
                    }
                });
            },
            // 关闭任务完成提示弹窗（检查）：仅停止朗读、关闭弹窗，不清空 currentTaskId/currentTask/orderItems，用户可继续检查订单
            closeTaskCompleteModal() {
                this.showTaskCompleteModal = false;
                this.taskCompleteModalTaskId = null;
                this.taskCompleteModalSourceType = null;
                this.taskCompleteModalTask = null;
                this.stopAllReading();
            },
            // 完成任务完成弹窗（完成 - 调用接口完成任务，清空当前任务并刷新任务列表，参考 PlaceOrder）
            async confirmTaskCompleteModal() {
                // 先保存再关闭，closeTaskCompleteModal 会清空这些值；taskId 用 currentTaskId 兜底
                const taskId = this.taskCompleteModalTaskId ?? this.currentTaskId;
                const sourceType = this.taskCompleteModalSourceType ?? this.uploadType;
                const task = this.taskCompleteModalTask ?? this.currentTask;
                this.closeTaskCompleteModal();
                this.stopAllReading();
                this.currentTaskId = null;
                this.currentTask = null;
                if (taskId == null) {
                    console.warn('[TaskOrder] confirmTaskCompleteModal: taskId 为空，跳过 finishTask');
                    return;
                }
                try {
                    await api.finishTask(taskId);
                } catch (e) {
                    console.error('finishTask failed:', e);
                    await this.$refs.alertDialog.alert(e?.message || '完成任务失败', 'error');
                    return;
                }
                // 清空当前任务的订单数据，避免任务完成后仍显示旧数据
                this.clearLocalByUploadType(sourceType);
                let taskList = [];
                try {
                    if (this.isTaskOrderFromBills && this.selectedAllCustomer) {
                        taskList = await this.loadTaskListAtTop() || [];
                    } else if (sourceType === 'paste' && this.$refs.pasteUploadRef?.loadTaskList) {
                        taskList = await this.$refs.pasteUploadRef.loadTaskList() || [];
                    } else if (sourceType === 'excel-paste' && this.$refs.excelPasteUploadRef?.loadTaskList) {
                        taskList = await this.$refs.excelPasteUploadRef.loadTaskList() || [];
                    } else if (sourceType === 'image' && this.$refs.imageUploadRef?.loadTaskList) {
                        const taskType = task?.nxOcrTaskType != null ? task.nxOcrTaskType : 1;
                        taskList = await this.$refs.imageUploadRef.loadTaskList(null, { type: taskType }) || [];
                    }
                } catch (e) {
                    console.error('[TaskOrder] loadTaskList after finishTask failed:', e);
                }
                if (this.isTaskOrderFromBills) {
                    this.$emit('task-list-changed');
                }
            },
            // 关闭保存新商品弹窗
            closeSaveNewGoodsModal() {
                this.showSaveNewGoodsModal = false;
                this.currentSaveGoodsItem = null;
                this.currentSaveGoodsOrderIndex = -1;
                this.currentSaveGoodsSourceType = null;
                this.isSaveNewGoodsFromBeforeOrder = false; // 重置标记
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
                    await this.$refs.alertDialog.alert('请填写商品名称', 'warning');
                    return;
                }
                if (!this.saveNewGoodsForm.standardName || !this.saveNewGoodsForm.standardName.trim()) {
                    await this.$refs.alertDialog.alert('请填写商品规格', 'warning');
                    return;
                }
                // 获取配送商ID
                const disId = this.disUser?.nxDiuDistributerId;
                if (!disId) {
                    await this.$refs.alertDialog.alert('无法获取配送商信息', 'error');
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
                            // 自动触发商品搜索，这样新商品会出现在搜索结果中
                            await this.handleBeforeOrderGoodsNameInput(this.beforeOrderForm.goodsName);

                            // 关闭弹窗
                            this.closeSaveNewGoodsModal();
                        } else {
                            // 原有的处理逻辑：设置当前编辑的订单索引和来源类型
                            this.orderArrIndex = this.currentSaveGoodsOrderIndex;
                            this.currentSourceType = this.currentSaveGoodsSourceType;

                            // 设置商品ID和名称，然后调用 _choiceGoods 来应用这个商品
                            this.goodsId = goodsId;
                            this.selectedGoodsName = savedGoodsName;

                            // 调用保存商品选择（会自动更新订单状态）
                            await this._choiceGoods();

                            // 关闭弹窗
                            this.closeSaveNewGoodsModal();
                        }
                    } else {
                        // 保存失败
                        const errorMsg = res?.data?.message || '保存失败，可能存在相同商品';
                        await this.$refs.alertDialog.alert(errorMsg, 'error');
                        console.error('❌ [confirmSaveNewGoods] 保存新商品失败:', res);
                    }
                } catch (error) {
                    console.error('❌ [confirmSaveNewGoods] 保存新商品异常:', error);
                    await this.$refs.alertDialog.alert('保存新商品失败，请检查网络连接', 'error');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 删除订单项（无需确认弹窗）
            handleDeleteOrderItem(orderIndex, sourceType) {
                const orderItems = this.getCurrentOrderItems(sourceType);
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
                    lastSearchStr: null,
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
                    lastSearchStr: null,
                    selectedSearchIndex: 0
                };
            },

            // 处理从"在之前添加新订单"表单中保存新商品
            async handleSaveNewGoodsFromBeforeOrder({ item, orderIndex }) {
                const goodsName = this.beforeOrderForm.goodsName || '';
                const standard = (this.beforeOrderForm.standard || '').trim();

                if (!goodsName || !goodsName.trim()) {
                    await this.$refs.alertDialog.alert('请填写商品名称', 'warning');
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
                        this.handleTaskDownloadGoodsNx({ goods: form.nxArr[idx - disLen], orderIndex: payload.orderIndex });
                        return;
                    }
                }
                if (payload.type === 'search' && payload.searchStr) {
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
            handleTaskDownloadGoodsNx(eventData) {
                this.downLoadGoodsNx(eventData);
            },

            // 处理之前添加订单的商品名称输入（搜索商品，500ms 防抖）
            handleBeforeOrderGoodsNameInput(value) {
                const form = this.beforeOrderForm;
                const prevName = (form.selectedGoods?.nxDgGoodsName || form.selectedGoods?.nxGoodsName || '').trim();
                form.goodsName = value || '';
                const searchStr = (value || '').trim();
                console.log('🔍 [handleBeforeOrderGoodsNameInput] 输入值:', searchStr, 'showSearchResults:', form.showSearchResults);
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
                // 用户修改输入时清除已选商品和下拉（注意：不清空 selectedSearchIndex 和 lastSearchStr）
                if (form.selectedGoods && searchStr !== prevName) form.selectedGoods = null;
                form.showSearchResults = false;
                form.disArr = [];
                form.nxArr = [];
                if (this._beforeOrderGoodsSearchDebounce) clearTimeout(this._beforeOrderGoodsSearchDebounce);
                this._beforeOrderGoodsSearchDebounce = setTimeout(() => {
                    this._beforeOrderGoodsSearchDebounce = null;
                    this._doBeforeOrderGoodsSearch(searchStr);
                }, 500);
            },
            async _doBeforeOrderGoodsSearch(searchStr) {
                // 优先使用当前任务的部门ID
                const depId = (this.currentTask && this.currentTask.nxOcrTaskDepartmentId) ||
                              this.selectedSubDepartment ||
                              this.selectedAllCustomer;
                if (!depId || !this.disUser) return;
                try {
                    const data = {
                        disId: this.disUser.nxDiuDistributerId,
                        searchStr,
                        depId
                    };
                    console.log('🔍 [_doBeforeOrderGoodsSearch] 开始搜索, depId:', depId);
                    const res = await api.queryDisGoodsByQuickSearchWithDepId(data);
                    console.log('🔍 [_doBeforeOrderGoodsSearch] 搜索结果:', res);
                    if (res && res.data && res.data.code === 0) {
                        const disArr = res.data.data.disArr || [];
                        const nxArr = res.data.data.nxArr || [];
                        this.beforeOrderForm.disArr = disArr;
                        this.beforeOrderForm.nxArr = nxArr;
                        this.beforeOrderForm.searchResults = disArr;
                        this.beforeOrderForm.showSearchResults = disArr.length > 0 || nxArr.length > 0;
                        this.beforeOrderForm.lastSearchStr = searchStr;
                        this.beforeOrderForm.selectedSearchIndex = 0; // 重置选择索引为第一个
                        console.log('✅ [_doBeforeOrderGoodsSearch] 搜索完成, disArr:', disArr.length, 'nxArr:', nxArr.length, 'selectedSearchIndex:', this.beforeOrderForm.selectedSearchIndex);
                    } else {
                        this.beforeOrderForm.showSearchResults = false;
                        this.beforeOrderForm.searchResults = [];
                        this.beforeOrderForm.disArr = [];
                        this.beforeOrderForm.nxArr = [];
                        this.beforeOrderForm.lastSearchStr = null;
                        const errorMsg = res?.data?.msg || '';
                        if (errorMsg) {
                            if (errorMsg.includes('请继续输入')) {
                                this.showToast('搜索结果太多，请继续输入内容，缩小查询范围', 'warning');
                            } else {
                                this.showToast(errorMsg, 'error');
                            }
                        }
                    }
                } catch (error) {
                    console.error('搜索商品失败:', error);
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
                this._beforeOrderStandardHasAutoFilledCarton = false;
                this.beforeOrderForm.selectedGoods = goods;
                this.beforeOrderForm.goodsName = goods.nxDgGoodsName || '';
                this.beforeOrderForm.showSearchResults = false;

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
                        }
                    } catch (error) {
                        console.error('获取商品详细信息失败:', error);
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
            },

            // 保存之前添加的订单（调用 saveOrderBefore API）
            async saveBeforeOrder(item, orderIndex, sourceType) {
                if (!this.beforeOrderForm.selectedGoods) {
                    await this.$refs.alertDialog.alert('请选择商品', 'warning');
                    return;
                }

                if (!this.beforeOrderForm.quantity || !this.beforeOrderForm.quantity.toString().trim()) {
                    await this.$refs.alertDialog.alert('请输入数量', 'warning');
                    return;
                }

                if (!this.beforeOrderForm.standard || !this.beforeOrderForm.standard.toString().trim()) {
                    await this.$refs.alertDialog.alert('请输入规格', 'warning');
                    return;
                }

                // 获取部门ID
                const depId = this.selectedSubDepartment || this.selectedAllCustomer;
                if (!depId) {
                    await this.$refs.alertDialog.alert('无法获取部门信息', 'error');
                    return;
                }

                // 获取 beforeId（当前订单的ID，如果已保存，参考 orderPage.js:581）
                // beforeId 是选择订单的 nxDepartmentOrdersId，用于在之前插入新订单
                const beforeId = item.nxDepartmentOrdersId || -1;

                // 如果 beforeId 是 -1（订单未保存），nxDoPurchaseUserId 应该使用 disUser 的 nxDistributerUserId
                const nxDoPurchaseUserId = beforeId !== -1 ? beforeId : (this.disUser?.nxDistributerUserId || -1);

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

                    console.log("abccccurrentTaskIdcurrentTaskId" , this.currentTaskId)

                    // 调用 saveOrderBefore API（参考 resGoodsList.js）
                    const res = await api.saveOrderBefore(orderData);

                    // Vue 中 axios 返回 res.data，后端返回 { code: 0, data: {...} }
                    // 所以访问 res.data.code 和 res.data.data
                    if (res && res.data && res.data.code === 0) {
                        const updatedTask = res.data.task;
                        if (updatedTask && this.currentTaskId != null && updatedTask.nxOcrTaskId === this.currentTaskId) {
                            this.currentTask = { ...this.currentTask, ...updatedTask };
                        }
                        if (updatedTask && Array.isArray(this.taskListFromParent)) {
                            const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === updatedTask.nxOcrTaskId);
                            if (idx >= 0) {
                                this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                    i === idx ? { ...t, ...updatedTask } : t
                                );
                            }
                        }

                        // 保存成功，将新订单插入到指定位置（参考 resGoodsList.js 第812行）
                        const orderItems = this.getCurrentOrderItems(sourceType);

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

                        // 重置状态
                        this.cancelAddOrderBefore();

                    } else {
                        const errorMsg = res?.data?.msg || res?.data?.message || '保存失败';
                        await this.$refs.alertDialog.alert(errorMsg, 'error');
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    await this.$refs.alertDialog.alert('保存订单失败，请检查网络连接', 'error');
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


                const orderItems = this.getCurrentOrderItems(sourceType);



                // 如果订单有 nxDepartmentOrdersId，说明已经保存到服务器，需要调用接口删除
                if (item.nxDepartmentOrdersId) {
                    try {
                        this.$store.commit('SET_LOADING', true);

                        const res = await api.deleteOrder(item.nxDepartmentOrdersId);
                        console.log('📥 [handleDeleteOrderFromExcel] 删除接口响应:', res);

                        if (res && res.data && res.data.code === 0) {
                            console.log('✅ [handleDeleteOrderFromExcel] 删除成功，开始更新页面数据');
                            const updatedTask = res.data.task;
                            if (updatedTask && this.currentTaskId != null && updatedTask.nxOcrTaskId === this.currentTaskId) {
                                this.currentTask = { ...this.currentTask, ...updatedTask };
                            }
                            if (updatedTask && Array.isArray(this.taskListFromParent)) {
                                const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === updatedTask.nxOcrTaskId);
                                if (idx >= 0) {
                                    this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                        i === idx ? { ...t, ...updatedTask } : t
                                    );
                                }
                            }

                            // 删除后若当前任务 status=2（全部完成），弹窗提示
                            if (updatedTask && updatedTask.nxOcrTaskStatus === 2) {
                                this.stopAllReading();
                                this.showTaskCompleteModal = true;
                                this.taskCompleteModalTaskId = updatedTask.nxOcrTaskId;
                                this.taskCompleteModalSourceType = sourceType || 'paste';
                                this.taskCompleteModalTask = updatedTask;
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

                                    const actualIndex = this.orderItems.findIndex(order => order === filteredOrder);

                                    if (actualIndex >= 0) {
                                        this.orderItems.splice(actualIndex, 1);
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

                            // 删除后刷新任务列表（可能是最后一条订单，任务已被后端移除）
                            if (sourceType === 'paste' && this.$refs.pasteUploadRef?.loadTaskList) {
                                this.$nextTick(() => this.$refs.pasteUploadRef.loadTaskList());
                            }
                            if (sourceType === 'excel-paste' && this.$refs.excelPasteUploadRef?.loadTaskList) {
                                this.$nextTick(() => this.$refs.excelPasteUploadRef.loadTaskList());
                            }
                            // 任务页顶部任务列表也刷新（由父组件提供时）
                            if ((sourceType === 'paste' || sourceType === 'excel-paste') && this.loadTaskListAtTop) {
                                this.$nextTick(() => this.loadTaskListAtTop());
                            }
                            this.$emit('task-list-changed');

                            console.log('✅ [handleDeleteOrderFromExcel] 删除订单完成');
                        } else {
                            console.error('❌ [handleDeleteOrderFromExcel] 接口删除失败:', res?.data?.msg || res?.data?.message);
                            await this.$refs.alertDialog.alert(res?.data?.msg || res?.data?.message || '删除失败', 'error');
                        }
                    } catch (error) {
                        console.error('❌ [handleDeleteOrderFromExcel] 删除订单接口调用失败:', error);
                        await this.$refs.alertDialog.alert('删除失败，请检查网络连接', 'error');
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

            // ========== 图片上传相关方法 ==========

            // 处理从弹窗修改订单
            handleEditOrderFromPopup(data) {
                console.log('[PlaceOrder] 从弹窗修改订单，数据:', data);
                const { item, index } = data;

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

            onImageTTSState(payload) {
                this.imageTTSState = {
                    isTTSPlaying: !!payload.isTTSPlaying,
                    isTTSLoading: !!payload.isTTSLoading,
                    stoppedIndex: payload.stoppedIndex != null ? payload.stoppedIndex : -1
                };
            },
            handleImageReadOrderList() {
                if (this.$refs.imageOrderListRef && this.$refs.imageOrderListRef.readOrderList) {
                    this.$refs.imageOrderListRef.readOrderList();
                }
            },
            handleImagePauseReading() {
                if (this.$refs.imageOrderListRef && this.$refs.imageOrderListRef.pauseReading) {
                    this.$refs.imageOrderListRef.pauseReading();
                }
            },
            handleImageRestartReading() {
                if (this.$refs.imageOrderListRef && this.$refs.imageOrderListRef.restartReading) {
                    this.$refs.imageOrderListRef.restartReading();
                }
            },
            // 处理继续朗读订单
            handleContinueReading() {
                console.log('[PlaceOrder] 继续朗读订单');
                if (this.$refs.imageOrderListRef && this.$refs.imageOrderListRef.continueReading) {
                    this.$refs.imageOrderListRef.continueReading();
                }
            },



            //第四次
            // ========== OrderList 组件事件适配器方法（Excel模式） ==========
            // 处理商品名称输入
            handleOrderListGoodsNameInput({ item, orderIndex, value }) {
                // 更新 item.nxDoGoodsName
                item.nxDoGoodsName = value;
                // 使用辅助方法确定 sourceType
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleGoodsNameInput(item, orderIndex, sourceType);
            },

            // 处理商品名称获得焦点
            handleOrderListGoodsNameFocus({ item, orderIndex }) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleGoodsNameFocus(item, orderIndex, sourceType);
            },

            // 处理商品名称失去焦点
            handleOrderListGoodsNameBlur({ item, orderIndex }) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleGoodsNameBlur(item, orderIndex, sourceType);
            },

            // 处理数量输入
            handleOrderListQuantityInput({ item, orderIndex, value }) {
                item.nxDoQuantity = value;
            },

            // 处理规格变更
            handleOrderListStandardChange({ item, orderIndex, value }) {
                item.nxDoStandard = value;
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
            },

            // 处理更新订单
            handleOrderListUpdateOrder({ item, orderIndex }) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleUpdateOrder(item, orderIndex, sourceType);
            },

            // 处理保存新商品
            handleOrderListSaveNewGoods({ item, orderIndex, goodsName }) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleSaveNewGoods(item, orderIndex, sourceType, goodsName);
            },

            // 处理之前添加订单
            handleOrderListAddNewOrderBefore({ item, orderIndex }) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleAddNewOrderBefore(item, orderIndex, sourceType);
            },

            // 处理删除订单
            handleOrderListDeleteOrder({ item, orderIndex }) {
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.handleDeleteOrderFromExcel(item, orderIndex, sourceType);
            },

            // 处理备注输入（包括规格单位、规格重量、大包装、备注等所有字段）
            handleOrderListRemarkInput({ item, orderIndex, value, field }) {
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
            handleOrderListSelectMatchedGoods({ item, orderIndex, goodsIndex }) {
                // 使用辅助方法确定 sourceType
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.selectMatchedGoods(item, orderIndex, goodsIndex, sourceType);
            },

            // 处理选择搜索结果
            handleOrderListSelectSearchResult({ goods, orderIndex }) {
                // 使用辅助方法确定 sourceType（需要先获取对应的 item）
                const item = this.orderItems?.[orderIndex];
                const sourceType = this.determineSourceTypeForOrderList(orderIndex, item);
                this.selectSearchResult(goods, orderIndex, sourceType);
            },

            // 处理之前添加订单的商品名称输入
            handleBeforeOrderQuantityInput(value) {
                this.beforeOrderForm.quantity = value;
            },

            // 处理之前添加订单的规格输入：首次清空时自动填入大包装规格(nxDgCartonUnit)，第二次清空不再自动填入
            handleBeforeOrderStandardInput(value) {
                const trimmed = (value || '').trim();
                if (trimmed !== '') {
                    this.beforeOrderForm.standard = value;
                    return;
                }
                console.log('[handleBeforeOrderStandardInput] 用户清空规格', {
                    _beforeOrderStandardHasAutoFilledCarton: this._beforeOrderStandardHasAutoFilledCarton,
                    selectedGoods: this.beforeOrderForm.selectedGoods,
                    nxDgCartonUnit: this.beforeOrderForm.selectedGoods?.nxDgCartonUnit,
                    selectedGoodsKeys: this.beforeOrderForm.selectedGoods ? Object.keys(this.beforeOrderForm.selectedGoods) : []
                });
                if (this._beforeOrderStandardHasAutoFilledCarton) {
                    this.beforeOrderForm.standard = '';
                    return;
                }
                const carton = this.beforeOrderForm.selectedGoods?.nxDgCartonUnit;
                if (carton && String(carton).trim()) {
                    console.log('[handleBeforeOrderStandardInput] 自动填入大包装:', carton);
                    this.beforeOrderForm.standard = carton;
                    this._beforeOrderStandardHasAutoFilledCarton = true;
                } else {
                    console.log('[handleBeforeOrderStandardInput] 无大包装字段或为空，不自动填入');
                    this.beforeOrderForm.standard = '';
                }
            },

            // 处理之前添加订单的备注输入
            handleBeforeOrderRemarkInput(value) {
                this.beforeOrderForm.remark = value;
            },

            // 处理保存之前添加的订单
            handleSaveBeforeOrder({ item, orderIndex }) {
                this.saveBeforeOrder(item, orderIndex, 'excel');
            },

            // ========== OrderList 组件事件适配器方法（Image模式） ==========
            // 处理商品名称输入
            handleOrderListGoodsNameInputImage({ item, orderIndex, value }) {
                item.nxDoGoodsName = value;
                this.handleGoodsNameInput(item, orderIndex, 'image');
            },

            // 处理商品名称获得焦点
            handleOrderListGoodsNameFocusImage({ item, orderIndex }) {
                this.handleGoodsNameFocus(item, orderIndex, 'image');
            },

            // 处理商品名称失去焦点
            handleOrderListGoodsNameBlurImage({ item, orderIndex }) {
                this.handleGoodsNameBlur(item, orderIndex, 'image');
            },

            // 处理数量输入
            handleOrderListQuantityInputImage({ item, orderIndex, value }) {
                item.nxDoQuantity = value;
                this.handleQuantityInput(item, orderIndex, 'image');
            },

            // 处理规格变更
            handleOrderListStandardChangeImage({ item, orderIndex, value }) {
                item.nxDoStandard = value;
            },

            // 处理更新订单
            handleOrderListUpdateOrderImage({ item, orderIndex }) {
                this.handleUpdateOrder(item, orderIndex, 'image');
            },

            // 处理保存新商品
            handleOrderListSaveNewGoodsImage({ item, orderIndex, goodsName }) {
                this.handleSaveNewGoods(item, orderIndex, 'image', goodsName);
            },

            // 处理之前添加订单
            handleOrderListAddNewOrderBeforeImage({ item, orderIndex }) {
                this.handleAddNewOrderBefore(item, orderIndex, 'image');
            },

            // 处理删除订单
            handleOrderListDeleteOrderImage({ item, orderIndex }) {
                this.handleDeleteOrderFromExcel(item, orderIndex, 'image');
            },

            // 处理备注输入
            handleOrderListRemarkInputImage({ item, orderIndex, value, field }) {
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
            handleOrderListSelectMatchedGoodsImage({ item, orderIndex, goodsIndex }) {
                this.selectMatchedGoods(item, orderIndex, goodsIndex, 'image');
            },

            // 处理选择搜索结果
            handleOrderListSelectSearchResultImage({ goods, orderIndex }) {
                this.selectSearchResult(goods, orderIndex, 'image');
            },

            // 处理保存之前添加的订单（Image模式）
            handleSaveBeforeOrderImage({ item, orderIndex }) {
                this.saveBeforeOrder(item, orderIndex, 'image');
            },

            // ========== Excel 粘贴：DraftOrderList / OrderList 事件适配器 ==========
            handleExcelPasteDraftGoodsNameInput({ item, orderIndex, value }) {
                if (this.orderItems[orderIndex]) this.orderItems[orderIndex].nxDoGoodsName = value;
            },
            handleExcelPasteDraftQuantityInput({ item, orderIndex, value }) {
                if (this.orderItems[orderIndex]) this.orderItems[orderIndex].nxDoQuantity = value;
            },
            handleExcelPasteDraftStandardChange({ item, orderIndex, value }) {
                if (this.orderItems[orderIndex]) this.orderItems[orderIndex].nxDoStandard = value;
            },
            handleExcelPasteDraftDeleteOrder({ item, orderIndex }) {
                this.handleDeleteOrderFromExcel(item, orderIndex, 'excel-paste');
            },
            handleExcelPasteDraftRemarkInput({ item, orderIndex, value, field }) {
                if (field && this.orderItems[orderIndex]) this.orderItems[orderIndex][field] = value;
            },
            handleSaveBeforeOrderExcelPaste({ item, orderIndex }) {
                this.saveBeforeOrder(item, orderIndex, 'excel-paste');
            },
            handleOrderListGoodsNameInputExcelPaste({ item, orderIndex, value }) {
                item.nxDoGoodsName = value;
                this.handleGoodsNameInput(item, orderIndex, 'excel-paste');
            },
            handleOrderListGoodsNameFocusExcelPaste({ item, orderIndex }) {
                this.handleGoodsNameFocus(item, orderIndex, 'excel-paste');
            },
            handleOrderListGoodsNameBlurExcelPaste({ item, orderIndex }) {
                this.handleGoodsNameBlur(item, orderIndex, 'excel-paste');
            },
            handleOrderListQuantityInputExcelPaste({ item, orderIndex, value }) {
                item.nxDoQuantity = value;
            },
            handleOrderListStandardChangeExcelPaste({ item, orderIndex, value }) {
                item.nxDoStandard = value;
            },
            handleOrderListUpdateOrderExcelPaste({ item, orderIndex }) {
                this.handleUpdateOrder(item, orderIndex, 'excel-paste');
            },
            handleOrderListSaveNewGoodsExcelPaste({ item, orderIndex, goodsName }) {
                this.handleSaveNewGoods(item, orderIndex, 'excel-paste', goodsName);
            },
            handleOrderListAddNewOrderBeforeExcelPaste({ item, orderIndex }) {
                this.handleAddNewOrderBefore(item, orderIndex, 'excel-paste');
            },
            handleOrderListDeleteOrderExcelPaste({ item, orderIndex }) {
                this.handleDeleteOrderFromExcel(item, orderIndex, 'excel-paste');
            },
            handleOrderListRemarkInputExcelPaste({ item, orderIndex, value, field }) {
                if (field) item[field] = value;
                this.handleRemarkInput(item, orderIndex, 'excel-paste');
            },
            handleOrderListSelectMatchedGoodsExcelPaste({ item, orderIndex, goodsIndex }) {
                this.selectMatchedGoods(item, orderIndex, goodsIndex, 'excel-paste');
            },
            handleOrderListSelectSearchResultExcelPaste({ goods, orderIndex }) {
                this.selectSearchResult(goods, orderIndex, 'excel-paste');
            },

        //

            //第五次

            // 选择匹配的商品
            async selectMatchedGoods(item, orderIndex, goodsIndex, sourceType) {
                // 安全检查
                if (!item || !item.nxDistributerGoodsEntityList || !Array.isArray(item.nxDistributerGoodsEntityList)) {
                    console.error('[selectMatchedGoods] 订单项或商品列表不存在:', { item, orderIndex, goodsIndex });
                    return;
                }
                if (goodsIndex === undefined || goodsIndex === null || goodsIndex < 0 || goodsIndex >= item.nxDistributerGoodsEntityList.length) {
                    console.error('[selectMatchedGoods] 商品索引无效:', { orderIndex, goodsIndex, listLength: item.nxDistributerGoodsEntityList.length });
                    return;
                }
                const selectedGoods = item.nxDistributerGoodsEntityList[goodsIndex];
                if (!selectedGoods) {
                    console.error('[selectMatchedGoods] 选中的商品不存在:', { orderIndex, goodsIndex });
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

                // 调用 _choiceGoods 更新订单
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
                    console.log("taidui00000000000")

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
                    }else{
                        const errorMsg = res?.data?.msg || '';
                        await this.$refs.alertDialog.alert(errorMsg || '搜索失败', 'error');
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
                    ({ goods, orderIndex } = eventData);
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
                    await this.$refs.alertDialog.alert('商品数据错误', 'error');
                    return;
                }

                if (orderIndex === undefined || orderIndex === null) {
                    console.error("❌ [downLoadGoodsNx] orderIndex 为 undefined 或 null");
                    console.error("❌ [downLoadGoodsNx] orderIndex:", orderIndex);
                    console.error("❌ [downLoadGoodsNx] 原始 eventData:", eventData);
                    await this.$refs.alertDialog.alert('订单索引错误', 'error');
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
                            await this.$refs.alertDialog.alert(errorMsg, 'error');
                        }
                    }
                } catch (error) {
                    console.error("❌ [downLoadGoodsNx] 下载商品失败，捕获到异常:");
                    console.error("❌ [downLoadGoodsNx] 错误对象:", error);
                    console.error("❌ [downLoadGoodsNx] 错误消息:", error.message);
                    console.error("❌ [downLoadGoodsNx] 错误堆栈:", error.stack);
                    await this.$refs.alertDialog.alert('下载商品失败: ' + (error.message || '未知错误'), 'error');
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

                    // 优先使用当前任务的部门ID
                    const depId = (this.currentTask && this.currentTask.nxOcrTaskDepartmentId) ||
                                  this.selectedAllCustomer;
                    const data = {
                        disId: this.disUser.nxDiuDistributerId,
                        searchStr: searchValue,
                        depId,
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

            // 保存订单（选择商品后，参考微信小程序 _choiceGoods）
            async _choiceGoods() {
                const index = this.orderArrIndex;
                // 优先使用 currentSourceType，如果没有则使用 uploadType
                // 如果都没有，根据订单列表的情况推断
                let sourceType = this.currentSourceType;
                if (!sourceType) {
                    sourceType = this.uploadType;
                }
                if (!sourceType) {
                    sourceType = (this.orderItems && this.orderItems.length > 0) ? 'paste' : 'excel';
                }

                console.log("========== _choiceGoods 开始 ==========");
                console.log("📋 [_choiceGoods] 参数:", {
                    orderArrIndex: index,
                    currentSourceType: this.currentSourceType,
                    uploadType: this.uploadType,
                    sourceType: sourceType,
                    goodsId: this.goodsId,
                    selectedGoodsName: this.selectedGoodsName
                });

                if (index === undefined || index === null || index < 0) {
                    console.error('❌ [_choiceGoods] orderArrIndex 无效:', index);
                    return;
                }

                // 根据来源类型获取对应的订单列表
                // 对于 auto 模式，如果当前是转订单模式，需要使用 filteredOrderItems
                let currentOrderItems;
                let actualIndex = index; // 在 orderItems 中的实际索引

                console.log("🔍 [_choiceGoods] 开始查找订单列表:", {
                    sourceType,
                    uploadType: this.uploadType,
                    index,
                    orderItemsLength: this.orderItems?.length,
                    orderItemsLength: this.orderItems?.length,
                    filteredOrderItemsLength: this.uploadType === 'auto' ? this.filteredOrderItems?.length : 'N/A'
                });

                if (sourceType === 'paste' || sourceType === 'excel-paste') {
                    currentOrderItems = this.orderItems;
                    console.log("✅ [_choiceGoods] 使用 orderItems, 索引:", index);
                } else if (sourceType === 'auto' && this.uploadType === 'auto') {
                    // auto 模式下，index 是 filteredOrderItems 的索引
                    // 需要先获取 filteredOrderItems，然后找到在 orderItems 中的实际索引
                    const filteredItems = this.filteredOrderItems;
                    console.log("🔍 [_choiceGoods] auto 模式，filteredOrderItems:", {
                        filteredItemsLength: filteredItems?.length,
                        index,
                        orderItemsLength: this.orderItems?.length
                    });

                    if (!filteredItems || index >= filteredItems.length) {
                        console.error('❌ [_choiceGoods] filteredOrderItems 不存在或索引越界:', {
                            filteredItemsExists: !!filteredItems,
                            filteredItemsLength: filteredItems?.length,
                            index
                        });
                        return;
                    }
                    const order = filteredItems[index];
                    if (!order) {
                        console.error('❌ [_choiceGoods] 订单项不存在, index:', index);
                        return;
                    }
                    console.log("🔍 [_choiceGoods] 从 filteredOrderItems 获取订单:", {
                        index,
                        orderGoodsName: order.nxDoGoodsName,
                        orderId: order.nxDepartmentOrdersId
                    });
                    // 找到这个订单在 orderItems 中的实际索引
                    actualIndex = this.orderItems.findIndex(item => item === order);
                    if (actualIndex === -1) {
                        console.error('❌ [_choiceGoods] 无法在 orderItems 中找到对应的订单:', {
                            orderGoodsName: order.nxDoGoodsName,
                            orderId: order.nxDepartmentOrdersId,
                            orderItemsLength: this.orderItems?.length
                        });
                        return;
                    }
                    console.log("✅ [_choiceGoods] 找到订单在 orderItems 中的实际索引:", actualIndex);
                    currentOrderItems = this.orderItems;
                } else {
                    // excel 和 image 模式，直接使用 orderItems
                    currentOrderItems = this.orderItems;
                    actualIndex = index;
                    console.log("✅ [_choiceGoods] 使用 orderItems (excel/image 模式), 索引:", index);
                }

                if (!currentOrderItems || actualIndex >= currentOrderItems.length || actualIndex < 0) {
                    console.error('❌ [_choiceGoods] 订单列表不存在或索引越界:', {
                        sourceType,
                        uploadType: this.uploadType,
                        index,
                        actualIndex,
                        currentOrderItemsExists: !!currentOrderItems,
                        currentOrderItemsLength: currentOrderItems?.length
                    });
                    return;
                }

                const order = currentOrderItems[actualIndex];
                console.log("✅ [_choiceGoods] 找到订单:", {
                    actualIndex,
                    orderGoodsName: order?.nxDoGoodsName,
                    orderId: order?.nxDepartmentOrdersId
                });

                if (!order) {
                    console.error('❌ [_choiceGoods] 订单项不存在');
                    return;
                }

                if (!this.goodsId) {
                    console.error('goodsId 不存在，无法更新订单');
                    await this.$refs.alertDialog.alert('商品ID不存在', 'error');
                    return;
                }

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
                            this.currentTask = { ...this.currentTask, ...updatedTask };
                        }
                        if (updatedTask && Array.isArray(this.taskListFromParent)) {
                            const idx = this.taskListFromParent.findIndex(t => t && t.nxOcrTaskId === updatedTask.nxOcrTaskId);
                            if (idx >= 0) {
                                this.taskListFromParent = this.taskListFromParent.map((t, i) =>
                                    i === idx ? { ...t, ...updatedTask } : t
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

                        console.log('🔄 [_choiceGoods] 准备更新订单:', {
                            actualIndex,
                            beforeUpdate: currentOrderBeforeUpdate,
                            updatedOrder: updatedOrder
                        });

                        // 检查更新后的订单是否有 nxDepartmentOrdersId（已保存的订单）
                        // 如果已保存，需要检查是否已经存在相同 ID 的订单，避免重复
                        if (updatedOrder.nxDepartmentOrdersId) {
                            // 查找是否已经存在相同 nxDepartmentOrdersId 的订单
                            const existingIndex = currentOrderItems.findIndex(
                                (item, idx) => idx !== actualIndex &&
                                    item.nxDepartmentOrdersId === updatedOrder.nxDepartmentOrdersId
                            );

                            if (existingIndex >= 0) {
                                // 如果已存在相同 ID 的订单，移除旧的草稿订单（当前索引的订单）
                                console.log('发现重复的已保存订单，移除草稿订单:', {
                                    existingIndex,
                                    actualIndex,
                                    nxDepartmentOrdersId: updatedOrder.nxDepartmentOrdersId
                                });
                                currentOrderItems.splice(actualIndex, 1);
                            } else {
                                // 如果不存在重复，直接更新（使用 Object.assign 确保响应式更新）
                                Object.assign(currentOrderItems[actualIndex], updatedOrder);
                                console.log('✅ [_choiceGoods] 订单已更新 (已保存):', {
                                    actualIndex,
                                    updatedOrder: currentOrderItems[actualIndex]
                                });
                            }
                        } else {
                            // 如果还没有保存（没有 nxDepartmentOrdersId），直接更新（使用 Object.assign 确保响应式更新）
                            Object.assign(currentOrderItems[actualIndex], updatedOrder);
                            console.log('✅ [_choiceGoods] 订单已更新 (草稿):', {
                                actualIndex,
                                updatedOrder: currentOrderItems[actualIndex]
                            });
                        }

                        // 重置搜索和匹配商品列表状态（选择商品后关闭所有列表）
                        this.resetSearchAndMatchedGoodsState();
                    } else {
                        await this.$refs.alertDialog.alert(res?.data?.msg || '保存失败', 'error');
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    await this.$refs.alertDialog.alert('保存订单失败', 'error');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 检查订单内容（与 PlaceOrder.checkOrderContent 一致）
            async checkOrderContent(orderArr = null) {
                const orders = orderArr || this.orderItems;

                if (!orders || orders.length === 0) {
                    await this.$refs.alertDialog.alert('没有可保存的订单', 'warning');
                    return -1;
                }

                for (let i = 0; i < orders.length; i++) {
                    const order = orders[i];
                    const rowNum = i + 1;

                    if (!order.nxDoGoodsName || order.nxDoGoodsName.trim() === '') {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单商品名称为空`, 'warning');
                        return i;
                    }

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

                    if (!order.nxDoStandard || order.nxDoStandard.trim() === '') {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单规格为空`, 'warning');
                        return i;
                    }

                    const spec = order.nxDoStandard.trim();
                    const chineseOnly = /^[\u4e00-\u9fff]+$/;
                    if (!chineseOnly.test(spec)) {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单规格必须为汉字`, 'warning');
                        return i;
                    }
                    if (spec.length > 2) {
                        await this.$refs.alertDialog.alert(`第${rowNum}条订单规格汉字数量不能大于 2 个，当前为 ${spec.length} 个`, 'warning');
                        return i;
                    }
                }

                return true;
            },

            async saveExcelPasteOrders() {
                if (this.savingOrder) return;
                const checkResult = await this.checkOrderContent(this.orderItems);
                if (checkResult !== true) {
                    return;
                }

                try {
                    this.savingOrder = true;
                    this.$store.commit('SET_LOADING', true);

                    const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                    const orderData = this.orderItems.map(item => ({
                        ...item,
                        nxDoDepartmentId: targetDepId,
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoDistributerId: this.disUser?.nxDiuDistributerId,
                        nxDoIsAgent: this.disUser?.nxDistributerUserId || this.disUser?.nxDiuDistributerId
                    }));

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
                                this.stopAllReading();
                                this.showTaskCompleteModal = true;
                                this.taskCompleteModalTaskId = taskId;
                                this.taskCompleteModalSourceType = 'excel-paste';
                                this.taskCompleteModalTask = task;
                            }

                            this.$nextTick(() => {
                                if (this.$refs.excelPasteUploadRef?.addOrUpdateTaskAndSelect) {
                                    this.$refs.excelPasteUploadRef.addOrUpdateTaskAndSelect(task);
                                }
                            });
                        }
                        this.resetSearchAndMatchedGoodsState();
                        this.$emit('task-list-changed');
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

