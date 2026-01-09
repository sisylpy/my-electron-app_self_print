<template>
    <div class="save-order-tab"
         style="height: 100%; overflow: hidden; display: flex; flex-direction: column;">
        <!-- 上传方式选择 -->
        <div class="mb-3" style="flex-shrink: 0;">
            <div class="form-group d-flex gap-3 align-items-center flex-wrap">
                <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            :checked="uploadType === 'excel'"
                            value="excel"
                            class="me-2"
                            @change="handleUploadTypeChange('excel')">
                    上传Excel表
                </label>
                <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            :checked="uploadType === 'image'"
                            value="image"
                            class="me-2"
                            @change="handleUploadTypeChange('image')">
                    上传图片
                </label>
                <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            :checked="uploadType === 'paste'"
                            value="paste"
                            class="me-2"
                            @change="handleUploadTypeChange('paste')">
                    复制粘贴
                </label>
                <label class="mb-0" style="cursor: pointer;">
                    <input
                            type="radio"
                            :checked="uploadType === 'auto'"
                            value="auto"
                            class="me-2"
                            @change="handleUploadTypeChange('auto')">
                    🔄 转订单
                </label>
            </div>
        </div>

        <!-- 内容区域 -->
        <div style="flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column;">
            <!-- Excel上传区域 - 参考复制粘贴区域设计 -->
            <div v-if="uploadType === 'excel'" class="upload-section"
                 style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
                    <!-- 左侧：Excel文件上传和预览 -->
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-body p-1" style="display: flex; flex-direction: column; min-height: 0;">
                                <div v-if="!hasCache" style="flex-shrink: 0;">
                                    <input
                                            type="file"
                                            ref="excelFileInput"
                                            accept=".xlsx,.xls"
                                            @change="handleExcelUpload"
                                            class="form-control mb-2"
                                    />
                                    <small class="text-muted">支持 .xlsx 和 .xls 格式</small>
                                </div>

                                <!-- 显示已上传的文件信息和Excel预览 -->
                                <div v-if="uploadedExcelFile" class="flex-grow-1"
                                     style="display: flex; flex-direction: column; min-height: 0;">
                                    <div class="p-2 bg-light rounded mb-2" style="flex-shrink: 0;">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <div class="fw-bold">📄 {{ uploadedExcelFile.name }}</div>
                                                <div class="small text-muted">
                                                    大小: {{ formatFileSize(uploadedExcelFile.size) }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Excel内容预览 -->
                                    <div v-if="uploadedExcelPreview" class="border rounded p-2 flex-grow-1"
                                         style="overflow: hidden; min-height: 0; display: flex; flex-direction: column; border: 1px solid #dee2e6 !important; border-bottom: 1px solid #dee2e6 !important;">
                                        <div v-if="uploadedExcelPreview.sheets && uploadedExcelPreview.sheets.length > 0"
                                             style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                                            <!-- 工作表选择 -->
                                            <div v-if="uploadedExcelPreview.sheets.length > 1"
                                                 class="mb-2"
                                                 style="flex-shrink: 0; border-bottom: 1px solid #dee2e6; padding-bottom: 8px;">
                                                <select
                                                        class="form-select form-select-sm"
                                                        :value="uploadedExcelPreview.currentSheet || 0"
                                                        @change="changeUploadedExcelSheet($event.target.value)"
                                                        style="border: 1px solid #dee2e6;">
                                                    <option
                                                            v-for="(sheet, sheetIndex) in uploadedExcelPreview.sheets"
                                                            :key="sheetIndex"
                                                            :value="sheetIndex">
                                                        {{ sheet.name }}
                                                    </option>
                                                </select>
                                            </div>
                                            <!-- 表格显示 -->
                                            <div class="table-responsive flex-grow-1"
                                                 style="overflow-y: auto; min-height: 0; flex: 1; border-bottom: 1px solid #dee2e6;">
                                                <table class="table table-sm table-bordered"
                                                       style="font-size: 11px; margin-bottom: 0;">
                                                    <tbody>
                                                    <tr v-for="(row, rowIndex) in getUploadedExcelSheetData()"
                                                        :key="rowIndex">
                                                        <td
                                                                v-for="(cell, cellIndex) in row"
                                                                :key="cellIndex"
                                                                :class="{ 'bg-light': rowIndex === 0 }"
                                                                style="padding: 4px; white-space: nowrap;">
                                                            {{ cell || '' }}
                                                        </td>
                                                    </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                        <div v-else class="text-muted small">Excel文件为空或无法读取</div>
                                    </div>
                                    <div v-else-if="uploadedExcelFile"
                                         class="border rounded p-2 text-center flex-grow-1">
                                        <div class="spinner-border spinner-border-sm me-2"
                                             role="status"></div>
                                        <span class="small text-muted">加载Excel预览中...</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 右侧：订单列表（Excel模式）- 始终保留空间 -->
                    <div class="col-md-6 order-items-section"
                         style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                        <div class="card h-100 p-3"
                             style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                            <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                                <h6 class="mb-0">转换订单 ({{ orderItems.length }} 项)</h6>
                                <div class="d-flex gap-2">
                                    <button
                                            v-if="hasCache"
                                            class="btn btn-success btn-sm"
                                            @click="clearSave">
                                        完成下单
                                    </button>
                                    <button
                                            v-if="hasCache"
                                            class="btn btn-danger btn-sm"
                                            @click="reUpload">
                                        重新上传
                                    </button>
                                </div>
                            </div>

                            <!-- 订单列表内容（Excel模式） -->
                            <div class="order-list-container flex-grow-1"
                                 style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 0;">
                                <div v-if="orderItems.length === 0" class="text-center text-muted p-4">
                                    <div class="mb-2">📋 暂无订单</div>
                                    <small>请在上传Excel文件后，系统将自动解析订单</small>
                                </div>
                                <!-- 表头 -->
                                <div v-if="orderItems.length > 0"
                                     class="table-header-fixed bg-light border-bottom p-1 d-flex align-items-center fw-bold small"
                                     style="position: sticky; top: 0; z-index: 10;">
                                    <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">序号</div>
                                    <div style="flex: 2; min-width: 0;" class="table-cell">商品名称</div>
                                    <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">数量</div>
                                    <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">规格</div>
                                    <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">状态</div>
                                </div>
                                <!-- 订单列表 -->
                                <div style="padding: 0.5rem;">
                                    <div
                                            v-for="(item, orderIndex) in orderItems"
                                            :key="orderIndex"
                                            class="order-item-card mb-1 p-1 bg-white rounded border-bottom"
                                            style="position: relative;">

                                        <!-- 之前添加新订单的商品选择面板 -->
                                        <div v-if="addingOrderBeforeIndex === orderIndex"
                                             class="mb-3 p-3 border rounded"
                                             style="background-color: #fff3cd; border-color: #ffc107;">
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <h6 class="mb-0" style="color: #856404;">在之前添加新订单</h6>
                                                <button class="btn btn-sm btn-link p-0"
                                                        @click="cancelAddOrderBefore"
                                                        style="font-size: 14px; color: #856404;">✕
                                                </button>
                                            </div>

                                            <!-- 商品搜索 -->
                                            <div class="mb-2 position-relative">
                                                <label class="form-label small mb-1"
                                                       style="color: #856404;">商品名称</label>
                                                <input
                                                        type="text"
                                                        class="form-control form-control-sm"
                                                        v-model="beforeOrderForm.goodsName"
                                                        @input="handleBeforeOrderGoodsNameInput"
                                                        placeholder="搜索商品..."
                                                        style="background-color: #fff;"
                                                />
                                                <!-- 搜索结果下拉框 -->
                                                <div v-if="beforeOrderForm.showSearchResults && beforeOrderForm.searchResults.length > 0"
                                                     class="border rounded mt-1 bg-white shadow-lg"
                                                     style="max-height: 200px; overflow-y: auto; position: absolute; z-index: 1000; width: 100%;">
                                                    <div v-for="(goods, idx) in beforeOrderForm.searchResults"
                                                         :key="goods.nxDistributerGoodsId || idx"
                                                         class="p-2 border-bottom"
                                                         @click="selectBeforeOrderGoods(goods)"
                                                         style="cursor: pointer;"
                                                         :style="{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa' }">
                                                        <div class="d-flex justify-content-between align-items-center">
                                                            <span>{{ goods.nxDgGoodsName }}</span>
                                                            <span class="badge bg-secondary ms-2"
                                                                  v-if="goods.nxDgGoodsStandardname">
                                                                {{ goods.nxDgGoodsStandardname }}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- 已选商品显示 -->
                                            <div v-if="beforeOrderForm.selectedGoods" class="mb-2 p-2 bg-light rounded">
                                                <small class="text-muted">已选商品：</small>
                                                <strong>{{ beforeOrderForm.selectedGoods.nxDgGoodsName }}</strong>
                                                <span v-if="beforeOrderForm.selectedGoods.nxDgGoodsStandardname"
                                                      class="ms-2 badge bg-info">
                                                    {{ beforeOrderForm.selectedGoods.nxDgGoodsStandardname }}
                                                </span>
                                            </div>

                                            <!-- 数量、规格、备注 -->
                                            <div class="row g-2 mb-2">
                                                <div class="col-4">
                                                    <label class="form-label small mb-1"
                                                           style="color: #856404;">数量</label>
                                                    <input
                                                            type="number"
                                                            class="form-control form-control-sm"
                                                            v-model.number="beforeOrderForm.quantity"
                                                            style="background-color: #fff;"
                                                    />
                                                </div>
                                                <div class="col-4">
                                                    <label class="form-label small mb-1"
                                                           style="color: #856404;">规格</label>
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm"
                                                            v-model="beforeOrderForm.standard"
                                                            style="background-color: #fff;"
                                                    />
                                                </div>
                                                <div class="col-4">
                                                    <label class="form-label small mb-1"
                                                           style="color: #856404;">备注</label>
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm"
                                                            v-model="beforeOrderForm.remark"
                                                            style="background-color: #fff;"
                                                    />
                                                </div>
                                            </div>

                                            <!-- 操作按钮 -->
                                            <div class="d-flex gap-2 justify-content-end">
                                                <button class="btn btn-sm btn-secondary"
                                                        @click="cancelAddOrderBefore">
                                                    取消
                                                </button>
                                                <button class="btn btn-sm btn-primary"
                                                        @click="saveBeforeOrder(item, orderIndex, uploadType || 'excel')"
                                                        :disabled="!beforeOrderForm.selectedGoods || !beforeOrderForm.quantity || !beforeOrderForm.standard || !beforeOrderForm.standard.toString().trim()">
                                                    保存订单
                                                </button>
                                            </div>
                                        </div>

                                        <!-- 第一行：序号、商品名称、数量、规格、状态 -->
                                        <div class="d-flex align-items-center gap-2 mb-1" style="min-height: 32px;">
                                            <!-- 序号 -->
                                            <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold">
                                                {{ orderIndex + 1 }}
                                            </div>
                                            <!-- 商品名称输入框 -->
                                            <div style="flex: 2; min-width: 0; display: flex; align-items: center; gap: 4px;"
                                                 class="position-relative">
                                                <input
                                                        type="text"
                                                        class="form-control form-control-sm"
                                                        v-model="item.nxDoGoodsName"
                                                        @input="handleGoodsNameInput(item, orderIndex, 'excel')"
                                                        @focus="handleGoodsNameFocus(item, orderIndex, 'excel')"
                                                        @blur="handleGoodsNameBlur(item, orderIndex, 'excel')"
                                                        :disabled="item.nxDoStatus === 0"
                                                        placeholder="请输入商品名称"
                                                        style="font-size: 14px; background-color: transparent; flex: 1;"
                                                />
                                                <!-- 展开/收起匹配商品列表的图标 -->
                                                <button
                                                        v-if="item.nxDoStatus !== 0 && item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0"
                                                        class="btn btn-link btn-sm p-1"
                                                        @click="toggleMatchedGoods(orderIndex)"
                                                        :title="showMatchedGoods[orderIndex] ? '收起匹配商品' : '展开匹配商品'"
                                                        style="flex-shrink: 0; text-decoration: none; color: #6c757d; background-color: #f0f0f0; border-radius: 4px;"
                                                >
                                                    <span v-if="showMatchedGoods[orderIndex]">▼</span>
                                                    <span v-else>▶</span>
                                                </button>

                                            </div>
                                            <!-- 数量 -->
                                            <div style="width: 50px; flex-shrink: 0;">
                                                <input
                                                        type="number"
                                                        class="form-control form-control-sm text-center"
                                                        v-model.number="item.nxDoQuantity"
                                                        @input="handleQuantityInput(item, orderIndex, 'excel')"
                                                        :disabled="item.nxDoStatus === 0"
                                                        placeholder="数量"
                                                        style="background-color: transparent;"
                                                />
                                            </div>
                                            <!-- 规格 -->
                                            <div style="width: 50px; flex-shrink: 0;">
                                                <input
                                                        type="text"
                                                        class="form-control form-control-sm text-center"
                                                        v-model="item.nxDoStandard"
                                                        @input="handleStandardChange(item, orderIndex, 'excel')"
                                                        :disabled="item.nxDoStatus === 0"
                                                        placeholder="规格"
                                                        style="background-color: transparent;"
                                                />
                                            </div>
                                            <!-- 状态 -->
                                            <div style="width: 100px; flex-shrink: 0;"
                                                 class="d-flex align-items-center justify-content-center gap-1">
                                                <button v-if="item.nxDoStatus === 0"
                                                        class="btn btn-sm"
                                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                        @click="handleUpdateOrder(item, orderIndex, 'excel')"
                                                        title="修改"
                                                        @mouseenter="$event.target.style.color='#495057'"
                                                        @mouseleave="$event.target.style.color='#6c757d'">
                                                    ✏️
                                                </button>
                                                <template v-else-if="item.nxDoStatus === -2">
                                                    <button class="btn btn-sm"
                                                            :disabled="!isValidOrderQuantityAndStandard(item)"
                                                            :style="!isValidOrderQuantityAndStandard(item) ? 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #adb5bd; cursor: not-allowed;' : 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;'"
                                                            @click="handleSaveNewGoods(item, orderIndex, 'excel')"
                                                            :title="!isValidOrderQuantityAndStandard(item) ? '请填写订单数量和规格' : '保存新商品'"
                                                            @mouseenter="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#495057'"
                                                            @mouseleave="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#6c757d'">
                                                        {{ !isValidOrderQuantityAndStandard(item) ? '⚠️' : '💾' }}
                                                    </button>
                                                </template>

                                                <button class="btn btn-sm"
                                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                        @click="handleAddNewOrderBefore(item, orderIndex, 'excel')"
                                                        title="之前添加订单"
                                                        @mouseenter="$event.target.style.color='#495057'"
                                                        @mouseleave="$event.target.style.color='#6c757d'">
                                                    ⬆️
                                                </button>
                                                <button class="btn btn-sm"
                                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                        @click="handleDeleteOrderFromExcel(item, orderIndex, 'excel')"
                                                        title="删除"
                                                        @mouseenter="$event.target.style.color='#dc3545'"
                                                        @mouseleave="$event.target.style.color='#6c757d'">
                                                    🗑️
                                                </button>

                                            </div>
                                        </div>
                                        <!-- 第二行：备注（如果有） -->
                                        <div v-if="item.nxDoRemark" class="d-flex align-items-center gap-2 mt-1 ps-5">
                                            <span class="text-muted small">备注:</span>
                                            <input
                                                    type="text"
                                                    class="form-control form-control-sm"
                                                    v-model="item.nxDoRemark"
                                                    @input="handleRemarkInput(item, orderIndex, 'excel')"
                                                    :disabled="item.nxDoStatus === 0"
                                                    placeholder="备注"
                                                    maxlength="15"
                                                    style="font-size: 12px; background-color: transparent; width: 200px; flex-shrink: 0;"
                                            />
                                        </div>

                                        <!-- 匹配的商品列表（可折叠） -->
                                        <div v-if="item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 && showMatchedGoods[orderIndex] && !(orderArrIndex === orderIndex && (strArr.length > 0 || nxArr.length > 0))"
                                             class="matched-goods-list mt-2"
                                             style="margin-left: -0.5rem; margin-right: -0.5rem; width: calc(100% + 1rem);">
                                            <div class="border rounded p-2 bg-light">
                                                <div class="d-flex justify-content-between align-items-center mb-2">
                                                    <small class="text-muted fw-bold">已匹配商品列表</small>
                                                    <button
                                                            class="btn btn-sm btn-link p-0 text-muted"
                                                            @click="toggleMatchedGoods(orderIndex)"
                                                            style="font-size: 12px; text-decoration: none;"
                                                            title="收起">
                                                        ✕
                                                    </button>
                                                </div>
                                                <!-- 配送商商品 -->
                                                <div class="mb-2">
                                                    <div class="text-muted small fw-bold mb-2">配送商商品 ({{
                                                        item.nxDistributerGoodsEntityList.length }})
                                                    </div>
                                                    <div
                                                            v-for="(matchedGoods, goodsIndex) in item.nxDistributerGoodsEntityList"
                                                            :key="goodsIndex"
                                                            class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                            style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                        <!-- 商品信息 -->
                                                        <div class="flex-grow-1" style="min-width: 0;">
                                                            <span class="text-muted fw-bold me-2" style="color: #666;">{{ goodsIndex + 1 }}.</span>
                                                            <span v-if="matchedGoods.nxDgGoodsBrand && matchedGoods.nxDgGoodsBrand !== 'null'"
                                                                  class="badge bg-warning text-dark me-1">
                            {{ matchedGoods.nxDgGoodsBrand }}
                          </span>
                                                            <span class="text-dark"
                                                                  style="color: #333; font-weight: 500;">{{ matchedGoods.nxDgGoodsName }}</span>
                                                            <span class="text-muted small ms-1" style="color: #666;">
                            ({{ matchedGoods.nxDgGoodsStandardWeight && matchedGoods.nxDgGoodsStandardWeight !== 'null'
                              ? matchedGoods.nxDgGoodsStandardWeight + '/' + matchedGoods.nxDgGoodsStandardname
                              : matchedGoods.nxDgGoodsStandardname }})
                          </span>
                                                        </div>
                                                        <!-- 选择按钮 -->
                                                        <button
                                                                class="btn btn-secondary btn-sm"
                                                                @click.stop="selectMatchedGoods(item, orderIndex, goodsIndex, 'excel')"
                                                                style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff; margin-left: 8px;">
                                                            选择
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 商品搜索下拉框（相对于订单项定位，覆盖整个订单列表宽度） -->
                                        <div
                                                v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                                                class="goods-search-dropdown position-absolute bg-white border rounded shadow-lg p-2"
                                                style="top: 100%; left: -0.5rem; right: -0.5rem; width: calc(100% + 1rem); z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px;"
                                        >

                                            <!-- 搜索标题 -->
                                            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                                <button class="btn btn-sm btn-link p-0" @click="closeStr"
                                                        style="font-size: 12px;">✕
                                                </button>
                                            </div>

                                            <!-- 配送商商品列表 -->
                                            <div v-if="strArr.length > 0" class="mb-2">
                                                <div class="text-muted small fw-bold mb-2">配送商商品 ({{ strArr.length }})
                                                </div>
                                                <div
                                                        v-for="(goods, goodsIndex) in strArr"
                                                        :key="goods.nxDistributerGoodsId || goodsIndex"
                                                        class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                        @click.stop="selectSearchResult(goods, orderIndex, currentSourceType || uploadType || 'excel')"
                                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                    <!-- 商品信息 -->
                                                    <div class="flex-grow-1" style="min-width: 0;">
                                                        <span class="text-muted fw-bold me-2" style="color: #666;">{{ goodsIndex + 1 }}.</span>
                                                        <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'"
                                                              class="badge bg-warning text-dark me-1">
                              {{ goods.nxDgGoodsBrand }}
                            </span>
                                                        <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                                        <span class="text-muted small ms-1">
                              ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null'
                                ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname
                                : goods.nxDgGoodsStandardname }})
                            </span>
                                                    </div>
                                                    <!-- 选择按钮 -->
                                                    <button
                                                            class="btn btn-secondary btn-sm"
                                                            @click.stop="selectSearchResult(goods, orderIndex, currentSourceType || uploadType || 'excel')"
                                                            :class="{ 'btn-warning': !goods.nxDgNxGoodsId }"
                                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff; margin-left: 8px;">
                                                        {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                                    </button>
                                                </div>
                                            </div>

                                            <!-- 系统商品列表 -->
                                            <div v-if="nxArr.length > 0" class="mb-2">
                                                <div class="text-muted small fw-bold mb-2">系统商品 ({{ nxArr.length }})
                                                </div>
                                                <div
                                                        v-for="(goods, goodsIndex) in nxArr"
                                                        :key="goods.nxGoodsId || goodsIndex"
                                                        class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                    <!-- 商品信息 -->
                                                    <div class="flex-grow-1" style="min-width: 0;">
                                                        <span class="text-muted fw-bold me-2" style="color: #666;">{{ strArr.length + goodsIndex + 1 }}.</span>
                                                        <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'"
                                                              class="badge bg-warning text-dark me-1">
                              {{ goods.nxGoodsBrand }}
                            </span>
                                                        <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                                        <span class="text-muted small ms-1">
                              ({{ goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'
                                ? goods.nxGoodsStandardWeight + '/' + goods.nxGoodsStandardname
                                : goods.nxGoodsStandardname }})
                            </span>
                                                    </div>
                                                    <!-- 下载按钮 -->
                                                    <button
                                                            class="btn btn-info btn-sm"
                                                            @click.stop="downLoadGoodsNx(goods, orderIndex)"
                                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                                            title="下载商品">
                                                        ⬇️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            <!-- 图片上传区域 - 参考Excel上传区域设计 -->
            <div v-if="uploadType === 'image'" class="upload-section"
                 style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
                    <!-- 左侧：图片上传和预览 -->
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-body p-1" style="display: flex; flex-direction: column; min-height: 0;">
                                <!-- 图片选择功能（有缓存时隐藏，避免重复操作） -->
                                <div v-if="!hasCache" style="flex-shrink: 0;">
                                    <!--                <label class="form-label fw-bold">选择图片文件 (OCR识别)</label>-->
                                    <input
                                            type="file"
                                            ref="imageFileInput"
                                            accept="image/*"
                                            @change="handleImageUpload"
                                            class="form-control mb-2"
                                    />
                                    <small class="text-muted">支持JPG、PNG等图片格式，系统将自动识别图片中的订单信息</small>
                                </div>

                                <div v-if="uploadedImageFile" class=" flex-grow-1"
                                     style="display: flex; flex-direction: column; min-height: 0;">
                                    <div class="p-2 bg-light rounded mb-2" style="flex-shrink: 0;">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <div class="fw-bold">🖼️ {{ uploadedImageFile.name }}</div>
                                                <div class="small text-muted">大小: {{
                                                    formatFileSize(uploadedImageFile.size)
                                                    }}
                                                </div>
                                            </div>
                                            <div class="d-flex gap-2">
                                                <button v-if="!recognizingImage && !showCropMode"
                                                        class="btn btn-sm btn-primary"
                                                        @click="recognizeImage(imagePreview)">
                                                    直接识别
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- 图片预览 -->
                                    <div v-if="imagePreview" class="border rounded p-0 position-relative flex-grow-1"
                                         style="min-height: 0; overflow: hidden; cursor: move; background-color: #f5f5f5; display: flex; align-items: start; justify-content: start;"
                                         @mousedown="!showCropMode ? startDrag($event) : startCropDrag($event)"
                                         @mousemove="!showCropMode ? onDrag($event) : onCropDrag($event)"
                                         @mouseup="!showCropMode ? endDrag() : endCropDrag()"
                                         @mouseleave="!showCropMode ? endDrag() : endCropDrag()"
                                         @wheel.prevent="onWheel">
                                        <div class="position-absolute top-0 end-0 m-2 d-flex gap-1"
                                             style="z-index: 1000; background-color: rgba(255, 255, 255, 0.9); padding: 4px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                            <button class="btn btn-sm btn-outline-secondary"
                                                    @click.stop="toggleCropMode"
                                                    @mousedown.stop
                                                    :title="showCropMode ? '退出裁剪' : '裁剪图片'"
                                                    :style="showCropMode ? 'background-color: #0d6efd; border-color: #0d6efd; color: #fff;' : 'background-color: #fff; border-color: #6c757d; color: #6c757d;'">
                                                ✂️
                                            </button>
                                            <button class="btn btn-sm btn-outline-secondary"
                                                    @click.stop="resetImageTransform"
                                                    @mousedown.stop
                                                    title="重置"
                                                    style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                🔄
                                            </button>
                                            <button class="btn btn-sm btn-outline-secondary"
                                                    @click.stop="zoomIn"
                                                    @mousedown.stop
                                                    title="放大"
                                                    style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                ➕
                                            </button>
                                            <button class="btn btn-sm btn-outline-secondary"
                                                    @click.stop="zoomOut"
                                                    @mousedown.stop
                                                    title="缩小"
                                                    style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                ➖
                                            </button>
                                        </div>
                                        <div class="d-flex align-items-start justify-content-start"
                                             style="width: 100%; height: 100%; transform-origin: top left; position: relative;">
                                            <img :src="imagePreview" alt="预览" class="img-fluid"
                                                 ref="previewImage"
                                                 :style="{
                           transform: `translate(${imageTranslateX}px, ${imageTranslateY}px) scale(${imageScale})`,
                           transition: isDragging ? 'none' : 'transform 0.1s',
                           cursor: isDragging ? 'grabbing' : (showCropMode ? 'default' : 'grab'),
                           maxWidth: '100%',
                           width: 'auto',
                           height: 'auto',
                           objectFit: 'contain',
                           display: 'block'
                         }"
                                                 @load="handleImageLoad($event, 'image')"
                                                 @dragstart.prevent>
                                            
                                            <!-- 裁剪框 -->
                                            <div v-if="showCropMode"
                                                 class="crop-box"
                                                 :style="{
                                                     position: 'absolute',
                                                     left: cropBox.x + 'px',
                                                     top: cropBox.y + 'px',
                                                     width: cropBox.width + 'px',
                                                     height: cropBox.height + 'px',
                                                     border: '2px dashed #0d6efd',
                                                     backgroundColor: 'rgba(13, 110, 253, 0.1)',
                                                     cursor: isDraggingCrop ? 'grabbing' : 'move',
                                                     zIndex: 1000,
                                                     boxSizing: 'border-box'
                                                 }"
                                                 @mousedown.stop="startCropDrag($event)">
                                                <!-- 裁剪框四个角的调整手柄 -->
                                                <div class="crop-handle crop-handle-nw"
                                                     @mousedown.stop="startCropResize($event, 'nw')"
                                                     style="position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; background: #0d6efd; border: 2px solid #fff; cursor: nwse-resize; border-radius: 50%;"></div>
                                                <div class="crop-handle crop-handle-ne"
                                                     @mousedown.stop="startCropResize($event, 'ne')"
                                                     style="position: absolute; right: -5px; top: -5px; width: 10px; height: 10px; background: #0d6efd; border: 2px solid #fff; cursor: nesw-resize; border-radius: 50%;"></div>
                                                <div class="crop-handle crop-handle-sw"
                                                     @mousedown.stop="startCropResize($event, 'sw')"
                                                     style="position: absolute; left: -5px; bottom: -5px; width: 10px; height: 10px; background: #0d6efd; border: 2px solid #fff; cursor: nesw-resize; border-radius: 50%;"></div>
                                                <div class="crop-handle crop-handle-se"
                                                     @mousedown.stop="startCropResize($event, 'se')"
                                                     style="position: absolute; right: -5px; bottom: -5px; width: 10px; height: 10px; background: #0d6efd; border: 2px solid #fff; cursor: nwse-resize; border-radius: 50%;"></div>
                                            </div>
                                            
                                            <!-- 裁剪遮罩层（裁剪框外的区域变暗） -->
                                            <div v-if="showCropMode" class="crop-overlay"
                                                 style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999;">
                                                <svg style="width: 100%; height: 100%;">
                                                    <defs>
                                                        <mask id="crop-mask">
                                                            <rect width="100%" height="100%" fill="white"/>
                                                            <rect :x="cropBox.x" :y="cropBox.y" :width="cropBox.width" :height="cropBox.height" fill="black"/>
                                                        </mask>
                                                    </defs>
                                                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask)"/>
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- 裁剪操作按钮（放在图片预览容器内） -->
                                    <div v-if="showCropMode && imagePreview" 
                                         class="position-absolute d-flex gap-2"
                                         style="bottom: 15px; left: 50%; transform: translateX(-50%); z-index: 1002; pointer-events: auto;">
                                        <button class="btn btn-sm btn-secondary"
                                                @click.stop="cancelCrop"
                                                @mousedown.stop
                                                style="background-color: #fff; border: 2px solid #6c757d; box-shadow: 0 2px 8px rgba(0,0,0,0.4); font-weight: bold; min-width: 80px;">
                                            取消
                                        </button>
                                        <button class="btn btn-sm btn-primary"
                                                @click.stop="applyCrop"
                                                @mousedown.stop
                                                style="background-color: #0d6efd; border: 2px solid #0d6efd; box-shadow: 0 2px 8px rgba(0,0,0,0.4); font-weight: bold; min-width: 100px;">
                                            确认裁剪
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 右侧：订单列表（图片模式）- 始终保留空间 -->
                    <div class="col-md-6 order-items-section"
                         style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                        <div class="card h-100 p-3"
                             style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                            <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                                <h6 class="mb-0">转换订单 ({{ orderItems.length }} 项)</h6>
                                <div class="d-flex gap-2">
                                    <button
                                            v-if="hasCache"
                                            class="btn btn-success btn-sm"
                                            @click="clearSave">
                                        完成下单
                                    </button>
                                    <button
                                            v-if="hasCache"
                                            class="btn btn-warning btn-sm"
                                            @click="reUpload">
                                        重新上传
                                    </button>
                                </div>
                            </div>

                            <!-- 订单列表内容（图片模式） -->
                            <div class="order-list-container flex-grow-1"
                                 style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 0;">
                                <div v-if="orderItems.length === 0" class="text-center text-muted p-4">
                                    <div class="mb-2">📋 暂无订单</div>
                                    <small>请在上传图片并识别后，系统将自动解析订单</small>
                                </div>
                                <!-- 表头 -->
                                <div v-if="orderItems.length > 0"
                                     class="table-header-fixed bg-light border-bottom p-1 d-flex align-items-center fw-bold small"
                                     style="position: sticky; top: 0; z-index: 10;">
                                    <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">序号</div>
                                    <div style="flex: 2; min-width: 0;" class="table-cell">商品名称</div>
                                    <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">数量</div>
                                    <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">规格</div>
                                    <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">状态</div>
                                </div>
                                <!-- 订单列表 -->
                                <div style="padding: 0.5rem;">
                                    <div
                                            v-for="(item, orderIndex) in orderItems"
                                            :key="orderIndex"
                                            class="order-item-card mb-1 p-1 bg-white rounded border-bottom"
                                            style="position: relative;">

                                        <!-- 之前添加新订单的商品选择面板 -->
                                        <div v-if="addingOrderBeforeIndex === orderIndex"
                                             class="mb-3 p-3 border rounded"
                                             style="background-color: #fff3cd; border-color: #ffc107;">
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <h6 class="mb-0" style="color: #856404;">在之前添加新订单</h6>
                                                <button class="btn btn-sm btn-link p-0"
                                                        @click="cancelAddOrderBefore"
                                                        style="font-size: 14px; color: #856404;">✕
                                                </button>
                                            </div>

                                            <!-- 商品搜索 -->
                                            <div class="mb-2 position-relative">
                                                <label class="form-label small mb-1"
                                                       style="color: #856404;">商品名称</label>
                                                <input
                                                        type="text"
                                                        class="form-control form-control-sm"
                                                        v-model="beforeOrderForm.goodsName"
                                                        @input="handleBeforeOrderGoodsNameInput"
                                                        placeholder="搜索商品..."
                                                        style="background-color: #fff;"
                                                />
                                                <!-- 搜索结果下拉框 -->
                                                <div v-if="beforeOrderForm.showSearchResults && beforeOrderForm.searchResults.length > 0"
                                                     class="border rounded mt-1 bg-white shadow-lg"
                                                     style="max-height: 200px; overflow-y: auto; position: absolute; z-index: 1000; width: 100%;">
                                                    <div v-for="(goods, idx) in beforeOrderForm.searchResults"
                                                         :key="goods.nxDistributerGoodsId || idx"
                                                         class="p-2 border-bottom"
                                                         @click="selectBeforeOrderGoods(goods)"
                                                         style="cursor: pointer;"
                                                         :style="{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa' }">
                                                        <div class="d-flex justify-content-between align-items-center">
                                                            <span>{{ goods.nxDgGoodsName }}</span>
                                                            <span class="badge bg-secondary ms-2"
                                                                  v-if="goods.nxDgGoodsStandardname">
                                                                {{ goods.nxDgGoodsStandardname }}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- 已选商品显示 -->
                                            <div v-if="beforeOrderForm.selectedGoods" class="mb-2 p-2 bg-light rounded">
                                                <small class="text-muted">已选商品：</small>
                                                <strong>{{ beforeOrderForm.selectedGoods.nxDgGoodsName }}</strong>
                                                <span v-if="beforeOrderForm.selectedGoods.nxDgGoodsStandardname"
                                                      class="ms-2 badge bg-info">
                                                    {{ beforeOrderForm.selectedGoods.nxDgGoodsStandardname }}
                                                </span>
                                            </div>

                                            <!-- 数量、规格、备注 -->
                                            <div class="row g-2 mb-2">
                                                <div class="col-4">
                                                    <label class="form-label small mb-1"
                                                           style="color: #856404;">数量</label>
                                                    <input
                                                            type="number"
                                                            class="form-control form-control-sm"
                                                            v-model.number="beforeOrderForm.quantity"
                                                            style="background-color: #fff;"
                                                    />
                                                </div>
                                                <div class="col-4">
                                                    <label class="form-label small mb-1"
                                                           style="color: #856404;">规格</label>
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm"
                                                            v-model="beforeOrderForm.standard"
                                                            style="background-color: #fff;"
                                                    />
                                                </div>
                                                <div class="col-4">
                                                    <label class="form-label small mb-1"
                                                           style="color: #856404;">备注</label>
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm"
                                                            v-model="beforeOrderForm.remark"
                                                            style="background-color: #fff;"
                                                    />
                                                </div>
                                            </div>

                                            <!-- 操作按钮 -->
                                            <div class="d-flex gap-2 justify-content-end">
                                                <button class="btn btn-sm btn-secondary"
                                                        @click="cancelAddOrderBefore">
                                                    取消
                                                </button>
                                                <button class="btn btn-sm btn-primary"
                                                        @click="saveBeforeOrder(item, orderIndex, uploadType || 'excel')"
                                                        :disabled="!beforeOrderForm.selectedGoods || !beforeOrderForm.quantity || !beforeOrderForm.standard || !beforeOrderForm.standard.toString().trim()">
                                                    保存订单
                                                </button>
                                            </div>
                                        </div>


                                        <!-- 第一行：序号、商品名称、数量、规格、状态 -->
                                        <div class="d-flex align-items-center gap-2 mb-1" style="min-height: 32px;">
                                            <!-- 序号 -->
                                            <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold">
                                                {{ orderIndex + 1 }}
                                            </div>
                                            <!-- 商品名称（可编辑） -->
                                            <div style="flex: 2; min-width: 0; display: flex; align-items: center; gap: 4px;"
                                                 class="position-relative">
                                                <input
                                                        type="text"
                                                        v-model="item.nxDoGoodsName"
                                                        @input="handleGoodsNameInput(item, orderIndex, 'image')"
                                                        @focus="handleGoodsNameFocus(item, orderIndex, 'image')"
                                                        @blur="handleGoodsNameBlur(item, orderIndex, 'image')"
                                                        class="form-control form-control-sm"
                                                        :disabled="item.nxDoStatus === 0 || !isValidOrderQuantityAndStandard(item)"
                                                        :title="!isValidOrderQuantityAndStandard(item) ? '请先填写数量和规格' : ''"
                                                        placeholder="请输入商品名称"
                                                        style="font-size: 14px; background-color: transparent; flex: 1;"
                                                />
                                                <!-- 显示已匹配商品列表的图标 -->
                                                <button
                                                        v-if="item.nxDoStatus !== 0 && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                                        class="btn btn-link btn-sm p-1"
                                                        @click="toggleMatchedGoods(orderIndex)"
                                                        :title="showMatchedGoods[orderIndex] ? '隐藏已匹配商品' : '显示已匹配商品'"
                                                        style="flex-shrink: 0; text-decoration: none; color: #6c757d; background-color: #f0f0f0; border-radius: 4px;"
                                                >
                                                    <span v-if="showMatchedGoods[orderIndex]">▼</span>
                                                    <span v-else>▶</span>
                                                </button>
                                            </div>
                                            <!-- 数量 -->
                                            <div style="width: 50px; flex-shrink: 0;">
                                                <input
                                                        type="number"
                                                        class="form-control form-control-sm text-center"
                                                        v-model.number="item.nxDoQuantity"
                                                        @input="handleQuantityInput(item, orderIndex, 'image')"
                                                        :disabled="item.nxDoStatus === 0"
                                                        placeholder="数量"
                                                        style="background-color: transparent;"
                                                />
                                            </div>
                                            <!-- 规格 -->
                                            <div style="width: 50px; flex-shrink: 0;">
                                                <input
                                                        type="text"
                                                        class="form-control form-control-sm text-center"
                                                        v-model="item.nxDoStandard"
                                                        @input="handleStandardChange(item, orderIndex, 'image')"
                                                        :disabled="item.nxDoStatus === 0"
                                                        placeholder="规格"
                                                        style="background-color: transparent;"
                                                />
                                            </div>
                                            <!-- 状态 -->
                                            <div style="width: 100px; flex-shrink: 0;"
                                                 class="d-flex align-items-center justify-content-center gap-1">
                                                <button v-if="item.nxDoStatus === 0"
                                                        class="btn btn-sm"
                                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                        @click="handleUpdateOrder(item, orderIndex, 'image')"
                                                        title="修改"
                                                        @mouseenter="$event.target.style.color='#495057'"
                                                        @mouseleave="$event.target.style.color='#6c757d'">
                                                    ✏️
                                                </button>
                                                <template v-else-if="item.nxDoStatus === -2">
                                                    <button class="btn btn-sm"
                                                            :disabled="!isValidOrderQuantityAndStandard(item)"
                                                            :style="!isValidOrderQuantityAndStandard(item) ? 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #adb5bd; cursor: not-allowed;' : 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;'"
                                                            @click="handleSaveNewGoods(item, orderIndex, 'image')"
                                                            :title="!isValidOrderQuantityAndStandard(item) ? '请填写订单数量和规格' : '保存新商品'"
                                                            @mouseenter="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#495057'"
                                                            @mouseleave="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#6c757d'">
                                                        {{ !isValidOrderQuantityAndStandard(item) ? '⚠️' : '💾' }}
                                                    </button>

                                                </template>
                                                <button class="btn btn-sm"
                                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                        @click="handleAddNewOrderBefore(item, orderIndex, 'image')"
                                                        title="之前添加订单"
                                                        @mouseenter="$event.target.style.color='#495057'"
                                                        @mouseleave="$event.target.style.color='#6c757d'">
                                                    ⬆️
                                                </button>
                                                <button class="btn btn-sm"
                                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                        @click="handleDeleteOrderFromExcel(item, orderIndex, 'image')"
                                                        title="删除"
                                                        @mouseenter="$event.target.style.color='#dc3545'"
                                                        @mouseleave="$event.target.style.color='#6c757d'">
                                                    🗑️
                                                </button>


                                            </div>
                                        </div>
                                        <!-- 第二行：备注（如果有） -->
                                        <div v-if="item.nxDoRemark" class="d-flex align-items-center gap-2 mt-1 ps-5">
                                            <span class="text-muted small">备注:</span>
                                            <input
                                                    type="text"
                                                    class="form-control form-control-sm"
                                                    v-model="item.nxDoRemark"
                                                    @input="handleRemarkInput(item, orderIndex, 'image')"
                                                    :disabled="item.nxDoStatus === 0"
                                                    placeholder="备注"
                                                    maxlength="15"
                                                    style="font-size: 12px; background-color: transparent; width: 200px; flex-shrink: 0;"
                                            />
                                        </div>

                                        <!-- 商品搜索下拉框（相对于订单项定位，覆盖整个订单列表宽度） -->
                                        <div
                                                v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                                                class="goods-search-dropdown position-absolute bg-white border rounded shadow-lg p-2"
                                                style="top: 100%; left: -0.5rem; right: -0.5rem; width: calc(100% + 1rem); z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px;">

                                            <!-- 搜索标题 -->
                                            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                                <button class="btn btn-sm btn-link p-0" @click="closeStr"
                                                        style="font-size: 12px;">✕
                                                </button>
                                            </div>

                                            <!-- 配送商商品列表 -->
                                            <div v-if="strArr.length > 0" class="mb-2">
                                                <div class="text-muted small fw-bold mb-2">配送商商品 ({{
                                                    strArr.length
                                                    }})
                                                </div>
                                                <div
                                                        v-for="(goods, goodsIndex) in strArr"
                                                        :key="goods.nxDistributerGoodsId || goodsIndex"
                                                        class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                        @click.stop="selectSearchResult(goods, orderIndex, currentSourceType || uploadType || 'image')"
                                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                    <!-- 商品信息 -->
                                                    <div class="flex-grow-1" style="min-width: 0;">
                                    <span class="text-muted fw-bold me-2"
                                          style="color: #666;">{{ goodsIndex + 1 }}.</span>
                                                        <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'"
                                                              class="badge bg-warning text-dark me-1">
                                        {{ goods.nxDgGoodsBrand }}
                                    </span>
                                                        <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                                        <span class="text-muted small ms-1">
                                        ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null'
                                          ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname
                                          : goods.nxDgGoodsStandardname }})
                                    </span>
                                                    </div>
                                                    <!-- 选择按钮 -->
                                                    <button
                                                            class="btn btn-secondary btn-sm"
                                                            @click.stop="selectSearchResult(goods, orderIndex, currentSourceType || uploadType || 'image')"
                                                            :class="{ 'btn-warning': !goods.nxDgNxGoodsId }"
                                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff; margin-left: 8px;">
                                                        {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                                    </button>
                                                </div>
                                            </div>

                                            <!-- 系统商品列表 -->
                                            <div v-if="nxArr.length > 0" class="mb-2">
                                                <div class="text-muted small fw-bold mb-2">系统商品 ({{ nxArr.length
                                                    }})
                                                </div>
                                                <div
                                                        v-for="(goods, goodsIndex) in nxArr"
                                                        :key="goods.nxGoodsId || goodsIndex"
                                                        class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                    <!-- 商品信息 -->
                                                    <div class="flex-grow-1" style="min-width: 0;">
                                    <span class="text-muted fw-bold me-2"
                                          style="color: #666;">{{ strArr.length + goodsIndex + 1 }}.</span>
                                                        <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'"
                                                              class="badge bg-warning text-dark me-1">
                                        {{ goods.nxGoodsBrand }}
                                    </span>
                                                        <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                                        <span class="text-muted small ms-1">
                                        ({{ goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'
                                          ? goods.nxGoodsStandardWeight + '/' + goods.nxGoodsStandardname
                                          : goods.nxGoodsStandardname }})
                                    </span>
                                                    </div>
                                                    <!-- 下载按钮 -->
                                                    <button
                                                            class="btn btn-info btn-sm"
                                                            @click.stop="downLoadGoodsNx(goods, orderIndex)"
                                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                                            title="下载商品">
                                                        ⬇️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 已匹配的商品列表 -->
                                        <div
                                                v-if="item.nxDoStatus !== 0 && showMatchedGoods[orderIndex] && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0) && !(orderArrIndex === orderIndex && (strArr.length > 0 || nxArr.length > 0))"
                                                class="matched-goods-list position-absolute bg-white border rounded shadow-lg p-2"
                                                style="top: 100%; left: -0.5rem; right: -0.5rem; width: calc(100% + 1rem); z-index: 999; max-height: 400px; overflow-y: auto; margin-top: 4px; border-left: 1px solid gray;">

                                            <!-- 标题栏和关闭按钮 -->
                                            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                <span class="text-muted small fw-bold">已匹配商品列表</span>
                                                <button
                                                        class="btn btn-sm btn-link p-0"
                                                        @click="toggleMatchedGoods(orderIndex)"
                                                        style="font-size: 12px; color: #6c757d;"
                                                        title="隐藏">
                                                    ✕
                                                </button>
                                            </div>

                                            <!-- 配送商已匹配商品列表 -->
                                            <div v-if="item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0"
                                                 class="mb-2">
                                                <div class="text-muted small fw-bold mb-2">配送商商品 ({{
                                                    item.nxDistributerGoodsEntityList.length }})
                                                </div>
                                                <div
                                                        v-for="(orderGoods, orderGoodsIndex) in item.nxDistributerGoodsEntityList"
                                                        :key="orderGoods.nxDistributerGoodsId || orderGoodsIndex"
                                                        class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                    <!-- 商品信息 -->
                                                    <div class="flex-grow-1" style="min-width: 0;">
                                                        <span class="text-muted fw-bold me-2" style="color: #666;">{{ orderGoodsIndex + 1 }}.</span>
                                                        <span v-if="orderGoods.nxDgGoodsBrand && orderGoods.nxDgGoodsBrand !== 'null'"
                                                              class="badge bg-warning text-dark me-1">
                              {{ orderGoods.nxDgGoodsBrand }}
                            </span>
                                                        <span class="text-dark" style="color: #333; font-weight: 500;">{{ orderGoods.nxDgGoodsName }}</span>
                                                        <span class="text-muted small ms-1" style="color: #666;">
                              ({{ orderGoods.nxDgGoodsStandardWeight && orderGoods.nxDgGoodsStandardWeight !== 'null'
                                ? orderGoods.nxDgGoodsStandardWeight + '/' + orderGoods.nxDgGoodsStandardname
                                : orderGoods.nxDgGoodsStandardname }})
                            </span>
                                                    </div>
                                                    <!-- 选择按钮 -->
                                                    <button
                                                            class="btn btn-secondary btn-sm"
                                                            @click.stop="selectMatchedGoods(item, orderIndex, orderGoodsIndex, 'image')"
                                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff; margin-left: 8px;">
                                                        选择
                                                    </button>
                                                </div>
                                            </div>

                                            <!-- 系统已匹配商品列表 -->
                                            <div v-if="item.nxGoodsEntities && item.nxGoodsEntities.length > 0"
                                                 class="mb-2">
                                                <div class="text-muted small fw-bold mb-2">系统商品 ({{
                                                    item.nxGoodsEntities.length }})
                                                </div>
                                                <div
                                                        v-for="(goods, nxIndex) in item.nxGoodsEntities"
                                                        :key="goods.nxGoodsId || nxIndex"
                                                        class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                    <!-- 商品信息 -->
                                                    <div class="flex-grow-1" style="min-width: 0;">
                                                        <span class="text-muted fw-bold me-2" style="color: #666;">{{ nxIndex + 1 }}.</span>
                                                        <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'"
                                                              class="badge bg-warning text-dark me-1">
                                {{ goods.nxGoodsBrand }}
                              </span>
                                                        <span class="text-dark" style="color: #333; font-weight: 500;">{{ goods.nxGoodsName }}</span>
                                                        <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0"
                                                              v-for="(alias, aliasIndex) in goods.nxAliasEntities"
                                                              :key="alias.nxDaAliasName || aliasIndex"
                                                              class="text-primary me-1"
                                                              style="color: #1c7efb; margin-right: 8px;">
                                @{{ alias.nxDaAliasName }}
                              </span>
                                                        <span class="text-muted small ms-1" style="color: #666;">
                                <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                  <template v-if="goods.nxGoodsStandardname !== '斤'">
                                    ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                  </template>
                                </template>
                                <template v-else>
                                  ({{ goods.nxGoodsStandardname }})
                                </template>
                              </span>
                                                        <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'"
                                                              class="text-muted small me-2"
                                                              style="color: #666; margin-right: 12px;">
                                产地:{{ goods.nxGoodsPlace }}
                              </span>
                                                        <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'"
                                                              class="text-muted small"
                                                              style="color: #666;">
                                {{ goods.nxGoodsDetail }}
                              </span>
                                                    </div>
                                                    <!-- 下载按钮 -->
                                                    <button
                                                            class="btn btn-info btn-sm"
                                                            @click.stop="downLoadGoodsNx(goods, orderIndex)"
                                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                                            title="下载商品">
                                                        ⬇️
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 复制粘贴区域 -->
            <div v-if="uploadType === 'paste'" class="upload-section"
                 style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
                    <!-- 左侧：粘贴输入框 -->
                    <div class="col-md-4">
                        <div class="card h-100">
                            <div class="card-body p-1"
                                 style="display: flex; flex-direction: column; min-height: 0; flex: 1;">
                                <!-- 粘贴输入框 -->
                                <div style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                <textarea
                        v-model="pasteInputText"
                        @input="onPasteInput"
                        :disabled="pasteHasCache"
                        class="form-control mb-2"
                        :class="{ 'bg-light': pasteHasCache }"
                        placeholder="请将订单文本粘贴到这里，例如：&#10;苹果 5 斤&#10;香蕉 3 斤&#10;橙子 2 斤"
                        style="font-size: 14px; min-height: 0; flex: 1;  "
                ></textarea>
                                    <!-- 保存订单后隐藏这三个按钮 -->
                                    <div v-if="!pasteHasCache && pasteSaveCount == null && pasteOrderItems.length === 0"
                                         class="d-flex gap-2 mt-2 flex-wrap" style="margin-bottom:40px;">
                                        <button class="btn btn-sm btn-primary" @click="pasteFromClipboard">从剪贴板粘贴
                                        </button>
                                        <button class="btn btn-sm btn-info" @click="aiRecogniseFirst"
                                                :disabled="!pasteInputText || pasteInputText.trim() === '' || showDeepSeekLoading">
                                            {{ showDeepSeekLoading ? 'AI识别中...' : 'AI识别' }}
                                        </button>
                                        <button class="btn btn-sm btn-success" @click="parsePasteText"
                                                :disabled="!pasteInputText || pasteInputText.trim() === ''">人工识别
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 右侧：订单列表（复制粘贴独立）- 始终保留空间 -->
                    <div class="col-md-8 order-items-section"
                         style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                        <div class="card h-100 p-3"
                             style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                            <div class="d-flex justify-content-between align-items-center mb-3" style="flex-shrink: 0;">
                                <h6 class="mb-0">解析订单 ({{ pasteOrderItems.length }} 项)</h6>
                                <div class="d-flex gap-2">
                                    <!-- 状态1：草稿状态（pasteSaveCount == null） -->
                                    <template v-if="pasteSaveCount == null">
                                        <button v-if="pasteOrderItems.length > 0" class="btn btn-secondary btn-sm"
                                                @click="againPaste">
                                            清空内容
                                        </button>
                                        <button v-if="pasteOrderItems.length > 0" class="btn btn-success btn-sm"
                                                @click="savePasteOrders" :disabled="savingOrder">
                                            {{ savingOrder ? '保存中...' : '保存订单' }}
                                        </button>
                                    </template>
                                    <!-- 状态2：已保存状态（pasteSaveCount != null） -->
                                    <template v-else>
                                        <button v-if="pasteHasCache" class="btn btn-success btn-sm"
                                                @click="clearPasteSave">
                                            完成下单
                                        </button>
                                        <button v-if="pasteHasCache" class="btn btn-warning btn-sm"
                                                @click="reUpload">
                                            重新上传
                                        </button>
                                    </template>
                                </div>
                            </div>
                            <!-- 订单列表内容（复制粘贴独立显示） -->
                            <div class="order-list-container flex-grow-1"
                                 style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 0;">
                                <div v-if="pasteOrderItems.length === 0" class="text-center text-muted p-4">
                                    <div class="mb-2">📋 暂无订单</div>
                                    <small>请粘贴订单文本并解析后，系统将显示订单列表</small>
                                </div>

                                <!-- 状态1：草稿状态（pasteSaveCount == null）- 可编辑界面 -->
                                <template v-if="pasteSaveCount == null && pasteOrderItems.length > 0">
                                    <!-- 表头 -->
                                    <div class="table-header-fixed bg-light border-bottom p-1 d-flex align-items-center fw-bold small"
                                         style="position: sticky; top: 0; z-index: 10; background-color: #eeeeee;">
                                        <div style="width: 50px; flex-shrink: 0; margin-left: 15px;"
                                             class="text-center table-cell">序号
                                        </div>
                                        <div style="flex: 2; min-width: 0;" class="table-cell">商品名称</div>
                                        <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">数量
                                        </div>
                                        <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">规格
                                        </div>
                                    </div>
                                    <!-- 订单列表 -->
                                    <div style="padding: 0.5rem;">
                                        <div
                                                v-for="(item, orderIndex) in pasteOrderItems"
                                                :key="orderIndex"
                                                class="order-item-card mb-1 p-1 bg-white rounded border-bottom"
                                                style="position: relative;">

                                            <!-- 之前添加新订单的商品选择面板 -->
                                            <div v-if="addingOrderBeforeIndex === orderIndex"
                                                 class="mb-3 p-3 border rounded"
                                                 style="background-color: #fff3cd; border-color: #ffc107;">
                                                <div class="d-flex justify-content-between align-items-center mb-2">
                                                    <h6 class="mb-0" style="color: #856404;">在之前添加新订单</h6>
                                                    <button class="btn btn-sm btn-link p-0"
                                                            @click="cancelAddOrderBefore"
                                                            style="font-size: 14px; color: #856404;">✕
                                                    </button>
                                                </div>

                                                <!-- 商品搜索 -->
                                                <div class="mb-2 position-relative">
                                                    <label class="form-label small mb-1"
                                                           style="color: #856404;">商品名称</label>
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm"
                                                            v-model="beforeOrderForm.goodsName"
                                                            @input="handleBeforeOrderGoodsNameInput"
                                                            placeholder="搜索商品..."
                                                            style="background-color: #fff;"
                                                    />
                                                    <!-- 搜索结果下拉框 -->
                                                    <div v-if="beforeOrderForm.showSearchResults && beforeOrderForm.searchResults.length > 0"
                                                         class="border rounded mt-1 bg-white shadow-lg"
                                                         style="max-height: 200px; overflow-y: auto; position: absolute; z-index: 1000; width: 100%;">
                                                        <div v-for="(goods, idx) in beforeOrderForm.searchResults"
                                                             :key="goods.nxDistributerGoodsId || idx"
                                                             class="p-2 border-bottom"
                                                             @click="selectBeforeOrderGoods(goods)"
                                                             style="cursor: pointer;"
                                                             :style="{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa' }">
                                                            <div class="d-flex justify-content-between align-items-center">
                                                                <span>{{ goods.nxDgGoodsName }}</span>
                                                                <span class="badge bg-secondary ms-2"
                                                                      v-if="goods.nxDgGoodsStandardname">
                                                                {{ goods.nxDgGoodsStandardname }}
                                                            </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- 已选商品显示 -->
                                                <div v-if="beforeOrderForm.selectedGoods"
                                                     class="mb-2 p-2 bg-light rounded">
                                                    <small class="text-muted">已选商品：</small>
                                                    <strong>{{ beforeOrderForm.selectedGoods.nxDgGoodsName }}</strong>
                                                    <span v-if="beforeOrderForm.selectedGoods.nxDgGoodsStandardname"
                                                          class="ms-2 badge bg-info">
                                                    {{ beforeOrderForm.selectedGoods.nxDgGoodsStandardname }}
                                                </span>
                                                </div>

                                                <!-- 数量、规格、备注 -->
                                                <div class="row g-2 mb-2">
                                                    <div class="col-4">
                                                        <label class="form-label small mb-1"
                                                               style="color: #856404;">数量</label>
                                                        <input
                                                                type="number"
                                                                class="form-control form-control-sm"
                                                                v-model.number="beforeOrderForm.quantity"
                                                                style="background-color: #fff;"
                                                        />
                                                    </div>
                                                    <div class="col-4">
                                                        <label class="form-label small mb-1"
                                                               style="color: #856404;">规格</label>
                                                        <input
                                                                type="text"
                                                                class="form-control form-control-sm"
                                                                v-model="beforeOrderForm.standard"
                                                                style="background-color: #fff;"
                                                        />
                                                    </div>
                                                    <div class="col-4">
                                                        <label class="form-label small mb-1"
                                                               style="color: #856404;">备注</label>
                                                        <input
                                                                type="text"
                                                                class="form-control form-control-sm"
                                                                v-model="beforeOrderForm.remark"
                                                                style="background-color: #fff;"
                                                        />
                                                    </div>
                                                </div>

                                                <!-- 操作按钮 -->
                                                <div class="d-flex gap-2 justify-content-end">
                                                    <button class="btn btn-sm btn-secondary"
                                                            @click="cancelAddOrderBefore">
                                                        取消
                                                    </button>
                                                    <button class="btn btn-sm btn-primary"
                                                            @click="saveBeforeOrder(item, orderIndex, uploadType || 'excel')"
                                                            :disabled="!beforeOrderForm.selectedGoods || !beforeOrderForm.quantity">
                                                        保存订单
                                                    </button>
                                                </div>
                                            </div>


                                            <!-- 第一行：序号、商品名称、数量、规格 -->
                                            <div class="d-flex align-items-center gap-2 mb-1" style="min-height: 32px;">
                                                <!-- 序号 -->
                                                <div style="width: 50px; flex-shrink: 0; margin-left: 15px;"
                                                     class="text-center fw-bold">
                                                    {{ orderIndex + 1 }}.
                                                </div>
                                                <!-- 商品名称输入框（草稿状态下只编辑，不搜索） -->
                                                <div style="flex: 2; min-width: 0;">
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm"
                                                            v-model="item.nxDoGoodsName"
                                                            placeholder="请输入商品名称"
                                                            style="font-size: 14px; background-color: transparent; width: 100%;"
                                                    />
                                                </div>
                                                <!-- 数量 -->
                                                <div style="width: 80px; flex-shrink: 0;">
                                                    <input
                                                            type="number"
                                                            class="form-control form-control-sm text-center"
                                                            v-model.number="item.nxDoQuantity"
                                                            @input="handleQuantityInput(item, orderIndex, 'paste')"
                                                            placeholder="数量"
                                                            style="background-color: transparent;"
                                                    />
                                                </div>
                                                <!-- 规格 -->
                                                <div style="width: 80px; flex-shrink: 0;">
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm text-center"
                                                            v-model="item.nxDoStandard"
                                                            @input="handleStandardChange(item, orderIndex, 'paste')"
                                                            placeholder="规格"
                                                            style="background-color: transparent;"
                                                    />
                                                </div>
                                                <!-- 操作按钮 -->
                                                <div style="width: 100px; flex-shrink: 0;"
                                                     class="d-flex align-items-center justify-content-center gap-1">
                                                    <button class="btn btn-sm"
                                                            style="font-size: 11px; padding: 2px 6px; background-color: #0056b3; border-color: #0056b3; color: #fff;"
                                                            @click="handleDeleteOrderFromExcel(item, orderIndex, 'paste')">
                                                        删除信息
                                                    </button>
                                                </div>
                                            </div>
                                            <!-- 第二行：备注（如果有） -->
                                            <div v-if="item.nxDoAddRemark"
                                                 class="d-flex align-items-center gap-2 mt-1 ps-5">
                                                <span class="text-muted small">{{ orderIndex + 1 }}.</span>
                                                <span class="text-muted small">备注:</span>
                                                <input
                                                        type="text"
                                                        class="form-control form-control-sm"
                                                        v-model="item.nxDoRemark"
                                                        @input="handleRemarkInput(item, orderIndex, 'paste')"
                                                        placeholder="备注"
                                                        maxlength="15"
                                                        style="font-size: 12px; background-color: transparent; width: 200px; flex-shrink: 0;"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </template>
                                <template v-else-if="pasteSaveCount != null && pasteOrderItems.length > 0">
                                    <!-- 表头 -->
                                    <div class="table-header-fixed bg-light border-bottom p-1 d-flex align-items-center fw-bold small"
                                         style="position: sticky; top: 0; z-index: 10;">
                                        <div style="width: 50px; flex-shrink: 0;" class="text-center table-cell">序号
                                        </div>
                                        <div style="flex: 2; min-width: 0;" class="table-cell">商品名称</div>
                                        <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">数量
                                        </div>
                                        <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">规格
                                        </div>
                                        <div style="width: 100px; flex-shrink: 0;" class="text-center table-cell">状态
                                        </div>
                                    </div>



                                    <!-- 订单列表 -->
                                    <div style="padding: 0.5rem;">
                                        <div
                                                v-for="(item, orderIndex) in pasteOrderItems"
                                                :key="orderIndex"
                                                class="order-item-card mb-1 p-1 bg-white rounded border-bottom"
                                                style="position: relative;">

                                            <!-- 之前添加新订单的商品选择面板 -->
                                            <div v-if="addingOrderBeforeIndex === orderIndex"
                                                 class="mb-3 p-3 border rounded"
                                                 style="background-color: #fff3cd; border-color: #ffc107;">
                                                <div class="d-flex justify-content-between align-items-center mb-2">
                                                    <h6 class="mb-0" style="color: #856404;">在之前添加新订单</h6>
                                                    <button class="btn btn-sm btn-link p-0"
                                                            @click="cancelAddOrderBefore"
                                                            style="font-size: 14px; color: #856404;">✕
                                                    </button>
                                                </div>

                                                <!-- 商品搜索 -->
                                                <div class="mb-2 position-relative">
                                                    <label class="form-label small mb-1"
                                                           style="color: #856404;">商品名称</label>
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm"
                                                            v-model="beforeOrderForm.goodsName"
                                                            @input="handleBeforeOrderGoodsNameInput"
                                                            placeholder="搜索商品..."
                                                            style="background-color: #fff;"
                                                    />
                                                    <!-- 搜索结果下拉框 -->
                                                    <div v-if="beforeOrderForm.showSearchResults && beforeOrderForm.searchResults.length > 0"
                                                         class="border rounded mt-1 bg-white shadow-lg"
                                                         style="max-height: 200px; overflow-y: auto; position: absolute; z-index: 1000; width: 100%;">
                                                        <div v-for="(goods, idx) in beforeOrderForm.searchResults"
                                                             :key="goods.nxDistributerGoodsId || idx"
                                                             class="p-2 border-bottom"
                                                             @click="selectBeforeOrderGoods(goods)"
                                                             style="cursor: pointer;"
                                                             :style="{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa' }">
                                                            <div class="d-flex justify-content-between align-items-center">
                                                                <span>{{ goods.nxDgGoodsName }}</span>
                                                                <span class="badge bg-secondary ms-2"
                                                                      v-if="goods.nxDgGoodsStandardname">
                                                                {{ goods.nxDgGoodsStandardname }}
                                                            </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- 已选商品显示 -->
                                                <div v-if="beforeOrderForm.selectedGoods"
                                                     class="mb-2 p-2 bg-light rounded">
                                                    <small class="text-muted">已选商品：</small>
                                                    <strong>{{ beforeOrderForm.selectedGoods.nxDgGoodsName }}</strong>
                                                    <span v-if="beforeOrderForm.selectedGoods.nxDgGoodsStandardname"
                                                          class="ms-2 badge bg-info">
                                                    {{ beforeOrderForm.selectedGoods.nxDgGoodsStandardname }}
                                                </span>
                                                </div>

                                                <!-- 数量、规格、备注 -->
                                                <div class="row g-2 mb-2">
                                                    <div class="col-4">
                                                        <label class="form-label small mb-1"
                                                               style="color: #856404;">数量</label>
                                                        <input
                                                                type="number"
                                                                class="form-control form-control-sm"
                                                                v-model.number="beforeOrderForm.quantity"
                                                                style="background-color: #fff;"
                                                        />
                                                    </div>
                                                    <div class="col-4">
                                                        <label class="form-label small mb-1"
                                                               style="color: #856404;">规格</label>
                                                        <input
                                                                type="text"
                                                                class="form-control form-control-sm"
                                                                v-model="beforeOrderForm.standard"
                                                                style="background-color: #fff;"
                                                        />
                                                    </div>
                                                    <div class="col-4">
                                                        <label class="form-label small mb-1"
                                                               style="color: #856404;">备注</label>
                                                        <input
                                                                type="text"
                                                                class="form-control form-control-sm"
                                                                v-model="beforeOrderForm.remark"
                                                                style="background-color: #fff;"
                                                        />
                                                    </div>
                                                </div>

                                                <!-- 操作按钮 -->
                                                <div class="d-flex gap-2 justify-content-end">
                                                    <button class="btn btn-sm btn-secondary"
                                                            @click="cancelAddOrderBefore">
                                                        取消
                                                    </button>
                                                    <button class="btn btn-sm btn-primary"
                                                            @click="saveBeforeOrder(item, orderIndex, uploadType || 'excel')"
                                                            :disabled="!beforeOrderForm.selectedGoods || !beforeOrderForm.quantity">
                                                        保存订单
                                                    </button>
                                                </div>
                                            </div>


                                            <!-- 第一行：序号、商品名称、数量、规格、状态 -->
                                            <div class="d-flex align-items-center gap-2 mb-1" style="min-height: 32px;">
                                                <!-- 序号 -->
                                                <div style="width: 50px; flex-shrink: 0;" class="text-center fw-bold">
                                                    {{ orderIndex + 1 }}
                                                </div>
                                                <!-- 商品名称（可编辑） -->
                                                <div style="flex: 2; min-width: 0; display: flex; align-items: center; gap: 4px;"
                                                     class="position-relative">
                                                    <input
                                                            type="text"
                                                            v-model="item.nxDoGoodsName"
                                                            @input="handleGoodsNameInput(item, orderIndex, 'paste')"
                                                            @focus="handleGoodsNameFocus(item, orderIndex, 'paste')"
                                                            @blur="handleGoodsNameBlur(item, orderIndex, 'paste')"
                                                            class="form-control form-control-sm"
                                                            :disabled="item.nxDoStatus === 0"
                                                            placeholder="请输入商品名称"
                                                            style="font-size: 14px; background-color: transparent; flex: 1;"
                                                    />
                                                    <!-- 显示已匹配商品列表的图标 -->
                                                    <button
                                                            v-if="item.nxDoStatus !== 0 && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                                            class="btn btn-link btn-sm p-1"
                                                            @click="toggleMatchedGoods(orderIndex)"
                                                            :title="showMatchedGoods[orderIndex] ? '隐藏已匹配商品' : '显示已匹配商品'"
                                                            style="flex-shrink: 0; text-decoration: none; color: #6c757d; background-color: #f0f0f0; border-radius: 4px;"
                                                    >
                                                        <span v-if="showMatchedGoods[orderIndex]">▼</span>
                                                        <span v-else>▶</span>
                                                    </button>
                                                </div>
                                                <!-- 数量 -->
                                                <div style="width: 50px; flex-shrink: 0;">
                                                    <input
                                                            type="number"
                                                            class="form-control form-control-sm text-center"
                                                            v-model.number="item.nxDoQuantity"
                                                            @input="handleQuantityInput(item, orderIndex, 'paste')"
                                                            :disabled="item.nxDoStatus === 0"
                                                            placeholder="数量"
                                                            style="background-color: transparent;"
                                                    />
                                                </div>
                                                <!-- 规格 -->
                                                <div style="width: 50px; flex-shrink: 0;">
                                                    <input
                                                            type="text"
                                                            class="form-control form-control-sm text-center"
                                                            v-model="item.nxDoStandard"
                                                            @input="handleStandardChange(item, orderIndex, 'paste')"
                                                            :disabled="item.nxDoStatus === 0"
                                                            placeholder="规格"
                                                            style="background-color: transparent;"
                                                    />
                                                </div>
                                                <!-- 状态 -->
                                                <div style="width: 100px; flex-shrink: 0;"
                                                     class="d-flex align-items-center justify-content-center gap-1">
                                                    <button v-if="item.nxDoStatus === 0"
                                                            class="btn btn-sm"
                                                            style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                            @click="handleUpdateOrder(item, orderIndex, 'paste')"
                                                            title="修改"
                                                            @mouseenter="$event.target.style.color='#495057'"
                                                            @mouseleave="$event.target.style.color='#6c757d'">
                                                        ✏️
                                                    </button>
                                                    <template v-else-if="item.nxDoStatus === -2">
                                                        <button class="btn btn-sm"
                                                                :disabled="!isValidOrderQuantityAndStandard(item)"
                                                                :style="!isValidOrderQuantityAndStandard(item) ? 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #adb5bd; cursor: not-allowed;' : 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;'"
                                                                @click="handleSaveNewGoods(item, orderIndex, 'paste')"
                                                                :title="!isValidOrderQuantityAndStandard(item) ? '请填写订单数量和规格' : '保存新商品'"
                                                                @mouseenter="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#495057'"
                                                                @mouseleave="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#6c757d'">
                                                            {{ !isValidOrderQuantityAndStandard(item) ? '⚠️' : '💾' }}
                                                        </button>

                                                    </template>
                                                    <button class="btn btn-sm"
                                                            style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                            @click="handleAddNewOrderBefore(item, orderIndex, 'paste')"
                                                            title="之前添加订单"
                                                            @mouseenter="$event.target.style.color='#495057'"
                                                            @mouseleave="$event.target.style.color='#6c757d'">
                                                        ⬆️
                                                    </button>
                                                    <button class="btn btn-sm"
                                                            style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                            @click="handleDeleteOrderFromExcel(item, orderIndex, 'paste')"
                                                            title="删除"
                                                            @mouseenter="$event.target.style.color='#dc3545'"
                                                            @mouseleave="$event.target.style.color='#6c757d'">
                                                        🗑️
                                                    </button>


                                                </div>
                                            </div>
                                            <!-- 第二行：备注（如果有） -->
                                            <div v-if="item.nxDoRemark"
                                                 class="d-flex align-items-center gap-2 mt-1 ps-5">
                                                <span class="text-muted small">备注:</span>
                                                <input
                                                        type="text"
                                                        class="form-control form-control-sm"
                                                        v-model="item.nxDoRemark"
                                                        @input="handleRemarkInput(item, orderIndex, 'paste')"
                                                        :disabled="item.nxDoStatus === 0"
                                                        placeholder="备注"
                                                        maxlength="15"
                                                        style="font-size: 12px; background-color: transparent; width: 200px; flex-shrink: 0;"
                                                />
                                            </div>

                                            <!-- 商品搜索下拉框（相对于订单项定位，覆盖整个订单列表宽度） -->
                                            <div
                                                    v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                                                    class="goods-search-dropdown position-absolute bg-white border rounded shadow-lg p-2"
                                                    style="top: 100%; left: -0.5rem; right: -0.5rem; width: calc(100% + 1rem); z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px;">

                                                <!-- 搜索标题 -->
                                                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                    <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                                    <button class="btn btn-sm btn-link p-0" @click="closeStr"
                                                            style="font-size: 12px;">✕
                                                    </button>
                                                </div>

                                                <!-- 配送商商品列表 -->
                                                <div v-if="strArr.length > 0" class="mb-2">
                                                    <div class="text-muted small fw-bold mb-2">配送商商品 ({{
                                                        strArr.length
                                                        }})
                                                    </div>
                                                    <div
                                                            v-for="(goods, goodsIndex) in strArr"
                                                            :key="goods.nxDistributerGoodsId || goodsIndex"
                                                            class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                            @click.stop="selectSearchResult(goods, orderIndex, currentSourceType || uploadType || 'paste')"
                                                            style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                        <!-- 商品信息 -->
                                                        <div class="flex-grow-1" style="min-width: 0;">
                                    <span class="text-muted fw-bold me-2"
                                          style="color: #666;">{{ goodsIndex + 1 }}.</span>
                                                            <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'"
                                                                  class="badge bg-warning text-dark me-1">
                                        {{ goods.nxDgGoodsBrand }}
                                    </span>
                                                            <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                                            <span class="text-muted small ms-1">
                                        ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null'
                                          ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname
                                          : goods.nxDgGoodsStandardname }})
                                    </span>
                                                        </div>
                                                        <!-- 选择按钮 -->
                                                        <button
                                                                class="btn btn-secondary btn-sm"
                                                                @click.stop="selectSearchResult(goods, orderIndex, currentSourceType || uploadType || 'paste')"
                                                                :class="{ 'btn-warning': !goods.nxDgNxGoodsId }"
                                                                style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff; margin-left: 8px;">
                                                            {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                                        </button>
                                                    </div>
                                                </div>

                                                <!-- 系统商品列表 -->
                                                <div v-if="nxArr.length > 0" class="mb-2">
                                                    <div class="text-muted small fw-bold mb-2">系统商品 ({{ nxArr.length
                                                        }})
                                                    </div>
                                                    <div
                                                            v-for="(goods, goodsIndex) in nxArr"
                                                            :key="goods.nxGoodsId || goodsIndex"
                                                            class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                            style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                        <!-- 商品信息 -->
                                                        <div class="flex-grow-1" style="min-width: 0;">
                                    <span class="text-muted fw-bold me-2"
                                          style="color: #666;">{{ strArr.length + goodsIndex + 1 }}.</span>
                                                            <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'"
                                                                  class="badge bg-warning text-dark me-1">
                                        {{ goods.nxGoodsBrand }}
                                    </span>
                                                            <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                                            <span class="text-muted small ms-1">
                                        ({{ goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'
                                          ? goods.nxGoodsStandardWeight + '/' + goods.nxGoodsStandardname
                                          : goods.nxGoodsStandardname }})
                                    </span>
                                                        </div>
                                                        <!-- 下载按钮 -->
                                                        <button
                                                                class="btn btn-info btn-sm"
                                                                @click.stop="downLoadGoodsNx(goods, orderIndex)"
                                                                style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                                                title="下载商品">
                                                            ⬇️
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- 已匹配的商品列表 -->
                                            <div
                                                    v-if="item.nxDoStatus !== 0 && showMatchedGoods[orderIndex] && (item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item.nxGoodsEntities && item.nxGoodsEntities.length > 0) && !(orderArrIndex === orderIndex && (strArr.length > 0 || nxArr.length > 0))"
                                                    class="matched-goods-list position-absolute bg-white border rounded shadow-lg p-2"
                                                    style="top: 100%; left: -0.5rem; right: -0.5rem; width: calc(100% + 1rem); z-index: 999; max-height: 400px; overflow-y: auto; margin-top: 4px; border-left: 1px solid gray;">

                                                <!-- 标题栏和关闭按钮 -->
                                                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                    <span class="text-muted small fw-bold">已匹配商品列表</span>
                                                    <button
                                                            class="btn btn-sm btn-link p-0"
                                                            @click="toggleMatchedGoods(orderIndex)"
                                                            style="font-size: 12px; color: #6c757d;"
                                                            title="隐藏">
                                                        ✕
                                                    </button>
                                                </div>

                                                <!-- 配送商已匹配商品列表 -->
                                                <div v-if="item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0"
                                                     class="mb-2">
                                                    <div class="text-muted small fw-bold mb-2">配送商商品 ({{
                                                        item.nxDistributerGoodsEntityList.length }})
                                                    </div>
                                                    <div
                                                            v-for="(orderGoods, orderGoodsIndex) in item.nxDistributerGoodsEntityList"
                                                            :key="orderGoods.nxDistributerGoodsId || orderGoodsIndex"
                                                            class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                            style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                        <!-- 商品信息 -->
                                                        <div class="flex-grow-1" style="min-width: 0;">
                                                            <span class="text-muted fw-bold me-2" style="color: #666;">{{ orderGoodsIndex + 1 }}.</span>
                                                            <span v-if="orderGoods.nxDgGoodsBrand && orderGoods.nxDgGoodsBrand !== 'null'"
                                                                  class="badge bg-warning text-dark me-1">
                              {{ orderGoods.nxDgGoodsBrand }}
                            </span>
                                                            <span class="text-dark"
                                                                  style="color: #333; font-weight: 500;">{{ orderGoods.nxDgGoodsName }}</span>
                                                            <span class="text-muted small ms-1" style="color: #666;">
                              ({{ orderGoods.nxDgGoodsStandardWeight && orderGoods.nxDgGoodsStandardWeight !== 'null'
                                ? orderGoods.nxDgGoodsStandardWeight + '/' + orderGoods.nxDgGoodsStandardname
                                : orderGoods.nxDgGoodsStandardname }})
                            </span>
                                                        </div>
                                                        <!-- 选择按钮 -->
                                                        <button
                                                                class="btn btn-secondary btn-sm"
                                                                @click.stop="selectMatchedGoods(item, orderIndex, orderGoodsIndex, 'paste')"
                                                                style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff; margin-left: 8px;">
                                                            选择
                                                        </button>
                                                    </div>
                                                </div>

                                                <!-- 系统已匹配商品列表 -->
                                                <div v-if="item.nxGoodsEntities && item.nxGoodsEntities.length > 0"
                                                     class="mb-2">
                                                    <div class="text-muted small fw-bold mb-2">系统商品 ({{
                                                        item.nxGoodsEntities.length }})
                                                    </div>
                                                    <div
                                                            v-for="(goods, nxIndex) in item.nxGoodsEntities"
                                                            :key="goods.nxGoodsId || nxIndex"
                                                            class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                            style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                        <!-- 商品信息 -->
                                                        <div class="flex-grow-1" style="min-width: 0;">
                                                            <span class="text-muted fw-bold me-2" style="color: #666;">{{ nxIndex + 1 }}.</span>
                                                            <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'"
                                                                  class="badge bg-warning text-dark me-1">
                                {{ goods.nxGoodsBrand }}
                              </span>
                                                            <span class="text-dark"
                                                                  style="color: #333; font-weight: 500;">{{ goods.nxGoodsName }}</span>
                                                            <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0"
                                                                  v-for="(alias, aliasIndex) in goods.nxAliasEntities"
                                                                  :key="alias.nxDaAliasName || aliasIndex"
                                                                  class="text-primary me-1"
                                                                  style="color: #1c7efb; margin-right: 8px;">
                                @{{ alias.nxDaAliasName }}
                              </span>
                                                            <span class="text-muted small ms-1" style="color: #666;">
                                <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                  <template v-if="goods.nxGoodsStandardname !== '斤'">
                                    ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                </template>
                                </template>
                                <template v-else>
                                  ({{ goods.nxGoodsStandardname }})
                                </template>
                              </span>
                                                            <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'"
                                                                  class="text-muted small me-2"
                                                                  style="color: #666; margin-right: 12px;">
                                产地:{{ goods.nxGoodsPlace }}
                              </span>
                                                            <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'"
                                                                  class="text-muted small"
                                                                  style="color: #666;">
                                {{ goods.nxGoodsDetail }}
                              </span>
                                                        </div>
                                                        <!-- 下载按钮 -->
                                                        <button
                                                                class="btn btn-info btn-sm"
                                                                @click.stop="downLoadGoodsNx(goods, orderIndex)"
                                                                style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                                                title="下载商品">
                                                            ⬇️
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <!--                                    /////-->
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- 转订单区域 - 固定边框，左右分栏布局 -->
            <div v-if="uploadType === 'auto'" class="upload-section"
                 style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
                        <!-- 左侧：文件列表和操作 / 图片预览 -->
                    <div class="col-md-6 " style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden;">
                        <div class="card h-100" style="display: flex; flex-direction: column; border: 2px solid #007bff;">
                                <div class="card-body p-1"
                                     style="display: flex; flex-direction: column; min-height: 0;">


                                    <!-- 文件列表和操作 -->
                                <div class="" style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden;">
                                        <!-- 操作按钮 -->
                                        <div v-if="!hasCache" class="mb-3 d-flex gap-2">
                                            <button
                                                    class="btn btn-primary"
                                                    @click="scanFolderFiles"
                                                    :disabled="!customerFolderPath || scanningFiles || processingFiles">
                                                <span v-if="scanningFiles"
                                                      class="spinner-border spinner-border-sm me-1"></span>
                                                {{ scanningFiles ? '扫描中...' : '刷新文件夹' }}
                                            </button>
                                            <button
                                                    class="btn btn-success"
                                                    @click="startAutoProcess"
                                                    :disabled="!customerFolderPath || autoProcessFiles.length === 0 || processingFiles">
                                        <span v-if="processingFiles"
                                              class="spinner-border spinner-border-sm me-1"></span>
                                                {{ processingFiles ? '处理中...' : '开始处理' }}
                                            </button>
                                        </div>

                                        <!-- 处理进度 -->
                                        <div v-if="processingFiles" class="mb-3">
                                            <div class="d-flex justify-content-between align-items-center mb-2">
                                                <span class="fw-bold">总体进度：</span>
                                                <span>{{ autoProcessProgress.current }}/{{ autoProcessProgress.total }}</span>
                                            </div>
                                            <div class="progress" style="height: 20px;">
                                                <div
                                                        class="progress-bar progress-bar-striped progress-bar-animated"
                                                        :style="{ width: autoProcessProgress.percent + '%' }">
                                                    {{ autoProcessProgress.percent }}%
                                                </div>
                                            </div>
                                        </div>

                                        <!-- 文件列表 -->
                                        <div v-if="autoProcessFiles.length > 0" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                                            <h6 class="mb-1 red" v-if="pendingFiles.length > 0"
                                                style="background-color: #fff3cd; font-size: 12px; color: #dc3545; padding: 4px 8px; border-radius: 4px; flex-shrink: 0;">
                                                待转换新文件{{ pendingFiles.length }}个</h6>
                                        <div style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto;">
                                                <!-- 已处理的文件：标签页显示 -->
                                            <div v-if="processedFiles.length > 0" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                                                    <!--                                        <h6 class="mb-2 small text-muted">已处理文件 ({{ processedFiles.length }})</h6>-->

                                                    <!-- 标签页导航（固定，不滚动） -->
                                                    <div style="flex-shrink: 0; overflow-x: auto; overflow-y: hidden; border-bottom: 1px solid #dee2e6;">
                                                        <ul class="nav nav-tabs" role="tablist"
                                                            style="flex-wrap: nowrap; white-space: nowrap; margin-bottom: 0;">
                                                            <li
                                                                    v-for="(file, index) in processedFiles"
                                                                    :key="'tab-' + index"
                                                                    class="nav-item"
                                                                    role="presentation"
                                                                    style="flex-shrink: 0;">
                                                                <button
                                                                        class="nav-link"
                                                                        :class="{ 'active': activeProcessedFileTab === file.filePath }"
                                                                        @click="activeProcessedFileTab = file.filePath"
                                                                        type="button"
                                                                        style="font-size: 12px; padding: 6px 12px; white-space: nowrap;"
                                                                        :title="file.fileName">
                                                                    {{ file.fileType === 'excel' ? '📄' : '🖼️' }} {{
                                                                    file.fileName
                                                                    }}
                                                                </button>
                                                            </li>
                                                        </ul>
                                                    </div>

                                                    <!-- 标签页内容（可滚动） -->
                                                    <div class="tab-content border border-top-0 p-1"
                                                     style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;">
                                                        <div
                                                                v-for="(file, index) in processedFiles"
                                                                :key="'content-' + index"
                                                                class="tab-pane"
                                                                :class="{ 'active': activeProcessedFileTab === file.filePath }"
                                                            v-show="activeProcessedFileTab === file.filePath"
                                                            style="height: 100%; display: flex; flex-direction: column;">

                                                            <!-- 图片文件内容 -->
                                                        <div v-if="file.fileType === 'image'" class="flex-grow-1" style="display: flex; flex-direction: column; min-height: 0;">

                                                            <div class="row flex-grow-1" style="min-height: 0;">
                                                                <!-- 图片预览区域（暂时隐藏，先确保左右布局正常） -->
                                                                 <div v-if="currentPreviewImage" class="flex-grow-1"
                                                                     style="display: flex; flex-direction: column; min-height: 0;">
<!--                                                                    <div class="p-2 bg-light rounded mb-2" style="flex-shrink: 0;">-->
<!--                                                                        <div class="d-flex justify-content-between align-items-center">-->
<!--                                                                            <div>-->
<!--                                                                                <div class="fw-bold">🖼️ {{ currentPreviewImage.fileName }}</div>-->
<!--                                                                            </div>-->
<!--                                                                        </div>-->
<!--                                                                    </div>-->

                                                                    <!-- 图片预览 -->
                                                                    <div v-if="currentPreviewImageSrc"
                                                                         class="border rounded p-0 position-relative flex-grow-1"
                                                                         style="min-height: 0; overflow-y: auto; overflow-x: auto; cursor: move; background-color: #f5f5f5; display: flex; align-items: start; justify-content: start;"
                                                                         @mousedown="startDrag"
                                                                         @wheel.prevent="onWheel">
                                                                        <div class="position-absolute top-0 end-0 m-2 d-flex gap-1"
                                                                             style="z-index: 1000; background-color: rgba(255, 255, 255, 0.9); padding: 4px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                                                            <button class="btn btn-sm btn-outline-secondary"
                                                                                    @click.stop="resetImageTransform"
                                                                                    @mousedown.stop
                                                                                    title="重置"
                                                                                    style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                                                🔄
                                                                            </button>
                                                                            <button class="btn btn-sm btn-outline-secondary"
                                                                                    @click.stop="zoomIn"
                                                                                    @mousedown.stop
                                                                                    title="放大"
                                                                                    style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                                                ➕
                                                                            </button>
                                                                            <button class="btn btn-sm btn-outline-secondary"
                                                                                    @click.stop="zoomOut"
                                                                                    @mousedown.stop
                                                                                    title="缩小"
                                                                                    style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                                                                                ➖
                                                                            </button>
                                                                </div>
                                                                        <div class="d-flex align-items-start justify-content-start"
                                                                             style="width: 100%; height: 100%; transform-origin: top left;">
                                                                            <img :src="currentPreviewImageSrc" alt="预览" class="img-fluid"
                                                                                 :style="{
                                                      transform: `translate(${imageTranslateX}px, ${imageTranslateY}px) scale(${imageScale})`,
                                                      transition: isDragging ? 'none' : 'transform 0.1s',
                                                      cursor: isDragging ? 'grabbing' : 'grab',
                                                           maxWidth: '100%',
                                                           width: 'auto',
                                                      height: 'auto',
                                                           objectFit: 'contain',
                                                           display: 'block'
                                                    }"
                                                                                 @load="handleImageLoad($event, 'auto')"
                                                                                 @dragstart.prevent>
                                                            </div>
                                                                    </div>
                                                                </div>
<!--                                                                <div>🖼️ 图片已在上方预览区域显示</div>-->
<!--                                                                <small>切换标签页可查看不同图片</small>-->
                                                            </div>
                                                        </div>
                                                            <!-- Excel文件内容 -->
                                                        <div v-if="file.fileType === 'excel'" style="padding: 0.25rem; overflow-y: auto;">
                                                                <div>
                                                                    <div v-if="autoProcessExcelPreviews && autoProcessExcelPreviews[file.filePath]">
                                                                        <div v-if="autoProcessExcelPreviews[file.filePath].sheets && autoProcessExcelPreviews[file.filePath].sheets.length > 0">
                                                                            <!-- 工作表选择 -->
                                                                            <div v-if="autoProcessExcelPreviews[file.filePath].sheets.length > 1"
                                                                                 class="mb-2">
                                                                                <select
                                                                                        class="form-select form-select-sm"
                                                                                        :value="autoProcessExcelPreviews[file.filePath].currentSheet || 0"
                                                                                        @change="changeExcelSheet(file.filePath, $event.target.value)">
                                                                                    <option
                                                                                            v-for="(sheet, sheetIndex) in autoProcessExcelPreviews[file.filePath].sheets"
                                                                                            :key="sheetIndex"
                                                                                            :value="sheetIndex">
                                                                                        {{ sheet.name }}
                                                                                    </option>
                                                                                </select>
                                                                            </div>
                                                                            <!-- 表格显示 -->
                                                                            <div class="table-responsive">
                                                                                <table class="table table-sm table-bordered"
                                                                                       style="font-size: 11px;">
                                                                                    <tbody>
                                                                                    <tr v-for="(row, rowIndex) in getCurrentExcelSheetData(file.filePath)"
                                                                                        :key="rowIndex">
                                                                                        <td
                                                                                                v-for="(cell, cellIndex) in row"
                                                                                                :key="cellIndex"
                                                                                                :class="{ 'bg-light': rowIndex === 0 }"
                                                                                                style="padding: 4px; white-space: nowrap;">
                                                                                            {{ cell || '' }}
                                                                                        </td>
                                                                                    </tr>
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </div>
                                                                        <div v-else class="text-muted small">
                                                                            Excel文件为空或无法读取
                                                                        </div>
                                                                    </div>
                                                                    <div v-else class="text-muted small">
                                                                        <div class="spinner-border spinner-border-sm me-2"
                                                                             role="status"></div>
                                                                        加载中...
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <!-- 待处理的文件：列表显示 -->
                                                <div v-if="pendingFiles.length > 0 && processedFiles.length == 0"
                                                     class="mb-1">
                                                    <h6 class="mb-2 small text-muted">待处理文件 ({{ pendingFiles.length
                                                        }})</h6>
                                                    <div class="list-group"
                                                         style="max-height: 300px; overflow-y: auto;">
                                                        <div
                                                                v-for="(file, index) in pendingFiles"
                                                                :key="'pending-' + index"
                                                                class="list-group-item d-flex justify-content-between align-items-center"
                                                                :class="{
                          'list-group-item-warning': file.status === 'processing',
                          'list-group-item-danger': file.status === 'error',
                          'list-group-item-secondary': file.status === 'pending'
                        }">
                                                            <div class="d-flex align-items-center flex-grow-1"
                                                                 style="min-width: 0;">
                          <span class="me-2" style="font-size: 18px;">
                            {{ file.fileType === 'excel' ? '📄' : '🖼️' }}
                          </span>
                                                                <div class="flex-grow-1" style="min-width: 0;">
                                                                    <div class="fw-bold"
                                                                         style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                                                                         :title="file.fileName">
                                                                        {{ file.fileName }}
                                                                    </div>
                                                                    <div class="small text-muted">
                                                                        <span v-if="file.status === 'pending'">待处理</span>
                                                                        <span v-else-if="file.status === 'processing'">处理中... ({{ file.progress }}%)</span>
                                                                        <span v-else-if="file.status === 'success'">处理成功 ({{ file.orderCount || 0 }}条订单)</span>
                                                                        <span v-else-if="file.status === 'error'">处理失败: {{ file.error }}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div class="d-flex gap-2 align-items-center"
                                                                 style="flex-shrink: 0;">
                                                                <!-- 处理进度条 -->
                                                                <div v-if="file.status === 'processing'"
                                                                     class="progress"
                                                                     style="width: 100px; height: 20px;">
                                                                    <div
                                                                            class="progress-bar progress-bar-striped progress-bar-animated"
                                                                            :style="{ width: file.progress + '%' }">
                                                                        {{ file.progress }}%
                                                                    </div>
                                                                </div>
                                                                <!-- 打开文件按钮 -->
                                                                <button
                                                                        v-if="file.status !== 'processing'"
                                                                        class="btn btn-sm btn-outline-primary"
                                                                        @click="openFile(file.filePath)"
                                                                        title="打开文件">
                                                                    📂
                                                                </button>
                                                                <!-- 预览图片按钮（仅图片文件） -->
                                                                <!-- <button
                            v-if="file.fileType === 'image' && file.status !== 'processing'"
                            class="btn btn-sm btn-outline-info"
                            @click="previewAutoProcessImage(file)"
                            title="预览图片">
                            👁️
                              </button> -->
                                                        </div>
                                                    </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <!-- 右侧：订单列表 - 始终保留空间 -->
                    <div class="col-md-6 order-items-section" style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                                    <div class="card h-100 p-2"
                             style="display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; border: 2px solid #28a745;">
                                        <div class="d-flex justify-content-between align-items-center mb-3"
                                             style="flex-shrink: 0;">
                                            <h6 class="mb-0">转换订单 ({{ filteredOrderItems.length }} 项)</h6>
                                            <div class="d-flex gap-2">
                                                <button
                                                        v-if="hasCache"
                                                        class="btn btn-success btn-sm"
                                                        @click="clearExcelOrImageSave">
                                                    完成下单
                                                </button>
                                                <button
                                            v-if="hasCache"
                                            class="btn btn-warning btn-sm"
                                            @click="reUpload">
                                        重新上传
                                    </button>
                                            </div>
                                        </div>

                                        <!-- 订单列表 -->
                                        <div class="order-list-container flex-grow-1"
                                 ref="autoOrderListContainer"
                                 style="flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 0; background-color: #fff;">
                                            <div v-if="filteredOrderItems.length === 0"
                                                 class="text-center text-muted p-4" style="flex-shrink: 0;">
                                                <div class="mb-2">📋 暂无订单</div>
                                                <small>请处理文件夹中的文件后，系统将自动解析订单</small>
                                            </div>
                                            <template v-else>
                                            <!-- 表头 -->
                                                <div class="table-header-fixed bg-light border-bottom p-1 d-flex align-items-center fw-bold small"
                                                     ref="autoOrderListHeader"
                                                     style="flex-shrink: 0; position: sticky; top: 0; z-index: 10;">
                                                <div style="width: 50px; flex-shrink: 0;"
                                                     class="text-center table-cell">序号
                                                </div>
                                                <div style="flex: 2; min-width: 0;" class="table-cell">商品名称</div>
                                                <div style="width: 50px; flex-shrink: 0;"
                                                     class="text-center table-cell">数量
                                                </div>
                                                <div style="width: 50px; flex-shrink: 0;"
                                                     class="text-center table-cell">规格
                                                </div>
                                                <div style="width: 100px; flex-shrink: 0;"
                                                     class="text-center table-cell">状态
                                                </div>
                                            </div>
                                            <!-- 订单列表 -->
                                                <div ref="autoOrderListContent"
                                                     style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 0.5rem;">
                                                <div
                                                        v-for="(item, orderIndex) in filteredOrderItems"
                                                        :key="orderIndex"
                                                        class="order-item-card mb-1 p-1 bg-white rounded border-bottom"
                                                        style="position: relative;">

                                                    <!-- 之前添加新订单的商品选择面板 -->
                                                    <div v-if="addingOrderBeforeIndex === orderIndex"
                                                         class="mb-3 p-3 border rounded"
                                                         style="background-color: #fff3cd; border-color: #ffc107;">
                                                        <div class="d-flex justify-content-between align-items-center mb-2">
                                                            <h6 class="mb-0" style="color: #856404;">在之前添加新订单</h6>
                                                            <button class="btn btn-sm btn-link p-0"
                                                                    @click="cancelAddOrderBefore"
                                                                    style="font-size: 14px; color: #856404;">✕
                                                            </button>
                                                        </div>

                                                        <!-- 商品搜索 -->
                                                        <div class="mb-2 position-relative">
                                                            <label class="form-label small mb-1"
                                                                   style="color: #856404;">商品名称</label>
                                                            <input
                                                                    type="text"
                                                                    class="form-control form-control-sm"
                                                                    v-model="beforeOrderForm.goodsName"
                                                                    @input="handleBeforeOrderGoodsNameInput"
                                                                    placeholder="搜索商品..."
                                                                    style="background-color: #fff;"
                                                            />
                                                            <!-- 搜索结果下拉框 -->
                                                            <div v-if="beforeOrderForm.showSearchResults && beforeOrderForm.searchResults.length > 0"
                                                                 class="border rounded mt-1 bg-white shadow-lg"
                                                                 style="max-height: 200px; overflow-y: auto; position: absolute; z-index: 1000; width: 100%;">
                                                                <div v-for="(goods, idx) in beforeOrderForm.searchResults"
                                                                     :key="goods.nxDistributerGoodsId || idx"
                                                                     class="p-2 border-bottom"
                                                                     @click="selectBeforeOrderGoods(goods)"
                                                                     style="cursor: pointer;"
                                                                     :style="{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f9fa' }">
                                                                    <div class="d-flex justify-content-between align-items-center">
                                                                        <span>{{ goods.nxDgGoodsName }}</span>
                                                                        <span class="badge bg-secondary ms-2"
                                                                              v-if="goods.nxDgGoodsStandardname">
                                                                {{ goods.nxDgGoodsStandardname }}
                                                            </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <!-- 已选商品显示 -->
                                                        <div v-if="beforeOrderForm.selectedGoods"
                                                             class="mb-2 p-2 bg-light rounded">
                                                            <small class="text-muted">已选商品：</small>
                                                            <strong>{{ beforeOrderForm.selectedGoods.nxDgGoodsName
                                                                }}</strong>
                                                            <span v-if="beforeOrderForm.selectedGoods.nxDgGoodsStandardname"
                                                                  class="ms-2 badge bg-info">
                                                    {{ beforeOrderForm.selectedGoods.nxDgGoodsStandardname }}
                                                </span>
                                                        </div>

                                                        <!-- 数量、规格、备注 -->
                                                        <div class="row g-2 mb-2">
                                                            <div class="col-4">
                                                                <label class="form-label small mb-1"
                                                                       style="color: #856404;">数量</label>
                                                                <input
                                                                        type="number"
                                                                        class="form-control form-control-sm"
                                                                        v-model.number="beforeOrderForm.quantity"
                                                                        
                                                                        style="background-color: #fff;"
                                                                />
                                                            </div>
                                                            <div class="col-4">
                                                                <label class="form-label small mb-1"
                                                                       style="color: #856404;">规格</label>
                                                                <input
                                                                        type="text"
                                                                        class="form-control form-control-sm"
                                                                        v-model="beforeOrderForm.standard"
                                                                        style="background-color: #fff;"
                                                                />
                                                            </div>
                                                            <div class="col-4">
                                                                <label class="form-label small mb-1"
                                                                       style="color: #856404;">备注</label>
                                                                <input
                                                                        type="text"
                                                                        class="form-control form-control-sm"
                                                                        v-model="beforeOrderForm.remark"
                                                                        style="background-color: #fff;"
                                                                />
                                                            </div>
                                                        </div>

                                                        <!-- 操作按钮 -->
                                                        <div class="d-flex gap-2 justify-content-end">
                                                            <button class="btn btn-sm btn-secondary"
                                                                    @click="cancelAddOrderBefore">
                                                                取消
                                                            </button>
                                                            <button class="btn btn-sm btn-primary"
                                                                    @click="saveBeforeOrder(item, orderIndex, uploadType || 'excel')"
                                                                    :disabled="!beforeOrderForm.selectedGoods || !beforeOrderForm.quantity">
                                                                保存订单
                                                            </button>
                                                        </div>
                                                    </div>


                                                    <!-- 第一行：序号、商品名称、数量、规格、状态 -->
                                                    <div class="d-flex align-items-center gap-2 mb-1"
                                                         style="min-height: 32px;">
                                                        <!-- 序号 -->
                                                        <div style="width: 50px; flex-shrink: 0;"
                                                             class="text-center fw-bold">
                                                            {{ orderIndex + 1 }}
                                                        </div>
                                                        <!-- 商品名称（可编辑） -->
                                                        <div style="flex: 2; min-width: 0; display: flex; align-items: center; gap: 4px;"
                                                             class="position-relative">
                                                            <input
                                                                    type="text"
                                                                    v-model="item.nxDoGoodsName"
                                                                    @input="handleGoodsNameInput(item, orderIndex, 'auto')"
                                                                    @focus="handleGoodsNameFocus(item, orderIndex, 'auto')"
                                                                    @blur="handleGoodsNameBlur(item, orderIndex, 'auto')"
                                                                    class="form-control form-control-sm"
                                                                    :disabled="item.nxDoStatus === 0"
                                                                    placeholder="请输入商品名称"
                                                                    style="font-size: 14px; background-color: transparent; flex: 1;"
                                                            />
                                                            <!-- 显示已匹配商品列表的图标 -->
                                                            <button
                                                                    v-if="item.nxDoStatus !== 0 && (item?.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item?.nxGoodsEntities && item.nxGoodsEntities.length > 0)"
                                                                    class="btn btn-link btn-sm p-1"
                                                                    @click.stop="toggleMatchedGoods(orderIndex)"
                                                                    :title="showMatchedGoods[orderIndex] ? '隐藏已匹配商品' : '显示已匹配商品'"
                                                                    style="flex-shrink: 0; text-decoration: none; color: #6c757d; background-color: #f0f0f0; border-radius: 4px;"
                                                            >
                                                                <span v-if="showMatchedGoods[orderIndex]">▼</span>
                                                                <span v-else>▶</span>
                                                            </button>
                                                        </div>
                                                        <!-- 数量 -->
                                                        <div style="width: 50px; flex-shrink: 0;">
                                                            <input
                                                                    type="number"
                                                                    v-model.number="item.nxDoQuantity"
                                                                    @input="handleQuantityInput(item, orderIndex, 'auto')"
                                                                    class="form-control form-control-sm text-center"
                                                                    :disabled="item.nxDoStatus === 0"
                                                                    placeholder="数量"
                                                                    style="background-color: transparent;"
                                                            />
                                                        </div>
                                                        <!-- 规格 -->
                                                        <div style="width: 50px; flex-shrink: 0;">
                                                            <input
                                                                    type="text"
                                                                    v-model="item.nxDoStandard"
                                                                    @input="handleStandardChange(item, orderIndex, 'auto')"
                                                                    class="form-control form-control-sm text-center"
                                                                    :disabled="item.nxDoStatus === 0"
                                                                    placeholder="规格"
                                                                    style="background-color: transparent;"
                                                            />
                                                        </div>
                                                        <!-- 状态 -->
                                                        <div style="width: 100px; flex-shrink: 0;"
                                                             class="d-flex align-items-center justify-content-center gap-1">
                                                            <button v-if="item.nxDoStatus === 0"
                                                                    class="btn btn-sm"
                                                                    style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                                    @click="handleUpdateOrder(item, orderIndex, 'auto')"
                                                                    title="修改"
                                                                    @mouseenter="$event.target.style.color='#495057'"
                                                                    @mouseleave="$event.target.style.color='#6c757d'">
                                                                ✏️
                                                            </button>
                                                            <template v-else-if="item.nxDoStatus === -2">
                                                                <button class="btn btn-sm"
                                                                        :disabled="!isValidOrderQuantityAndStandard(item)"
                                                                        :style="!isValidOrderQuantityAndStandard(item) ? 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #adb5bd; cursor: not-allowed;' : 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;'"
                                                                        @click="handleSaveNewGoods(item, orderIndex, 'auto')"
                                                                        :title="!isValidOrderQuantityAndStandard(item) ? '请填写订单数量和规格' : '保存新商品'"
                                                                        @mouseenter="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#495057'"
                                                                        @mouseleave="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#6c757d'">
                                                                    {{ !isValidOrderQuantityAndStandard(item) ? '⚠️' : '💾' }}
                                                                </button>
                                                            </template>
                                                            <button class="btn btn-sm"
                                                                    style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                                    @click="handleAddNewOrderBefore(item, orderIndex, 'auto')"
                                                                    title="之前添加订单"
                                                                    @mouseenter="$event.target.style.color='#495057'"
                                                                    @mouseleave="$event.target.style.color='#6c757d'">
                                                                ⬆️
                                                            </button>
                                                            <button class="btn btn-sm"
                                                                    style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                                                    @click="handleDeleteOrderFromExcel(item, orderIndex, 'auto')"
                                                                    title="删除"
                                                                    @mouseenter="$event.target.style.color='#dc3545'"
                                                                    @mouseleave="$event.target.style.color='#6c757d'">
                                                                🗑️
                                                            </button>

                                                        </div>
                                                    </div>

                                                    <!-- 商品搜索下拉框（相对于订单项定位，覆盖整个订单列表宽度） -->
                                                    <div
                                                            v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                                                            class="goods-search-dropdown position-absolute bg-white border rounded shadow-lg p-2"
                                                            style="top: 100%; left: -0.5rem; right: -0.5rem; width: calc(100% + 1rem); z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px;">

                                                        <!-- 搜索标题 -->
                                                        <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                            <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                                            <button class="btn btn-sm btn-link p-0" @click="closeStr"
                                                                    style="font-size: 12px;">✕
                                                            </button>
                                                        </div>

                                                        <!-- 配送商商品列表 -->
                                                        <div v-if="strArr.length > 0" class="mb-2">
                                                            <div class="text-muted small fw-bold mb-2">配送商商品 ({{
                                                                strArr.length
                                                                }})
                                                            </div>
                                                            <div
                                                                    v-for="(goods, goodsIndex) in strArr"
                                                                    :key="goods.nxDistributerGoodsId || goodsIndex"
                                                                    class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                                    @click.stop="selectSearchResult(goods, orderIndex, currentSourceType || uploadType || 'auto')"
                                                                    style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                                <!-- 商品信息 -->
                                                                <div class="flex-grow-1" style="min-width: 0;">
                                                        <span class="text-muted fw-bold me-2"
                                                              style="color: #666;">{{ goodsIndex + 1 }}.</span>
                                                                    <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'"
                                                                          class="badge bg-warning text-dark me-1">
                                  {{ goods.nxDgGoodsBrand }}
                                </span>
                                                                    <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                                                    <span class="text-muted small ms-1">
                                  ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null'
                                    ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname
                                    : goods.nxDgGoodsStandardname }})
                                </span>
                                                                </div>
                                                                <!-- 选择按钮 -->
                                                                <button
                                                                        class="btn btn-secondary btn-sm"
                                                                        @click.stop="selectSearchResult(goods, orderIndex, currentSourceType || uploadType || 'auto')"
                                                                        :class="{ 'btn-warning': !goods.nxDgNxGoodsId }"
                                                                        style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff; margin-left: 8px;">
                                                                    {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <!-- 系统商品列表 -->
                                                        <div v-if="nxArr.length > 0" class="mb-2">
                                                            <div class="text-muted small fw-bold mb-2">系统商品 ({{
                                                                nxArr.length
                                                                }})
                                                            </div>
                                                            <div
                                                                    v-for="(goods, nxIndex) in nxArr"
                                                                    :key="goods.nxGoodsId || nxIndex"
                                                                    class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                                    style="cursor: pointer;">
                                                                <!-- 商品信息 -->
                                                                <div class="flex-grow-1" style="min-width: 0;">
                                                        <span class="text-muted fw-bold me-2"
                                                              style="color: #666;">{{ strArr.length + nxIndex + 1 }}.</span>
                                                                    <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'"
                                                                          class="badge bg-warning text-dark me-1">
                                {{ goods.nxGoodsBrand }}
                              </span>
                                                                    <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                                                    <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0"
                                                                          v-for="(alias, aliasIndex) in goods.nxAliasEntities"
                                                                          :key="alias.nxDaAliasName || aliasIndex"
                                                                          class="text-primary me-1">
                                @{{ alias.nxDaAliasName }}
                              </span>
                                                                    <span class="text-muted small ms-1">
                                <template v-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                  <template v-if="goods.nxGoodsStandardname !== '斤'">
                                    ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                  </template>
                                </template>
                                <template v-else>
                                  ({{ goods.nxGoodsStandardname }})
                                </template>
                              </span>
                                                                    <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'"
                                                                          class="text-muted small me-2">
                                产地:{{ goods.nxGoodsPlace }}
                              </span>
                                                                    <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'"
                                                                          class="text-muted small">
                                {{ goods.nxGoodsDetail }}
                              </span>
                                                                </div>
                                                                <!-- 下载按钮 -->
                                                                <button
                                                                        class="btn btn-info btn-sm"
                                                                        @click.stop="downLoadGoodsNx(goods, orderIndex)"
                                                                        style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                                                        title="下载商品">
                                                                    ⬇️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <!-- 第二行：备注（如果有） -->
                                                    <div v-if="item?.nxDoAddRemark || item?.nxDoRemark"
                                                         class="d-flex align-items-center gap-2 mt-1 ps-5">
                                                        <span class="text-muted small">备注:</span>
                                                        <input
                                                                type="text"
                                                                :value="item.nxDoRemark"
                                                                @input="handleRemarkInput(item, orderIndex, 'auto')"
                                                                class="form-control form-control-sm"
                                                                :disabled="item.nxDoStatus === 0"
                                                                placeholder="备注"
                                                                maxlength="15"
                                                                style="font-size: 12px; background-color: transparent; width: 200px; flex-shrink: 0;"
                                                        />
                                                    </div>

                                                    <!-- 已匹配的商品列表（相对于整个订单项定位） -->
                                                    <div
                                                            v-if="item && item.nxDoStatus !== 0 && showMatchedGoods[orderIndex] && (item?.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 || item?.nxGoodsEntities && item.nxGoodsEntities.length > 0) && !(orderArrIndex === orderIndex && (strArr.length > 0 || nxArr.length > 0))"
                                                            class="matched-goods-list position-absolute bg-white border rounded shadow-lg p-2"
                                                            style="top: 100%; left: -0.5rem; right: -0.5rem; width: calc(100% + 1rem); z-index: 999; max-height: 400px; overflow-y: auto; margin-top: 4px; border-left: 1px solid gray;">

                                                        <!-- 标题栏和关闭按钮 -->
                                                        <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                                            <span class="text-muted small fw-bold">已匹配商品列表</span>
                                                            <button
                                                                    class="btn btn-sm btn-link p-0"
                                                                    @click="toggleMatchedGoods(orderIndex)"
                                                                    style="font-size: 12px; color: #6c757d;"
                                                                    title="隐藏">
                                                                ✕
                                                            </button>
                                                        </div>

                                                        <!-- 配送商已匹配商品列表 -->
                                                        <div v-if="item?.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0"
                                                             class="mb-2">
                                                            <div class="text-muted small fw-bold mb-2">配送商商品 ({{
                                                                item?.nxDistributerGoodsEntityList?.length || 0 }})
                                                            </div>
                                                            <div
                                                                    v-for="(orderGoods, orderGoodsIndex) in item?.nxDistributerGoodsEntityList || []"
                                                                    :key="orderGoods.nxDistributerGoodsId || orderGoodsIndex"
                                                                    class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                                    style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                                <!-- 商品信息 -->
                                                                <div class="flex-grow-1" style="min-width: 0;">
                                                                    <span class="text-muted fw-bold me-2"
                                                                          style="color: #666;">{{ orderGoodsIndex + 1 }}.</span>
                                                                    <span v-if="orderGoods.nxDgGoodsBrand && orderGoods.nxDgGoodsBrand !== 'null'"
                                                                          class="badge bg-warning text-dark me-1">
                                {{ orderGoods.nxDgGoodsBrand }}
                              </span>
                                                                    <span class="text-dark"
                                                                          @click.stop="choiceGoodsForApply(orderGoods, orderIndex, 'auto')">{{ orderGoods.nxDgGoodsName }}</span>
                                                                    <span class="text-muted small ms-1">
                                ({{ orderGoods.nxDgGoodsStandardWeight && orderGoods.nxDgGoodsStandardWeight !== 'null'
                                  ? orderGoods.nxDgGoodsStandardWeight + '/' + orderGoods.nxDgGoodsStandardname
                                  : orderGoods.nxDgGoodsStandardname }})
                              </span>
                                                                </div>
                                                                <!-- 选择按钮 -->
                                                                <button
                                                                        class="btn btn-sm"
                                                                        style="flex-shrink: 0; width: 53px; height: 20px; font-size: 11px; padding: 2px 6px; background-color: #6c757d; border-color: #6c757d; color: #fff; margin-left: 8px;"
                                                                        @click.stop="choiceGoodsForApply(orderGoods, orderIndex, 'auto')">
                                                                    选择
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <!-- 系统商品已匹配商品列表 -->
                                                        <div v-if="item?.nxGoodsEntities && item.nxGoodsEntities.length > 0"
                                                             class="mb-2">
                                                            <div class="text-muted small fw-bold mb-2">系统商品 ({{
                                                                item?.nxGoodsEntities?.length || 0 }})
                                                            </div>
                                                            <div
                                                                    v-for="(nxGoods, nxGoodsIndex) in item?.nxGoodsEntities || []"
                                                                    :key="nxGoods.nxGoodsId || nxGoodsIndex"
                                                                    class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                                                    style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                                                <!-- 商品信息 -->
                                                                <div class="flex-grow-1" style="min-width: 0;">
                                                                    <span class="text-muted fw-bold me-2"
                                                                          style="color: #666;">{{ nxGoodsIndex + 1 }}.</span>
                                                                    <span v-if="nxGoods.nxGoodsBrand && nxGoods.nxGoodsBrand !== 'null'"
                                                                          class="badge bg-warning text-dark me-1">
                          {{ nxGoods.nxGoodsBrand }}
                                </span>
                                                                    <span class="text-dark">{{ nxGoods.nxGoodsName }}</span>
                                                                    <span class="text-muted small ms-1">
                          ({{ nxGoods.nxGoodsStandardWeight && nxGoods.nxGoodsStandardWeight !== 'null'
                            ? nxGoods.nxGoodsStandardWeight + '/' + nxGoods.nxGoodsStandardname
                            : nxGoods.nxGoodsStandardname }})
                                </span>
                                                                </div>
                                                                <!-- 下载按钮 -->
                                                                <button
                                                                        class="btn btn-sm btn-info"
                                                                        style="flex-shrink: 0; width: 53px; height: 20px; font-size: 11px; padding: 2px 6px; margin-left: 8px;"
                                                                        @click.stop="downLoadGoodsNx(nxGoods, orderIndex)">
                                                                    ⬇️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            </template>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
<!--        </div>-->
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
                    <div class="input-group mb-3 d-flex align-items-center justify-content-between">
                        <label class="form-label mb-0 me-3">订货数量:</label>
                        <input
                                type="number"
                                class="form-control form-control-sm"
                                v-model="editOrderForm.quantity"
                                style="width: 200px;"
                                placeholder="请输入数量"
                        />
                    </div>

                    <!-- 单位 -->
                    <div class="input-group mb-3 d-flex align-items-start justify-content-between">
                        <label class="form-label mb-0 me-3" style="flex-shrink: 0;">单位:</label>
                        <div style="flex: 1;">
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
                                <button class="btn btn-sm btn-outline-secondary">取消
                                </button>
                                <button class="btn btn-sm btn-primary" @click="confirmAddStandard">保存</button>
                            </div>
                        </div>
                    </div>

                    <!-- 备注 -->
                    <div class="input-group mb-3 d-flex align-items-center justify-content-between">
                        <label class="form-label mb-0 me-3">备注:</label>
                        <input
                                type="text"
                                class="form-control form-control-sm"
                                v-model="editOrderForm.remark"
                                style="width: 300px;"
                                placeholder="请输入备注（最多15个字符）"
                                maxlength="15"
                        />
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
                    <div style="width: 48px; flex-shrink: 0;"></div>
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

    <!-- 图片预览/裁剪弹窗 -->
    <div v-if="showImagePreviewModal" class="order-edit-overlay" @click.self="closeImagePreviewModal">
        <div class="order-edit-popup" style="max-width: 90%; max-height: 90vh; width: 800px;">
            <!-- 弹窗头部 -->
            <div class="popup-header text-center p-3 bg-light border-bottom">
                <h5 class="mb-0">图片预览与裁剪</h5>
            </div>
            
            <!-- 弹窗内容 -->
            <div class="popup-body p-3" style="max-height: calc(90vh - 200px); overflow-y: auto;">
                <!-- 图片预览区域 -->
                <div class="border rounded position-relative"
                     style="min-height: 400px; max-height: 600px; overflow: hidden; background-color: #f5f5f5; cursor: move; display: flex; align-items: center; justify-content: center;"
                     @mousedown="!showCropMode ? startDrag($event) : startCropDrag($event)"
                     @mousemove="!showCropMode ? onDrag($event) : onCropDrag($event)"
                     @mouseup="!showCropMode ? endDrag() : endCropDrag()"
                     @mouseleave="!showCropMode ? endDrag() : endCropDrag()"
                     @wheel.prevent="onWheel">
                    <!-- 工具栏 -->
                    <div class="position-absolute top-0 end-0 m-2 d-flex gap-1"
                         style="z-index: 1000; background-color: rgba(255, 255, 255, 0.9); padding: 4px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        <button class="btn btn-sm btn-outline-secondary"
                                @click.stop="toggleCropMode"
                                @mousedown.stop
                                :title="showCropMode ? '退出裁剪' : '裁剪图片'"
                                :style="showCropMode ? 'background-color: #0d6efd; border-color: #0d6efd; color: #fff;' : 'background-color: #fff; border-color: #6c757d; color: #6c757d;'">
                            ✂️
                        </button>
                        <button class="btn btn-sm btn-outline-secondary"
                                @click.stop="resetImageTransform"
                                @mousedown.stop
                                title="重置"
                                style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                            🔄
                        </button>
                        <button class="btn btn-sm btn-outline-secondary"
                                @click.stop="zoomIn"
                                @mousedown.stop
                                title="放大"
                                style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                            ➕
                        </button>
                        <button class="btn btn-sm btn-outline-secondary"
                                @click.stop="zoomOut"
                                @mousedown.stop
                                title="缩小"
                                style="background-color: #fff; border-color: #6c757d; color: #6c757d;">
                            ➖
                        </button>
                    </div>
                    
                    <!-- 图片容器 -->
                    <div class="d-flex align-items-center justify-content-center"
                         style="width: 100%; height: 100%; min-height: 400px; transform-origin: center center; position: relative; overflow: hidden;">
                        <img v-if="previewImageDataUrl" 
                             :src="previewImageDataUrl" 
                             alt="预览" 
                             ref="previewImageModal"
                             :style="{
                                 transform: `translate(${imageTranslateX}px, ${imageTranslateY}px) scale(${imageScale})`,
                                 transition: isDragging ? 'none' : 'transform 0.1s',
                                 cursor: isDragging ? 'grabbing' : (showCropMode ? 'default' : 'grab'),
                                 maxWidth: '100%',
                                 maxHeight: '100%',
                                 width: 'auto',
                                 height: 'auto',
                                 objectFit: 'contain',
                                 display: 'block'
                             }"
                             @load="handleImageLoad($event, 'modal')"
                             @dragstart.prevent>
                        
                        <!-- 裁剪框 -->
                        <div v-if="showCropMode && previewImageDataUrl"
                             class="crop-box"
                             :style="{
                                 position: 'absolute',
                                 left: cropBox.x + 'px',
                                 top: cropBox.y + 'px',
                                 width: cropBox.width + 'px',
                                 height: cropBox.height + 'px',
                                 border: '2px dashed #0d6efd',
                                 backgroundColor: 'rgba(13, 110, 253, 0.1)',
                                 cursor: isDraggingCrop ? 'grabbing' : 'move',
                                 zIndex: 1000,
                                 boxSizing: 'border-box'
                             }"
                             @mousedown.stop="startCropDrag($event)">
                            <!-- 裁剪框四个角的调整手柄 -->
                            <div class="crop-handle crop-handle-nw"
                                 @mousedown.stop="startCropResize($event, 'nw')"
                                 style="position: absolute; left: -5px; top: -5px; width: 10px; height: 10px; background: #0d6efd; border: 2px solid #fff; cursor: nwse-resize; border-radius: 50%;"></div>
                            <div class="crop-handle crop-handle-ne"
                                 @mousedown.stop="startCropResize($event, 'ne')"
                                 style="position: absolute; right: -5px; top: -5px; width: 10px; height: 10px; background: #0d6efd; border: 2px solid #fff; cursor: nesw-resize; border-radius: 50%;"></div>
                            <div class="crop-handle crop-handle-sw"
                                 @mousedown.stop="startCropResize($event, 'sw')"
                                 style="position: absolute; left: -5px; bottom: -5px; width: 10px; height: 10px; background: #0d6efd; border: 2px solid #fff; cursor: nesw-resize; border-radius: 50%;"></div>
                            <div class="crop-handle crop-handle-se"
                                 @mousedown.stop="startCropResize($event, 'se')"
                                 style="position: absolute; right: -5px; bottom: -5px; width: 10px; height: 10px; background: #0d6efd; border: 2px solid #fff; cursor: nwse-resize; border-radius: 50%;"></div>
                        </div>
                        
                        <!-- 裁剪遮罩层 -->
                        <div v-if="showCropMode && previewImageDataUrl" 
                             class="crop-overlay"
                             style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 999;">
                            <svg style="width: 100%; height: 100%;">
                                <defs>
                                    <mask id="crop-mask-modal">
                                        <rect width="100%" height="100%" fill="white"/>
                                        <rect :x="cropBox.x" :y="cropBox.y" :width="cropBox.width" :height="cropBox.height" fill="black"/>
                                    </mask>
                                </defs>
                                <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#crop-mask-modal)"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 弹窗底部按钮 -->
            <div class="popup-footer d-flex p-3 border-top bg-light justify-content-center gap-2">
                <button class="btn btn-sm btn-secondary"
                        @click="closeImagePreviewModal"
                        style="flex: 0 0 auto; width: 100px;">
                    取消
                </button>
                <button v-if="!showCropMode"
                        class="btn btn-sm btn-primary"
                        @click="recognizeFromModal"
                        :disabled="recognizingImage"
                        style="flex: 0 0 auto; width: 120px;">
                    {{ recognizingImage ? '识别中...' : '直接识别' }}
                </button>
                <button v-if="showCropMode"
                        class="btn btn-sm btn-success"
                        @click="applyCropAndRecognize"
                        :disabled="recognizingImage"
                        style="flex: 0 0 auto; width: 140px;">
                    {{ recognizingImage ? '处理中...' : '确认裁剪并识别' }}
                </button>
            </div>
        </div>
    </div>

</template>

<script>
    import api from "../api/all";
    import {useStore} from 'vuex';

    export default {
        name: 'PlaceOrder',
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
                uploadType: 'excel', // 'excel'、'image'、'paste' 或 'auto'（默认 excel，以便自动加载 excel 缓存）

                // 订单相关
                orderItems: [], // 订单项列表（Excel 和图片上传共用）
                pasteOrderItems: [], // 复制粘贴的订单项列表（独立）
                savingOrder: false, // 是否正在保存订单
                recognizingImage: false, // 是否正在识别图片
                hasCache: false, // 是否有当前部门的缓存数据（Excel 和图片）
                pasteHasCache: false, // 复制粘贴是否有缓存数据

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
                
                // 图片裁剪相关
                showImagePreviewModal: false, // 是否显示图片预览/裁剪弹窗
                showCropMode: false, // 是否显示裁剪模式（在弹窗内）
                cropBox: {
                    x: 0, // 裁剪框左上角X坐标
                    y: 0, // 裁剪框左上角Y坐标
                    width: 200, // 裁剪框宽度
                    height: 200 // 裁剪框高度
                },
                isDraggingCrop: false, // 是否正在拖拽裁剪框
                cropDragStart: { x: 0, y: 0 }, // 裁剪框拖拽起始位置
                isResizingCrop: false, // 是否正在调整裁剪框大小
                cropResizeHandle: '', // 调整大小的手柄位置（'nw', 'ne', 'sw', 'se'）
                originalImageFile: null, // 原始图片文件（用于裁剪）
                previewImageDataUrl: null, // 弹窗中预览的图片DataURL

                // 复制粘贴相关
                pasteInputText: '', // 粘贴的文本内容
                pasteSaveCount: null, // 复制粘贴已保存订单数量（null=草稿状态，数字=已保存状态）
                pasteOriginText: '', // 原始粘贴文本（用于重新粘贴）
                pasteInputContent: '', // 输入框内容（与 pasteInputText 同步）
                showDeepSeekLoading: false, // DeepSeek API 加载状态

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
                ocrOrderDepList: null, // OCR订单缓存列表（按部门）
                ocrOrderDepIndex: -1, // 当前部门的缓存索引

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
                beforeOrderForm: { // 之前添加新订单的表单数据
                    goodsName: '',
                    quantity: '',
                    standard: '',
                    remark: '',
                    selectedGoods: null, // 选中的商品对象
                    searchResults: [], // 搜索结果
                    showSearchResults: false // 是否显示搜索结果
                }
            }
        },
        computed: {
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
                    return validItems;
                }

                // 找到当前选中的文件
                const activeFile = this.processedFiles.find(f => f.filePath === this.activeProcessedFileTab);
                if (!activeFile) {
                    return validItems;
                }

                // 只显示来自当前选中文件的订单
                return validItems.filter(order => {
                    return order.sourceFile === activeFile.fileName;
                });
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
            // 监听客户切换，自动加载缓存
            selectedAllCustomer: {
                handler(newVal, oldVal) {
                    if (newVal && newVal !== oldVal) {
                        // 先清空所有旧客户的数据
                        this.orderItems = [];
                        this.pasteOrderItems = [];
                        this.hasCache = false;
                        this.pasteHasCache = false;
                        this.uploadedExcelFile = null;
                        this.uploadedExcelPreview = null;
                        this.uploadedImageFile = null;
                        this.imagePreview = null;
                        this.ocrOrderDepIndex = -1;

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

                        // 然后加载新客户的缓存
                        this._loadCache();
                        // 如果是转订单模式，加载文件夹路径（会重新扫描新客户的文件夹）
                        if (this.uploadType === 'auto') {
                            this.loadCustomerFolderPath();
                        }
                    }
                },
                immediate: false
            },
            // 监听子部门切换，重新加载缓存
            selectedSubDepartment: {
                handler(newVal, oldVal) {
                    if (newVal !== oldVal && this.selectedAllCustomer) {
                        // 清空订单数据
                        this.orderItems = [];
                        this.hasCache = false;
                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();
                        // 重新加载缓存
                        this._loadCache();
                        // 如果是转订单模式，重新加载文件夹路径
                        if (this.uploadType === 'auto') {
                            this.loadCustomerFolderPath();
                        }
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

                        // 重新加载缓存（同步执行，会再次清空转订单数据如果没有缓存）
                        this._loadCache();

                        // 如果是转订单模式，加载文件夹路径（在加载缓存之后，此时 customerFolderPath 已经是 null）
                        if (newVal === 'auto') {
                            // 使用 nextTick 确保 _loadCache 的清空操作已完成
                            this.$nextTick(() => {
                                this.loadCustomerFolderPath();
                            });
                        }
                        }
                    
                    // 如果是转订单模式，调试容器高度
                    if (newVal === 'auto') {
                        this.$nextTick(() => {
                            this.debugAutoOrderListHeight();
                        });
                    }
                },
                immediate: false
            },
            // 监听订单列表变化，调试容器高度
            filteredOrderItems: {
                handler() {
                    if (this.uploadType === 'auto') {
                        this.$nextTick(() => {
                            this.debugAutoOrderListHeight();
                        });
                    }
                },
                immediate: false
            }
        },
        mounted() {
            // 组件挂载时，如果已选择客户，加载缓存
            if (this.selectedAllCustomer) {
                this._loadCache();
            }

            // 如果是转订单模式且已选择客户，加载文件夹路径
            if (this.uploadType === 'auto' && this.selectedAllCustomer) {
                this.loadCustomerFolderPath();
            }

            // 监听缓存更新事件，重新加载缓存
            window.addEventListener('cache-updated', this.handleCacheUpdated);

            // 调试：检查转订单模式的订单列表容器高度
            this.$nextTick(() => {
                this.debugAutoOrderListHeight();
            });
        },
        // 如果使用了 keep-alive，组件激活时也会调用
        activated() {
            // 组件激活时，如果已选择客户，重新加载缓存（确保数据是最新的）
            if (this.selectedAllCustomer) {
                this._loadCache();
            }
        },
        beforeUnmount() {
            // 移除事件监听
            window.removeEventListener('cache-updated', this.handleCacheUpdated);
        },
        methods: {
            // 调试：检查转订单模式的订单列表容器高度
            debugAutoOrderListHeight() {
                // 调试方法已移除日志
            },
            // 处理缓存更新事件
            handleCacheUpdated(event) {
                const {sourceType, depId} = event.detail || {};

                // 如果更新的是当前客户和当前上传类型的缓存，重新加载缓存
                if (depId && String(depId) === String(this.selectedAllCustomer)) {
                    const currentSourceType = this.uploadType || 'paste';
                    if (!sourceType || sourceType === currentSourceType) {
                        this._loadCache();
                    }
                }
            },
            // 处理上传方式切换
            handleUploadTypeChange(type) {
                this.uploadType = type;

                // 切换模式时，重新加载对应模式的缓存
                if (this.selectedAllCustomer) {
                    this._loadCache();
                }

                // 发出事件通知父组件
                this.$emit('upload-type-change', type);
            },

            // 检查是否选择了子部门（如果有子部门的话）
            checkSubDepartmentSelected() {
                if (!this.selectedCustomerEntity) {
                    return true; // 如果没有选中客户，不检查子部门
                }

                const hasSubDepartments = this.selectedCustomerEntity.nxDepartmentEntities &&
                    Array.isArray(this.selectedCustomerEntity.nxDepartmentEntities) &&
                    this.selectedCustomerEntity.nxDepartmentEntities.length > 0;

                if (hasSubDepartments) {
                    if (!this.selectedSubDepartment) {
                        alert('请先选择子部门');
                        return false;
                    }
                    return true;
                }

                return true;
            },

            // 加载缓存数据（参考微信小程序 _loadCache）
            _loadCache() {

                try {
                    // 确定当前模式对应的 orderSourceType
                    const currentSourceType = this.uploadType || 'paste';

                    // 根据来源类型使用不同的 localStorage key
                    const storageKey = `ocrOrderDepList_${currentSourceType}`;

                    // 先尝试从新的存储方式读取（按来源类型分离）
                    let ocrOrderDepList = null;
                    try {
                        const ocrOrderDepListStr = localStorage.getItem(storageKey);
                        if (ocrOrderDepListStr) {
                            ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
                        }
                    } catch (error) {
                        console.error('读取新格式缓存失败:', error);
                    }

                    // 如果新格式没有数据，尝试兼容旧格式（ocrOrderDepList）
                    if (!ocrOrderDepList || !Array.isArray(ocrOrderDepList) || ocrOrderDepList.length === 0) {
                        const oldOcrOrderDepListStr = localStorage.getItem('ocrOrderDepList');
                        if (oldOcrOrderDepListStr) {
                            const oldOcrOrderDepList = JSON.parse(oldOcrOrderDepListStr);
                            if (Array.isArray(oldOcrOrderDepList)) {
                                // 从旧格式中过滤出匹配当前来源类型的缓存
                                ocrOrderDepList = oldOcrOrderDepList.filter(item => {
                                    const cacheSourceType = item.orderSourceType || 'paste';
                                    return cacheSourceType === currentSourceType;
                                });
                            }
                        }
                    }

                    if (ocrOrderDepList && Array.isArray(ocrOrderDepList) && ocrOrderDepList.length > 0) {
                        this.ocrOrderDepList = ocrOrderDepList;

                        for (let i = 0; i < ocrOrderDepList.length; i++) {
                            const pDepId = ocrOrderDepList[i].depId;

                            // 匹配 depId（使用宽松相等比较，处理字符串和数字类型不匹配的情况）
                            const pDepIdStr = String(pDepId);
                            const selectedDepIdStr = String(this.selectedAllCustomer);

                            if (pDepIdStr === selectedDepIdStr || pDepId == this.selectedAllCustomer) {
                                // 从缓存恢复订单数据
                                let orders = ocrOrderDepList[i].arr || [];

                                // 确保每个订单都有原始商品名称字段（兼容旧数据）
                                orders = orders.map((order) => {
                                    if (order && !order.nxDoGoodsNameOriginal) {
                                        return {
                                            ...order,
                                            nxDoGoodsNameOriginal: order.nxDoGoodsName || ''
                                        };
                                    }
                                    return order;
                                });

                                // 去重：如果已保存的订单（有 nxDepartmentOrdersId）和草稿订单（没有 nxDepartmentOrdersId）有相同的 ID，移除草稿订单
                                // 或者，如果已保存的订单和草稿订单的商品名称、数量、规格完全相同，移除草稿订单
                                const savedOrders = new Map(); // 用于存储已保存订单的 ID
                                const savedOrdersByContent = new Map(); // 用于存储已保存订单的内容（商品名称+数量+规格）

                                // 第一遍：收集所有已保存订单的 ID 和内容
                                orders.forEach((order, idx) => {
                                    if (order.nxDepartmentOrdersId) {
                                        savedOrders.set(order.nxDepartmentOrdersId, idx);
                                        const contentKey = `${order.nxDoGoodsName || ''}_${order.nxDoQuantity || ''}_${order.nxDoStandard || ''}`;
                                        if (!savedOrdersByContent.has(contentKey)) {
                                            savedOrdersByContent.set(contentKey, idx);
                                        }
                                    }
                                });

                                // 第二遍：移除重复的草稿订单
                                const filteredOrders = [];
                                orders.forEach((order, idx) => {
                                    if (order.nxDepartmentOrdersId) {
                                        // 已保存的订单，直接添加
                                        filteredOrders.push(order);
                                    } else {
                                        // 草稿订单，检查是否与已保存订单重复
                                        const contentKey = `${order.nxDoGoodsName || ''}_${order.nxDoQuantity || ''}_${order.nxDoStandard || ''}`;
                                        if (!savedOrdersByContent.has(contentKey)) {
                                            // 没有重复，保留草稿订单
                                            filteredOrders.push(order);
                                        }
                                    }
                                });

                                orders = filteredOrders;

                                // 恢复搜索相关数据
                                const searchData = ocrOrderDepList[i];
                                const hasCacheData = orders && orders.length > 0;

                                this.ocrOrderDepIndex = i;

                                // 根据来源类型更新对应的订单列表和缓存状态
                                if (currentSourceType === 'paste') {
                                    this.pasteOrderItems = orders;
                                    this.pasteHasCache = hasCacheData;
                                    // 恢复粘贴文本（如果有的话）
                                    if (searchData.pasteInputText) {
                                        this.pasteInputText = searchData.pasteInputText;
                                        this.pasteInputContent = searchData.pasteInputText;
                                    }
                                    // 恢复保存计数（如果有的话）
                                    if (searchData.saveCount !== undefined) {
                                        this.pasteSaveCount = searchData.saveCount;
                                    }
                                } else {
                                    this.orderItems = orders;
                                    this.hasCache = hasCacheData;
                                }

                                this.strArr = searchData.strArr || [];
                                this.nxArr = searchData.nxArr || [];
                                this.orderArrIndex = searchData.orderArrIndex !== undefined ? searchData.orderArrIndex : -1;
                                this.searchStr = searchData.searchStr || "";

                                // 恢复上传的文件信息
                                if (searchData.uploadedFile) {
                                    if (currentSourceType === 'excel') {
                                        this.uploadedExcelFile = {
                                            name: searchData.uploadedFile.name,
                                            size: searchData.uploadedFile.size,
                                            type: searchData.uploadedFile.type,
                                            lastModified: searchData.uploadedFile.lastModified
                                        };
                                        // 恢复Excel预览数据
                                        if (searchData.uploadedFile.preview) {
                                            this.uploadedExcelPreview = JSON.parse(JSON.stringify(searchData.uploadedFile.preview));
                                        }
                                        // 强制更新视图，确保显示
                                        this.$nextTick(() => {
                                            if (this.uploadedExcelFile) {
                                                this.$forceUpdate();
                                            }
                                        });
                                    } else if (currentSourceType === 'image') {
                                        this.uploadedImageFile = searchData.uploadedFile;
                                        // 如果有图片预览数据，恢复预览
                                        if (searchData.uploadedFile.dataUrl) {
                                            this.imagePreview = searchData.uploadedFile.dataUrl;
                                        }
                                        // 强制更新视图，确保显示
                                        this.$nextTick(() => {
                                            this.$forceUpdate();
                                        });
                                    }
                                }

                                return; // 找到匹配的缓存，退出循环
                            }
                        }

                        // 如果没有找到匹配的缓存（depId 不匹配）
                        if (currentSourceType === 'paste') {
                            this.pasteHasCache = false;
                            this.pasteOrderItems = [];
                        } else {
                            this.hasCache = false;
                            this.orderItems = [];
                        }
                        // 清空上传的文件信息（因为当前客户没有缓存）
                        this.uploadedExcelFile = null;
                        this.uploadedExcelPreview = null;
                        this.uploadedImageFile = null;
                        this.imagePreview = null;
                        this.ocrOrderDepIndex = -1;

                        // 如果是转订单模式，清空转订单相关的数据
                        if (currentSourceType === 'auto') {
                            this.autoProcessFiles = [];
                            this.autoProcessImagePreviews = {};
                            this.autoProcessExcelPreviews = {};
                            this.activeProcessedFileTab = null;
                            this.autoProcessImagePreview = null;
                            this.autoProcessImagePreviewFileName = '';
                            this.autoProcessResults = [];
                        }
                    } else {
                        this.ocrOrderDepList = [];
                        this.ocrOrderDepIndex = -1;
                        if (currentSourceType === 'paste') {
                            this.pasteHasCache = false;
                            this.pasteOrderItems = [];
                        } else {
                            this.hasCache = false;
                            this.orderItems = [];
                        }
                        // 清空上传的文件信息
                        this.uploadedExcelFile = null;
                        this.uploadedExcelPreview = null;
                        this.uploadedImageFile = null;
                        this.imagePreview = null;

                        // 如果是转订单模式，清空转订单相关的数据
                        if (currentSourceType === 'auto') {
                            this.autoProcessFiles = [];
                            this.autoProcessImagePreviews = {};
                            this.autoProcessExcelPreviews = {};
                            this.activeProcessedFileTab = null;
                            this.autoProcessImagePreview = null;
                            this.autoProcessImagePreviewFileName = '';
                            this.autoProcessResults = [];
                        }
                    }
                } catch (error) {
                    const currentSourceType = this.uploadType || 'paste';
                    if (currentSourceType === 'paste') {
                        this.pasteHasCache = false;
                        this.pasteOrderItems = [];
                    } else {
                        this.hasCache = false;
                        this.orderItems = [];
                    }
                    this.uploadedExcelFile = null;
                    this.uploadedExcelPreview = null;
                    this.uploadedImageFile = null;
                    this.imagePreview = null;

                    // 如果是转订单模式，清空转订单相关的数据
                    if (currentSourceType === 'auto') {
                        this.autoProcessFiles = [];
                        this.autoProcessImagePreviews = {};
                        this.autoProcessExcelPreviews = {};
                        this.activeProcessedFileTab = null;
                        this.autoProcessImagePreview = null;
                        this.autoProcessImagePreviewFileName = '';
                        this.autoProcessResults = [];
                    }
                }
            },

            // 保存到缓存（参考微信小程序 _saveToStorage）
            _saveToStorage(orders, orderSourceType) {
                const orderArr = orders || this.orderItems;

                // 如果没有订单数据，跳过
                if (!orderArr || orderArr.length === 0) {
                    return;
                }

                // 如果没有指定订单来源类型，使用当前的 uploadType
                const sourceType = orderSourceType || this.uploadType || 'paste';

                // 根据来源类型使用不同的 localStorage key
                const storageKey = `ocrOrderDepList_${sourceType}`;

                // 从 localStorage 读取对应来源类型的缓存
                let ocrOrderDepList = [];
                try {
                    const ocrOrderDepListStr = localStorage.getItem(storageKey);
                    if (ocrOrderDepListStr) {
                        ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
                        if (!Array.isArray(ocrOrderDepList)) {
                            ocrOrderDepList = [];
                        }
                    }
                } catch (error) {
                    console.error('读取缓存失败:', error);
                    ocrOrderDepList = [];
                }

                // 查找是否已经存在当前部门的缓存
                let existingIndex = -1;
                for (let i = 0; i < ocrOrderDepList.length; i++) {
                    if (ocrOrderDepList[i].depId === this.selectedAllCustomer) {
                        existingIndex = i;
                        break;
                    }
                }

                if (existingIndex >= 0) {
                    // 更新现有缓存
                    ocrOrderDepList[existingIndex].depId = this.selectedAllCustomer;
                    ocrOrderDepList[existingIndex].depFatherId = this.selectedAllCustomer;
                    ocrOrderDepList[existingIndex].depName = this.selectedCustomerName;
                    ocrOrderDepList[existingIndex].arr = orderArr;
                    ocrOrderDepList[existingIndex].strArr = this.strArr || [];
                    ocrOrderDepList[existingIndex].nxArr = this.nxArr || [];
                    ocrOrderDepList[existingIndex].orderArrIndex = this.orderArrIndex !== undefined ? this.orderArrIndex : -1;
                    ocrOrderDepList[existingIndex].searchStr = this.searchStr || "";
                    ocrOrderDepList[existingIndex].orderSourceType = sourceType;
                    // 如果是复制粘贴，保存输入文本和保存计数
                    if (sourceType === 'paste') {
                        ocrOrderDepList[existingIndex].pasteInputText = this.pasteInputText || '';
                        ocrOrderDepList[existingIndex].saveCount = this.pasteSaveCount;
                    }
                    // 更新上传的文件信息（包括预览数据）
                    if (sourceType === 'excel' && this.uploadedExcelFile) {
                        ocrOrderDepList[existingIndex].uploadedFile = {
                            ...this.uploadedExcelFile,
                            preview: this.uploadedExcelPreview
                        };
                    } else if (sourceType === 'image' && this.uploadedImageFile) {
                        ocrOrderDepList[existingIndex].uploadedFile = this.uploadedImageFile;
                    } else {
                        // 保留原有的文件信息
                        ocrOrderDepList[existingIndex].uploadedFile = ocrOrderDepList[existingIndex].uploadedFile;
                    }
                    this.ocrOrderDepIndex = existingIndex;
                } else {
                    // 创建新的缓存项
                    const newDepData = {
                        depId: this.selectedAllCustomer,
                        depFatherId: this.selectedAllCustomer,
                        depName: this.selectedCustomerName,
                        arr: orderArr,
                        saveCount: null,
                        strArr: this.strArr || [],
                        nxArr: this.nxArr || [],
                        orderArrIndex: this.orderArrIndex !== undefined ? this.orderArrIndex : -1,
                        searchStr: this.searchStr || "",
                        orderSourceType: sourceType,
                        // 如果是复制粘贴，保存输入文本和保存计数
                        pasteInputText: sourceType === 'paste' ? (this.pasteInputText || '') : undefined,
                        saveCount: sourceType === 'paste' ? this.pasteSaveCount : null,
                        // 保存上传的文件信息（包括预览数据）
                        uploadedFile: sourceType === 'excel' && this.uploadedExcelFile ? {
                                ...this.uploadedExcelFile,
                                preview: this.uploadedExcelPreview
                        } : sourceType === 'image' ? this.uploadedImageFile : null
                    };
                    ocrOrderDepList.push(newDepData);
                    this.ocrOrderDepIndex = ocrOrderDepList.length - 1;
                }

                // 更新内存中的数据（用于当前来源类型）
                this.ocrOrderDepList = ocrOrderDepList;

                try {
                    // 立即同步到 localStorage（使用对应来源类型的 key）
                    localStorage.setItem(storageKey, JSON.stringify(ocrOrderDepList));

                    // 更新 hasCache 状态（根据来源类型更新对应的缓存状态）
                    if (orderArr.length > 0) {
                        if (sourceType === 'paste') {
                            this.pasteHasCache = true;
                        } else {
                            this.hasCache = true;
                        }
                    }
                } catch (error) {
                    console.error('缓存同步失败:', error);
                }
            },

            // ========== Excel上传相关方法 ==========

            // 处理Excel文件上传（使用新的 recognizeOrderFromExcel 接口）
            async handleExcelUpload(event) {
                const file = event.target.files[0];
                if (!file) return;

                // 保存上传的文件信息（用于缓存和显示）
                this.uploadedExcelFile = {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                };

                // 读取并解析Excel文件，用于预览
                await this.loadUploadedExcelPreview(file);

                // 验证文件类型
                const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'];
                if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls)$/i)) {
                    alert('请选择有效的Excel文件（.xlsx 或 .xls）');
                    return;
                }

                // 验证文件大小（最大10MB）
                if (file.size > 10 * 1024 * 1024) {
                    alert('文件大小超过限制，最大支持 10MB');
                    return;
                }

                if (!this.selectedAllCustomer) {
                    alert('请先选择客户');
                    return;
                }

                // 检查是否选择了子部门（如果有子部门的话）
                if (!this.checkSubDepartmentSelected()) {
                    // 清空文件输入
                    if (this.$refs.excelFileInput) {
                        this.$refs.excelFileInput.value = '';
                    }
                    return;
                }

                // 确定要使用的部门ID（如果有子部门选择，使用子部门ID，否则使用父部门ID）
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                try {
                    this.$store.commit('SET_LOADING', true);

                    const formData = new FormData();
                    formData.append('file', file);
                    // 使用确定的部门ID（可能是子部门ID）
                    formData.append('depId', targetDepId);
                    formData.append('depFatherId', this.selectedAllCustomer); // 父部门ID始终是选中的客户ID
                    formData.append('disId', this.disUser.nxDiuDistributerId);
                    formData.append('userId', this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1);

                    // 调用新的Excel解析接口
                    const res = await api.recognizeOrderFromExcel(formData);

                    if (res && res.data) {
                        // 根据文档，如果提供了 depId 和 disId，返回的是 data 数组（已保存的订单）
                        if (res.data.code === 200 || res.data.code === 0) {
                            // 检查是否返回了已保存的订单（data 数组）
                            if (Array.isArray(res.data.data) && res.data.data.length > 0) {
                                // 转换为订单格式
                                this.orderItems = res.data.data.map(item => ({
                                    nxDoGoodsName: item.goodsName || item.nxDoGoodsName || '',
                                    nxDoGoodsNameOriginal: item.goodsName || item.nxDoGoodsName || '',
                                    nxDoQuantity: item.quantity || item.nxDoQuantity || '',
                                    nxDoStandard: item.standard || item.nxDoStandard || '斤',
                                    nxDoRemark: item.remark || item.nxDoRemark || '',
                                    nxDoAddRemark: !!(item.remark || item.nxDoRemark),
                                    nxDoStatus: item.status !== undefined ? item.status : (item.nxDoStatus !== undefined ? item.nxDoStatus : -2),
                                    nxDoDepartmentId: targetDepId, // 使用确定的部门ID（可能是子部门ID）
                                    nxDoDepartmentFatherId: this.selectedAllCustomer,
                                    nxDoDisGoodsId: item.disGoodsId || item.nxDoDisGoodsId || null,
                                    nxDoStandardWarn: 0,
                                    goodsNameWarn: 0,
                                    nxDoDistributerId: this.disUser.nxDiuDistributerId,
                                    nxDoPurchaseUserId: -1,
                                    nxDoOrderUserId: this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1,
                                    nxDoIsAgent: -1,
                                    nxDepartmentOrdersId: item.orderId || item.nxDepartmentOrdersId || null,
                                    // 保留匹配的商品信息
                                    nxDistributerGoodsEntityList: item.matchedGoods || item.nxDistributerGoodsEntityList || [],
                                    nxGoodsEntities: item.matchedGoods || item.nxGoodsEntities || []
                                }));

                                alert('Excel解析并保存成功！');
                                // 确保预览数据已加载完成后再保存到缓存
                                if (!this.uploadedExcelPreview) {
                                    let waitCount = 0;
                                    while (!this.uploadedExcelPreview && waitCount < 20) {
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                        waitCount++;
                                    }
                                }
                                // 保存到缓存（会保留 uploadedExcelFile 和 uploadedExcelPreview）
                                this._saveToStorage(this.orderItems, 'excel');
                                // 重置搜索和匹配商品列表状态
                                this.resetSearchAndMatchedGoodsState();
                                // 发出事件通知父组件刷新客户列表
                                this.$emit('order-saved');
                            }
                            // 如果返回的是 items 数组（仅解析，未保存）
                            else if (Array.isArray(res.data.items) && res.data.items.length > 0) {
                                // 转换为订单格式
                                this.orderItems = res.data.items.map(item => ({
                                    nxDoGoodsName: item.name || '',
                                    nxDoGoodsNameOriginal: item.name || '',
                                    nxDoQuantity: item.qty || '',
                                    nxDoStandard: item.unit || '斤',
                                    nxDoRemark: item.remark || '',
                                    nxDoAddRemark: !!(item.remark && item.remark.trim()),
                                    nxDoStatus: -2, // 未保存的草稿
                                    nxDoDepartmentId: targetDepId, // 使用确定的部门ID（可能是子部门ID）
                                    nxDoDepartmentFatherId: this.selectedAllCustomer,
                                    nxDoDisGoodsId: null,
                                    nxDoStandardWarn: 0,
                                    goodsNameWarn: 0,
                                    nxDoDistributerId: this.disUser.nxDiuDistributerId,
                                    nxDoPurchaseUserId: -1,
                                    nxDoOrderUserId: this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1,
                                    nxDoIsAgent: -1
                                }));

                                alert('Excel解析成功！');
                                // 确保预览数据已加载完成后再保存到缓存
                                if (!this.uploadedExcelPreview) {
                                    let waitCount = 0;
                                    while (!this.uploadedExcelPreview && waitCount < 20) {
                                        await new Promise(resolve => setTimeout(resolve, 100));
                                        waitCount++;
                                    }
                                }
                                // 保存到缓存
                                this._saveToStorage(this.orderItems, 'excel');
                                // 重置搜索和匹配商品列表状态
                                this.resetSearchAndMatchedGoodsState();
                            } else {
                                alert('Excel文件中没有可读取的数据');
                            }
                        } else {
                            const errorMsg = res.data.msg || 'Excel解析失败';
                            alert(errorMsg);
                        }
                    }
                } catch (error) {
                    console.error('Excel上传失败:', error);
                    const errorMsg = error.response?.data?.msg || error.message || 'Excel上传失败，请重试';
                    alert(errorMsg);
                } finally {
                    this.$store.commit('SET_LOADING', false);
                    // 清空文件输入
                    if (this.$refs.excelFileInput) {
                        this.$refs.excelFileInput.value = '';
                    }
                }
            },

            // 加载上传的Excel文件预览
            async loadUploadedExcelPreview(file) {
                if (!file) {
                    return;
                }

                // 动态导入 xlsx 库
                let XLSX;
                try {
                    XLSX = await import('xlsx');
                } catch (error) {
                    console.error('无法加载 xlsx 库:', error);
                    this.uploadedExcelPreview = {
                        sheets: [],
                        currentSheet: 0,
                        error: '无法加载 xlsx 库'
                    };
                    return;
                }

                try {
                    // 使用 Promise 包装 FileReader
                    const fileData = await new Promise((resolve, reject) => {
                        const reader = new FileReader();

                        reader.onload = (e) => {
                            try {
                                const data = new Uint8Array(e.target.result);
                                resolve(data);
                            } catch (error) {
                                reject(error);
                            }
                        };

                        reader.onerror = (error) => {
                            reject(new Error('读取文件失败'));
                        };

                        // 以 ArrayBuffer 方式读取
                        reader.readAsArrayBuffer(file);
                    });

                    // 使用 xlsx 读取 Excel
                    const workbook = XLSX.read(fileData, {type: 'array'});

                    // 提取所有工作表的数据
                    const sheets = workbook.SheetNames.map((sheetName, index) => {
                        const worksheet = workbook.Sheets[sheetName];
                        // 转换为 JSON 数组（保留原始格式）
                        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

                        return {
                            name: sheetName,
                            index: index,
                            data: jsonData
                        };
                    });

                    // 保存预览数据
                    this.uploadedExcelPreview = {
                        sheets: sheets,
                        currentSheet: 0
                    };


                    // 同时保存到缓存的文件信息中
                    if (this.uploadedExcelFile) {
                        this.uploadedExcelFile.preview = this.uploadedExcelPreview;
                    }

                    // 强制触发 Vue 响应式更新
                    this.$forceUpdate();
                } catch (error) {
                    console.error('加载Excel预览失败:', error);
                    this.uploadedExcelPreview = {
                        sheets: [],
                        currentSheet: 0,
                        error: error.message || '加载失败'
                    };
                }
            },

            // 获取上传的Excel当前工作表数据
            getUploadedExcelSheetData() {
                if (!this.uploadedExcelPreview || !this.uploadedExcelPreview.sheets) {
                    return [];
                }

                const currentSheetIndex = this.uploadedExcelPreview.currentSheet || 0;

                if (this.uploadedExcelPreview.sheets[currentSheetIndex]) {
                    return this.uploadedExcelPreview.sheets[currentSheetIndex].data || [];
                }

                return [];
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
            },

            // 关闭搜索下拉框（关闭商品搜索下拉框）
            closeStr() {
                this.resetSearchAndMatchedGoodsState();
            },

            // 切换匹配商品列表显示
            toggleMatchedGoods(orderIndex) {
                // Vue 3 中直接赋值即可，不需要 $set
                this.showMatchedGoods = {
                    ...this.showMatchedGoods,
                    [orderIndex]: !this.showMatchedGoods[orderIndex]
                };
            },

            // 获取当前操作的订单列表（根据 sourceType）
            getCurrentOrderItems(sourceType) {
                return sourceType === 'paste' ? this.pasteOrderItems : this.orderItems;
            },

            // 处理商品名称输入（触发搜索）
            handleGoodsNameInput(item, orderIndex, sourceType) {
                // 使用 v-model 时，item.nxDoGoodsName 已经被 Vue 自动更新
                // 使用 :value 时，需要从事件对象获取值
                const value = item.nxDoGoodsName || '';

                // 如果新值和上一次搜索的值相同，不重复请求接口
                if (value === this.lastSearchValue) {
                    this.orderArrIndex = orderIndex;
                    this.currentSourceType = sourceType;
                    // 保存到缓存（只有 Excel 和图片需要）
                    if (sourceType !== 'paste') {
                        this._saveToStorage();
                    }
                    return;
                }

                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型

                if (value.length > 0) {
                    // 调用搜索
                    this.lastSearchValue = value; // 保存当前搜索值
                    this.getSearchString(value, sourceType);
                } else {
                    this.strArr = [];
                    this.nxArr = [];
                    this.orderArrIndex = -1;
                    this.lastSearchValue = ''; // 清空搜索值
                }

                // 保存到缓存（只有 Excel 和图片需要）
                if (sourceType !== 'paste') {
                    this._saveToStorage();
                }
            },

            // 处理商品名称获得焦点
            handleGoodsNameFocus(item, orderIndex, sourceType) {
                // 设置当前编辑的订单索引
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型

                // 切换输入框时，重置上一次搜索值，避免不同输入框之间的干扰
                const currentValue = item.nxDoGoodsName || '';
                if (this.lastSearchValue !== currentValue) {
                    this.lastSearchValue = ''; // 重置，允许新输入框的首次搜索
                }

                // 不在获得焦点时触发查询，只在输入时触发
            },

            // 处理商品名称失去焦点
            handleGoodsNameBlur(item, orderIndex, sourceType) {
                // 延迟重置，以便点击按钮时不会立即隐藏
                setTimeout(() => {
                    // 如果当前焦点不在这个输入框上，重置 orderArrIndex
                    if (this.orderArrIndex === orderIndex) {
                        this.orderArrIndex = -1;
                    }
                }, 200);
            },

            // 处理数量输入
            handleQuantityInput(item, orderIndex, sourceType) {
                // 保存到缓存（只有 Excel 和图片需要）
                if (sourceType !== 'paste') {
                    this._saveToStorage();
                }
            },

            // 处理规格改变
            handleStandardChange(item, orderIndex, sourceType) {
                // 保存到缓存（只有 Excel 和图片需要）
                if (sourceType !== 'paste') {
                    this._saveToStorage();
                }
            },

            // 处理备注输入
            handleRemarkInput(item, orderIndex, sourceType) {
                // 更新备注相关字段
                item.nxDoAddRemark = !!(item.nxDoRemark && item.nxDoRemark.trim());

                // 保存到缓存（只有 Excel 和图片需要）
                if (sourceType !== 'paste') {
                    this._saveToStorage();
                }
            },

            // 打开修改订单弹窗（参考 TodayOrders.vue 的 loadGoodsInfoAndOpenModal）
            async handleUpdateOrder(item, orderIndex, sourceType) {

                if (!item || !item.nxDepartmentOrdersId) {
                    alert('订单信息错误，无法修改');
                    return;
                }

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
                    alert('订单信息错误');
                    return;
                }

                if (!this.editOrderForm.quantity || parseFloat(this.editOrderForm.quantity) <= 0) {
                    alert('请输入有效的订货数量');
                    return;
                }

                if (!this.editOrderForm.standard) {
                    alert('请选择单位');
                    return;
                }

                if (this.editOrderForm.remark && this.editOrderForm.remark.length > 15) {
                    alert('备注最多15个字符');
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
                            if (this.currentEditOrderIndex >= 0 && this.currentEditOrderIndex < this.pasteOrderItems.length) {
                                this.pasteOrderItems[this.currentEditOrderIndex] = updatedOrder;
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

                        // 更新缓存
                        if (this.currentEditOrderSourceType !== 'paste') {
                            this._updateStorage(updatedOrder, this.currentEditOrderIndex);
                        }

                        alert('修改成功');
                        this.closeEditOrderModal();
                    } else {
                        alert(res?.data?.msg || '修改失败');
                    }
                } catch (error) {
                    console.error('修改订单失败:', error);
                    alert('修改失败，请检查网络');
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

            // 确认添加规格（参考 TodayOrders.vue 的 confirmAddStandard）
            async confirmAddStandard() {
                if (!this.itemDis || !this.itemDis.nxDistributerGoodsId) {
                    alert('商品信息错误');
                    return;
                }

                if (!this.newStandardName || !this.newStandardName.trim()) {
                    alert('请输入规格名称');
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

                        alert('添加规格成功');
                    } else {
                        alert(res?.data?.msg || '添加规格失败');
                    }
                } catch (error) {
                    console.error('添加规格失败:', error);
                    alert('添加规格失败，请检查网络');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 从编辑弹窗中删除订单（参考 TodayOrders.vue 的 handleDeleteOrderFromEditModal）
            handleDeleteOrderFromEditModal() {
                if (!this.currentEditOrderItem) {
                    return;
                }

                const goodsName = this.currentEditOrderItem.nxDistributerGoodsEntity?.nxDgGoodsName || this.currentEditOrderItem.nxDoGoodsName || '该订单';
                if (!confirm(`确定要删除订单 "${goodsName}" 吗？`)) {
                    return;
                }

                this.handleDeleteOrder();
            },

            // 删除订单（参考 TodayOrders.vue 的 handleDeleteOrder）
            async handleDeleteOrder() {
                if (!this.currentEditOrderItem) {
                    return;
                }

                if (!this.currentEditOrderItem.nxDepartmentOrdersId) {
                    alert('订单信息错误，无法删除');
                    this.closeEditOrderModal();
                    return;
                }

                const orderId = this.currentEditOrderItem.nxDepartmentOrdersId;
                const orderIndex = this.currentEditOrderIndex;
                const sourceType = this.currentEditOrderSourceType;

                try {
                    this.$store.commit('SET_LOADING', true);

                    const res = await api.deleteOrder(orderId);

                    if (res && res.data && res.data.code === 0) {
                        // 从订单列表中删除
                        if (sourceType === 'paste') {
                            if (orderIndex >= 0 && orderIndex < this.pasteOrderItems.length) {
                                this.pasteOrderItems.splice(orderIndex, 1);
                            }
                        } else if (sourceType === 'auto' && this.uploadType === 'auto') {
                            // auto 模式下，需要找到在 orderItems 中的实际索引
                            const filteredItems = this.filteredOrderItems;
                            if (filteredItems && orderIndex >= 0 && orderIndex < filteredItems.length) {
                                const order = filteredItems[orderIndex];
                                const actualIndex = this.orderItems.findIndex(item => item === order);
                                if (actualIndex >= 0) {
                                    this.orderItems.splice(actualIndex, 1);
                                }
                            }
                        } else {
                            // excel 和 image 模式
                            if (orderIndex >= 0 && orderIndex < this.orderItems.length) {
                                this.orderItems.splice(orderIndex, 1);
                            }
                        }

                        // 更新缓存（从缓存中删除订单）
                        if (sourceType !== 'paste') {
                            this._removeOrderFromStorage(orderId, sourceType);
                        }

                        this.closeEditOrderModal();
                    } else {
                        alert(res?.data?.msg || '删除失败');
                    }
                } catch (error) {
                    console.error('删除订单失败:', error);
                    alert('删除失败，请检查网络');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 从缓存中删除订单
            _removeOrderFromStorage(orderId, sourceType) {
                if (!orderId || !this.selectedAllCustomer) {
                    return;
                }

                const storageKey = `ocrOrderDepList_${sourceType}`;

                try {
                    const ocrOrderDepListStr = localStorage.getItem(storageKey);
                    if (!ocrOrderDepListStr) {
                        return;
                    }

                    let ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
                    if (!Array.isArray(ocrOrderDepList)) {
                        return;
                    }

                    // 查找当前部门的缓存
                    const depIndex = ocrOrderDepList.findIndex(dep =>
                        String(dep.depId) === String(this.selectedAllCustomer) ||
                        String(dep.depFatherId) === String(this.selectedAllCustomer)
                    );

                    if (depIndex >= 0) {
                        const depData = ocrOrderDepList[depIndex];
                        if (depData.arr && Array.isArray(depData.arr)) {
                            // 从订单数组中删除
                            const orderIndex = depData.arr.findIndex(order =>
                                order.nxDepartmentOrdersId === orderId
                            );

                            if (orderIndex >= 0) {
                                depData.arr.splice(orderIndex, 1);

                                // 如果订单数组为空，删除整个部门缓存
                                if (depData.arr.length === 0) {
                                    ocrOrderDepList.splice(depIndex, 1);
                                }

                                // 保存回缓存
                                localStorage.setItem(storageKey, JSON.stringify(ocrOrderDepList));
                            }
                        }
                    }
                } catch (error) {
                    console.error('从缓存中删除订单失败:', error);
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
            async handleSaveNewGoods(item, orderIndex, sourceType) {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                // 检查必填字段
                const goodsName = item.nxDoGoodsName || '';
                const standard = item.nxDoStandard || '';

                if (!goodsName || !goodsName.trim()) {
                    alert('请填写商品名称');
                    return;
                }

                if (!standard || !standard.trim()) {
                    alert('请填写商品规格');
                    return;
                }

                // 弹出确认对话框
                const confirmMessage = `确定要保存新商品吗？\n\n商品名称：${goodsName.trim()}\n商品规格：${standard.trim()}`;
                if (!confirm(confirmMessage)) {
                    return;
                }

                // 获取配送商ID
                const disId = this.disUser?.nxDiuDistributerId;
                if (!disId) {
                    alert('无法获取配送商信息');
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
                    nxDgGoodsName: goodsName.trim(),
                    nxDgGoodsStandardname: standard.trim(),
                    nxDgGoodsStandardWeight: "-1",
                    nxDgGoodsBrand: "-1",
                    nxDgGoodsPlace: "-1",
                    nxDgGoodsInventoryType: 1,
                    nxDgNxGoodsFatherColor: "#20afb8",
                    nxDgGoodsFile: 'goodsImage/logo.jpg',
                    nxDistributerStandardEntities: [],
                    nxDgCartonUnit: "",
                    nxDgItemsPerCarton: ""
                };

                try {
                    this.$store.commit('SET_LOADING', true);

                    // 调用保存新商品API
                    const res = await api.saveNxDisLinshiGoods(goodsData);

                    if (res && res.data && res.data.code === 0) {
                        // 保存成功，获取返回的商品ID
                        const savedGoods = res.data.data;
                        const goodsId = savedGoods.nxDistributerGoodsId;
                        const savedGoodsName = savedGoods.nxDgGoodsName || goodsName;

                        // 设置当前编辑的订单索引和来源类型
                        this.orderArrIndex = orderIndex;
                        this.currentSourceType = sourceType;

                        // 设置商品ID和名称，然后调用 _choiceGoods 来应用这个商品
                        this.goodsId = goodsId;
                        this.selectedGoodsName = savedGoodsName;

                        // 调用保存商品选择（会自动更新订单状态）
                        await this._choiceGoods();

                        // 保存到缓存
                        if (sourceType !== 'paste') {
                            this._saveToStorage();
                        }
                    } else {
                        // 保存失败
                        const errorMsg = res?.data?.message || '保存失败，可能存在相同商品';
                        alert(errorMsg);
                        console.error('❌ [handleSaveNewGoods] 保存新商品失败:', res);
                    }
                } catch (error) {
                    console.error('❌ [handleSaveNewGoods] 保存新商品异常:', error);
                    alert('保存新商品失败，请检查网络连接');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 删除订单项
            handleDeleteOrderItem(orderIndex, sourceType) {
                const orderItems = this.getCurrentOrderItems(sourceType);
                if (confirm('确定要删除这个订单项吗？')) {
                    orderItems.splice(orderIndex, 1);
                    // 重置搜索和匹配商品列表状态
                    this.resetSearchAndMatchedGoodsState();
                    // 保存到缓存
                    if (sourceType === 'paste') {
                        this._saveToStorage(this.pasteOrderItems, 'paste');
                    } else {
                        this._saveToStorage();
                    }
                }
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
                    showSearchResults: false
                };

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
                    showSearchResults: false
                };
            },

            // 处理之前添加订单的商品名称输入（搜索商品）
            async handleBeforeOrderGoodsNameInput() {
                const searchStr = this.beforeOrderForm.goodsName.trim();

                if (!searchStr || searchStr.length < 1) {
                    this.beforeOrderForm.showSearchResults = false;
                    this.beforeOrderForm.searchResults = [];
                    return;
                }

                try {
                    // 获取部门ID
                    const depId = this.selectedSubDepartment || this.selectedAllCustomer;
                    if (!depId) {
                        return;
                    }

                    // 调用搜索API（参考 resGoodsList.js _againSearchString）
                    const data = {
                        disId: this.disUser?.nxDiuDistributerId,
                        searchStr: searchStr,
                        depId: depId
                    };

                    const res = await api.queryDisGoodsByQuickSearchWithDepId(data);

                    if (res && res.data && res.data.code === 0) {
                        // 返回数据结构：res.data.data.disArr 和 res.data.data.nxArr
                        const disArr = res.data.data.disArr || [];
                        const nxArr = res.data.data.nxArr || [];

                        // 合并配送商商品和系统商品
                        const allResults = [
                            ...disArr,
                            ...nxArr
                        ];

                        this.beforeOrderForm.searchResults = allResults;
                        this.beforeOrderForm.showSearchResults = allResults.length > 0;
                    } else {
                        // 搜索失败，清空结果
                        this.beforeOrderForm.showSearchResults = false;
                        this.beforeOrderForm.searchResults = [];
                    }
                } catch (error) {
                    console.error('搜索商品失败:', error);
                    this.beforeOrderForm.showSearchResults = false;
                    this.beforeOrderForm.searchResults = [];
                }
            },

            // 选择之前添加订单的商品
            async selectBeforeOrderGoods(goods) {
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
                    alert('请选择商品');
                    return;
                }

                if (!this.beforeOrderForm.quantity || !this.beforeOrderForm.quantity.toString().trim()) {
                    alert('请输入数量');
                    return;
                }

                if (!this.beforeOrderForm.standard || !this.beforeOrderForm.standard.toString().trim()) {
                    alert('请输入规格');
                    return;
                }

                // 获取部门ID
                const depId = this.selectedSubDepartment || this.selectedAllCustomer;
                if (!depId) {
                    alert('无法获取部门信息');
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
                        nxDoGoodsName: itemDis.nxDgGoodsName || ''
                    };

                    // 调用 saveOrderBefore API（参考 resGoodsList.js）
                    const res = await api.saveOrderBefore(orderData);

                    // Vue 中 axios 返回 res.data，后端返回 { code: 0, data: {...} }
                    // 所以访问 res.data.code 和 res.data.data
                    if (res && res.data && res.data.code === 0) {
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

                        // 保存到缓存
                        if (sourceType === 'paste') {
                            this._saveToStorage(this.pasteOrderItems, 'paste');
                        } else {
                            this._saveToStorage();
                        }

                        // alert('订单添加成功');
                    } else {
                        const errorMsg = res?.data?.msg || res?.data?.message || '保存失败';
                        alert(errorMsg);
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    alert('保存订单失败，请检查网络连接');
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

                if (!item) {
                    console.error('要删除的订单不存在，index:', orderIndex);
                    return;
                }


                // 如果订单有 nxDepartmentOrdersId，说明已经保存到服务器，需要调用接口删除
                if (item.nxDepartmentOrdersId) {

                    if (!confirm('确定要删除这个订单吗？')) {
                        return;
                    }

                    try {
                        this.$store.commit('SET_LOADING', true);

                        const res = await api.deleteOrder(item.nxDepartmentOrdersId);

                        if (res && res.data && res.data.code === 0) {
                            // 从数组中删除
                            orderItems.splice(orderIndex, 1);

                            // 重置搜索和匹配商品列表状态
                            this.resetSearchAndMatchedGoodsState();

                            // 更新缓存（从缓存中删除订单）
                            if (sourceType === 'paste') {
                                this._saveToStorage(this.pasteOrderItems, 'paste');
                            } else {
                                this._saveToStorage();
                            }

                        } else {
                            console.error('接口删除失败:', res?.data?.msg || res?.data?.message);
                            alert(res?.data?.msg || res?.data?.message || '删除失败');
                        }
                    } catch (error) {
                        console.error('删除订单接口调用失败:', error);
                        alert('删除失败，请检查网络连接');
                    } finally {
                        this.$store.commit('SET_LOADING', false);
                    }
                    return;
                }

                // 如果订单没有 nxDepartmentOrdersId，说明只是草稿，直接从数组中删除
                if (!confirm('确定要删除这个订单项吗？')) {
                    return;
                }

                orderItems.splice(orderIndex, 1);

                // 重置搜索和匹配商品列表状态
                // this.resetSearchAndMatchedGoodsState();
                 if(orderItems.length == 0){
                    this.pasteInputText = "";
                }


            },

            // 选择匹配的商品
            selectMatchedGoods(item, orderIndex, goodsIndex, sourceType) {
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型
                this.goodsId = item.nxDistributerGoodsEntityList[goodsIndex].nxDistributerGoodsId;
                this.selectedGoodsName = item.nxDistributerGoodsEntityList[goodsIndex].nxDgGoodsName || '';

                // 标记选中的商品索引
                item.selectedGoodsIndex = goodsIndex;

                // 调用保存商品选择
                this._choiceGoods();
            },

            // 选择匹配商品（转订单模式，直接传入商品对象）
            choiceGoodsForApply(orderGoods, orderIndex, sourceType) {
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型
                this.goodsId = orderGoods.nxDistributerGoodsId;
                this.selectedGoodsName = orderGoods.nxDgGoodsName || '';

                // 调用保存商品选择
                this._choiceGoods();
            },

            // 选择搜索结果中的商品
            selectSearchResult(goods, orderIndex, sourceType) {
                this.orderArrIndex = orderIndex;
                this.currentSourceType = sourceType; // 保存当前来源类型
                this.goodsId = goods.nxDistributerGoodsId;
                this.selectedGoodsName = goods.nxDgGoodsName || '';

                // 调用保存商品选择
                this._choiceGoods();
            },

            // 下载商品（参考微信小程序 downLoadGoodsNx）
            async downLoadGoodsNx(goods, orderIndex) {

                if (!goods || !goods.nxGoodsId) {
                    console.error("❌ 商品数据错误: goods 或 goods.nxGoodsId 不存在");
                    alert('商品数据错误');
                    return;
                }

                if (orderIndex === undefined || orderIndex === null) {
                    console.error("❌ orderIndex 为 undefined 或 null");
                    alert('订单索引错误');
                    return;
                }

                try {
                    this.$store.commit('SET_LOADING', true);
                    this.selectedGoodsName = goods.nxGoodsName;

                    // 根据当前 uploadType 确定 sourceType
                    // 注意：在 auto 模式下，orderIndex 是 filteredOrderItems 的索引
                    const sourceType = this.uploadType || 'excel';
                    this.currentSourceType = sourceType;
                    this.orderArrIndex = orderIndex;

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

                    const res = await api.downDisGoods(dg);


                    if (res && res.data && res.data.code === 0) {
                        // 设置商品ID和名称，然后调用 _choiceGoods 应用商品
                        this.goodsId = res.data.data.nxDistributerGoodsId;
                        this.selectedGoodsName = res.data.data.nxDgGoodsName || goods.nxGoodsName;

                        // 确保 orderArrIndex 和 currentSourceType 正确设置（再次确认）
                        this.orderArrIndex = orderIndex;
                        this.currentSourceType = sourceType;
                        await this._choiceGoods();
                    } else {
                        const errorMsg = res?.data?.msg || '下载商品失败';
                        console.error("❌ [downLoadGoodsNx] 下载失败:", errorMsg);
                        alert(errorMsg);
                    }
                } catch (error) {
                    console.error("❌ [downLoadGoodsNx] 下载商品失败:", error);
                    alert('下载商品失败: ' + (error.message || '未知错误'));
                } finally {
                    this.$store.commit('SET_LOADING', false);
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
                        depId: this.selectedAllCustomer,
                    };

                    const res = await api.queryDisGoodsByQuickSearchWithDepId(data);

                    if (res && res.data && res.data.code === 0) {
                        this.strArr = res.data.data.disArr || [];
                        this.nxArr = res.data.data.nxArr || [];

                        // 根据来源类型更新对应的订单列表
                        let currentOrderItems;
                        let actualOrderIndex = this.orderArrIndex;

                        if (sourceType === 'paste') {
                            currentOrderItems = this.pasteOrderItems;
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

                        // 保存到缓存（所有类型都需要，以便刷新后恢复搜索结果）
                        if (currentOrderItems) {
                            this._saveToStorage(currentOrderItems, sourceType);
                        } else {
                        }

                        // 强制更新视图，确保搜索结果下拉框显示
                        this.$nextTick(() => {
                            // 视图已更新
                        });
                    } else {
                        this.strArr = [];
                        this.nxArr = [];

                        // 如果是"搜索结果过多"的错误，不弹出提示
                        const errorMsg = res?.data?.msg || '';
                        const isTooManyResults = res?.data?.code === 500 && (
                            errorMsg.includes('标准商品库搜索结果过多') ||
                            errorMsg.includes('配送商商品搜索结果过多') ||
                            errorMsg.includes('搜索结果过多')
                        );

                        if (!isTooManyResults) {
                            alert(errorMsg || '搜索失败');
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
                const sourceType = this.currentSourceType || this.uploadType || 'excel';

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
                    pasteOrderItemsLength: this.pasteOrderItems?.length,
                    filteredOrderItemsLength: this.uploadType === 'auto' ? this.filteredOrderItems?.length : 'N/A'
                });

                if (sourceType === 'paste') {
                    currentOrderItems = this.pasteOrderItems;
                    console.log("✅ [_choiceGoods] 使用 pasteOrderItems, 索引:", index);
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
                    alert('商品ID不存在');
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
                                // 如果已存在相同 ID 的订单，移除旧的草稿订单（当前索引的订单）
                                console.log('发现重复的已保存订单，移除草稿订单:', {
                                    existingIndex,
                                    actualIndex,
                                    nxDepartmentOrdersId: updatedOrder.nxDepartmentOrdersId
                                });
                                currentOrderItems.splice(actualIndex, 1);
                            } else {
                                // 如果不存在重复，直接更新
                                currentOrderItems[actualIndex] = updatedOrder;
                            }
                        } else {
                            // 如果还没有保存（没有 nxDepartmentOrdersId），直接更新
                            currentOrderItems[actualIndex] = updatedOrder;
                        }

                        // 更新缓存（只有 Excel 和图片需要）
                        if (sourceType !== 'paste') {
                            // 传递正确的索引给 _updateStorage
                            this._updateStorage(updatedOrder, actualIndex);
                        }

                        // 重置搜索和匹配商品列表状态（选择商品后关闭所有列表）
                        this.resetSearchAndMatchedGoodsState();
                    } else {
                        alert(res?.data?.msg || '保存失败');
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    alert('保存订单失败');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 更新单个订单到缓存
            _updateStorage(order, orderIndex) {
                // 使用传入的 orderIndex，如果没有则使用 orderArrIndex
                const index = orderIndex !== undefined ? orderIndex : this.orderArrIndex;

                // 检查索引是否有效
                if (index === undefined || index === null || index < 0) {
                    console.error('订单索引无效，无法更新存储:', index);
                    return;
                }

                // 检查索引是否越界
                if (index >= this.orderItems.length) {
                    console.error('订单索引越界，无法更新存储:', {
                        index,
                        orderItemsLength: this.orderItems.length
                    });
                    return;
                }

                // 更新内存中的 orderItems（如果订单还在原位置）
                if (this.orderItems[index]) {
                    const currentOrder = this.orderItems[index];
                    const mergedOrder = {
                        ...currentOrder,
                        ...order,
                    };

                    // Vue 3 中直接赋值即可，不需要 $set
                    this.orderItems[index] = mergedOrder;
                }

                // 更新缓存
                this._saveToStorage();
            },

            // 检查订单内容（参考微信小程序的 _checkOrderContent）
            checkOrderContent(orderArr = null) {
                const orders = orderArr || this.orderItems;

                if (!orders || orders.length === 0) {
                    alert('没有可保存的订单');
                    return false;
                }

                for (let i = 0; i < orders.length; i++) {
                    const order = orders[i];

                    if (!order.nxDoGoodsName || order.nxDoGoodsName.trim() === '') {
                        alert(`第${i + 1}条订单商品名称为空`);
                        return false;
                    }

                    if (!order.nxDoQuantity || Number(order.nxDoQuantity) <= 0) {
                        alert(`第${i + 1}条订单数量无效`);
                        return false;
                    }

                    if (!order.nxDoStandard || order.nxDoStandard.trim() === '') {
                        alert(`第${i + 1}条订单规格为空`);
                        return false;
                    }
                }

                return true;
            },

            // 保存订单（使用 pasteSearchGoods，参考微信小程序）
            async pasteSearchGoods() {
                const canSave = this.checkOrderContent();
                if (!canSave) {
                    return;
                }

                try {
                    this.savingOrder = true;
                    this.$store.commit('SET_LOADING', true);

                    // 确定要使用的部门ID（优先使用子部门ID）
                    const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                    // 准备订单数据，确保包含必要的字段
                    const originalOrderArr = [...this.orderItems];
                    const orderData = this.orderItems.map(item => ({
                        ...item,
                        nxDoDepartmentId: targetDepId, // 使用确定的部门ID
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoDistributerId: this.disUser.nxDiuDistributerId,
                        nxDoIsAgent: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
                    }));

                    const res = await api.pasteSearchGoods(orderData);

                    if (res && res.data && res.data.code === 0) {
                        const tempArr = res.data.data || [];

                        const listArr = [];
                        let haveId = 0;

                        for (let i = 0; i < tempArr.length; i++) {
                            const status = tempArr[i].nxDoStatus;
                            if (status !== -2) {
                                haveId = haveId + 1;
                            }

                            const item = {
                                ...tempArr[i],
                                nxDoStandardWarn: 0
                            };

                            // 保留原有的 nxDoGoodsNameOriginal
                            const originalOrder = originalOrderArr[i];
                            if (originalOrder && originalOrder.nxDoGoodsNameOriginal) {
                                item.nxDoGoodsNameOriginal = originalOrder.nxDoGoodsNameOriginal;
                            } else {
                                item.nxDoGoodsNameOriginal = originalOrder?.nxDoGoodsName || item.nxDoGoodsName || '';
                            }

                            listArr.push(item);
                        }

                        this.orderItems = listArr;

                        // 保存到缓存
                        this._saveToStorage(listArr, this.uploadType);

                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                        alert('保存成功！');

                        // 发出事件通知父组件刷新客户列表
                        this.$emit('order-saved');
                    } else {
                        const errorMsg = res?.data?.msg || '保存失败';
                        alert(errorMsg);
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    alert('保存订单失败，请重试：' + (error.message || '未知错误'));
                } finally {
                    this.savingOrder = false;
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 保存复制粘贴的订单（独立方法）
            async savePasteOrders() {
                const canSave = this.checkOrderContent(this.pasteOrderItems);
                if (!canSave) {
                    return;
                }

                try {
                    this.savingOrder = true;
                    this.$store.commit('SET_LOADING', true);

                    // 确定要使用的部门ID（优先使用子部门ID）
                    const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                    // 准备订单数据，确保包含必要的字段
                    const originalOrderArr = [...this.pasteOrderItems];
                    const orderData = this.pasteOrderItems.map(item => ({
                        ...item,
                        nxDoDepartmentId: targetDepId,
                        nxDoDepartmentFatherId: this.selectedAllCustomer,
                        nxDoDistributerId: this.disUser.nxDiuDistributerId,
                        nxDoIsAgent: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
                    }));

                    const res = await api.pasteSearchGoods(orderData);

                    if (res && res.data && res.data.code === 0) {
                        const tempArr = res.data.data || [];

                        const listArr = [];
                        let haveId = 0;

                        for (let i = 0; i < tempArr.length; i++) {
                            const status = tempArr[i].nxDoStatus;
                            if (status !== -2) {
                                haveId = haveId + 1;
                            }

                            const item = {
                                ...tempArr[i],
                                nxDoStandardWarn: 0
                            };

                            // 保留原有的 nxDoGoodsNameOriginal
                            const originalOrder = originalOrderArr[i];
                            if (originalOrder && originalOrder.nxDoGoodsNameOriginal) {
                                item.nxDoGoodsNameOriginal = originalOrder.nxDoGoodsNameOriginal;
                            } else {
                                item.nxDoGoodsNameOriginal = originalOrder?.nxDoGoodsName || item.nxDoGoodsName || '';
                            }

                            listArr.push(item);
                        }

                        // 保存后保留订单列表，更新状态（参考小程序 pasteSearchGoods 和 Excel/图片保存方式）
                        this.pasteOrderItems = listArr;
                        this.pasteSaveCount = haveId; // 更新已保存订单数量

                        // 保存到缓存（与 Excel/图片保存方式一致）
                        this._saveToStorage(listArr, 'paste');

                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                        alert('保存成功！');

                        // 发出事件通知父组件刷新客户列表
                        this.$emit('order-saved');
                    } else {
                        const errorMsg = res?.data?.msg || '保存失败';
                        alert(errorMsg);
                    }
                } catch (error) {
                    console.error('保存订单失败:', error);
                    alert('保存订单失败，请重试：' + (error.message || '未知错误'));
                } finally {
                    this.savingOrder = false;
                    this.$store.commit('SET_LOADING', false);
                }
            },

            // 清除复制粘贴的草稿
            async clearPasteSave() {


                if (!confirm('确定要清除所有草稿订单吗？')) {
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

                // if (folderPath && window.electronAPI && typeof window.electronAPI.moveProcessedToCompleted === 'function') {
                //     console.log('📁 [clearPasteSave] 开始移动"已处理"文件夹中的文件到"已完成"文件夹');
                //     console.log('   - 文件夹路径:', folderPath);
                //     try {
                //         const moveResult = await window.electronAPI.moveProcessedToCompleted(folderPath);
                //         if (moveResult.success) {
                //             console.log(`✅ [clearPasteSave] 文件移动成功: 已将 ${moveResult.movedCount} 个文件从"已处理"移动到"已完成"文件夹`);
                //             if (moveResult.errors && moveResult.errors.length > 0) {
                //                 console.warn('⚠️ [clearPasteSave] 部分文件移动失败:', moveResult.errors);
                //             }
                //         } else {
                //             console.warn('❌ [clearPasteSave] 移动文件到已完成文件夹失败:', moveResult.error);
                //         }
                //     } catch (error) {
                //         console.error('❌ [clearPasteSave] 移动文件到已完成文件夹异常:', error);
                //     }
                // }
                //

                // 从 localStorage 中删除该部门的缓存
                const storageKey = `ocrOrderDepList_paste`;

                try {
                    let ocrOrderDepList = [];
                    const ocrOrderDepListStr = localStorage.getItem(storageKey);
                    if (ocrOrderDepListStr) {
                        ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
                        if (Array.isArray(ocrOrderDepList)) {
                            // 过滤掉当前部门的缓存
                            const beforeCount = ocrOrderDepList.length;
                            const filteredList = ocrOrderDepList.filter(item => {
                                const itemDepIdStr = String(item.depId);
                                const selectedDepIdStr = String(this.selectedAllCustomer);
                                return itemDepIdStr !== selectedDepIdStr;
                            });
                            const afterCount = filteredList.length;
                            // 如果过滤后没有数据了，删除整个缓存
                            if (filteredList.length === 0) {
                                localStorage.removeItem(storageKey);
                            } else {
                                // 保存更新后的缓存
                                localStorage.setItem(storageKey, JSON.stringify(filteredList));
                            }
                        }
                    } else {
                        console.log('   - 缓存不存在或为空');
                    }
                } catch (error) {
                    console.error('❌ [clearPasteSave] 删除复制粘贴缓存失败:', error);
                }

                this.pasteOrderItems = [];
                this.pasteHasCache = false;
                this.pasteInputText = '';
                this.pasteInputContent = '';
                this.pasteSaveCount = null;
                this.ocrOrderDepIndex = -1;

                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

            },

            // 清除Excel或图片模式的草稿（转订单模式使用）
            clearExcelOrImageSave() {
                // 直接调用通用的清除方法（clearSave内部会处理重置）
                this.clearSave();
            },

            // 清除草稿订单（参考微信小程序 clearSave）
            async clearSave() {


                // 重置搜索和匹配商品列表状态（在确认前重置，确保点击按钮时立即关闭）
                this.resetSearchAndMatchedGoodsState();

                if (!confirm('确定要清除所有草稿订单吗？')) {
                    console.log('❌ [clearSave] 用户取消清除操作');
                    return;
                }

                // 从 orderItems 中删除所有状态为 -2 的订单
                const originalOrderArr = [...this.orderItems];
                const filteredOrderArr = [];
                const ordersToDeleteFromServer = [];

                console.log('📋 [clearSave] 开始筛选订单');
                for (let k = 0; k < originalOrderArr.length; k++) {
                    const currentOrder = originalOrderArr[k];

                    // 直接判断状态是否为 -2
                    if (currentOrder.nxDoStatus === -2) {
                        console.log(`   - 发现草稿订单 [${k}]:`, {
                            goodsName: currentOrder.nxDoGoodsName,
                            nxDepartmentOrdersId: currentOrder.nxDepartmentOrdersId || '(无ID)',
                            status: currentOrder.nxDoStatus
                        });
                        // 如果订单有 nxDepartmentOrdersId，需要调用接口删除
                        if (currentOrder.nxDepartmentOrdersId) {
                            ordersToDeleteFromServer.push({
                                index: k,
                                nxDepartmentOrdersId: currentOrder.nxDepartmentOrdersId,
                                goodsName: currentOrder.nxDoGoodsName
                            });
                        }
                    } else {
                        filteredOrderArr.push(currentOrder);
                    }
                }


                // 调用接口删除服务器上的订单
                if (ordersToDeleteFromServer.length > 0) {
                    try {
                        this.$store.commit('SET_LOADING', true);

                        const deletePromises = ordersToDeleteFromServer.map(order =>
                            api.deleteOrder(order.nxDepartmentOrdersId)
                        );

                        const results = await Promise.all(deletePromises);

                        let allSuccess = true;
                        const failedOrders = [];
                        const successCount = 0;

                        results.forEach((res, idx) => {
                            const order = ordersToDeleteFromServer[idx];
                            if (res && res.data && res.data.code === 0) {
                            } else {
                                allSuccess = false;
                                failedOrders.push(order);
                            }
                        });


                    } catch (error) {
                        console.error('❌ [clearSave] 删除订单异常:', error);
                        alert('删除失败，请检查网络');
                    } finally {
                        this.$store.commit('SET_LOADING', false);
                    }
                } else {
                    console.log('⏭️ [clearSave] 没有需要从服务器删除的订单');
                }

                // 无论接口是否成功，都从 orderItems 中删除
                this.orderItems = filteredOrderArr;

                // 检查删除后是否还有草稿订单（status == -2）
                const hasDraftOrders = filteredOrderArr.some(order => order.nxDoStatus === -2);


                // 如果删除后没有订单了，或者所有订单都是已保存的（没有草稿），删除该部门的缓存
                if (filteredOrderArr.length === 0 || !hasDraftOrders) {
                    // 将"已处理"文件夹中的文件移动到"已完成"文件夹
                    let folderPath = this.customerFolderPath;

                    // 如果文件夹路径为空，尝试重新加载（特别是对于 auto 模式）
                    // if (!folderPath && this.uploadType === 'auto' && this.selectedAllCustomer) {
                    //     console.log('📂 [clearSave] 文件夹路径为空，尝试重新加载');
                    //     try {
                    //         await this.loadCustomerFolderPath();
                    //         folderPath = this.customerFolderPath;
                    //         console.log('   - 重新加载后的文件夹路径:', folderPath);
                    //     } catch (error) {
                    //         console.error('❌ [clearSave] 重新加载文件夹路径失败:', error);
                    //     }
                    // }

                    // if (folderPath && window.electronAPI && typeof window.electronAPI.moveProcessedToCompleted === 'function') {
                    //     console.log('📁 [clearSave] 开始移动"已处理"文件夹中的文件到"已完成"文件夹');
                    //     console.log('   - 文件夹路径:', folderPath);
                    //     try {
                    //         const moveResult = await window.electronAPI.moveProcessedToCompleted(folderPath);
                    //         if (moveResult.success) {
                    //             console.log(`✅ [clearSave] 文件移动成功: 已将 ${moveResult.movedCount} 个文件从"已处理"移动到"已完成"文件夹`);
                    //             if (moveResult.errors && moveResult.errors.length > 0) {
                    //                 console.warn('⚠️ [clearSave] 部分文件移动失败:', moveResult.errors);
                    //             }
                    //         } else {
                    //             console.warn('❌ [clearSave] 移动文件到已完成文件夹失败:', moveResult.error);
                    //         }
                    //     } catch (error) {
                    //         console.error('❌ [clearSave] 移动文件到已完成文件夹异常:', error);
                    //     }
                    // } else {
                    //
                    //
                    // }

                    // 从 localStorage 中删除该部门的缓存
                    const currentSourceType = this.uploadType || 'paste';
                    const storageKey = `ocrOrderDepList_${currentSourceType}`;

                    try {
                        let ocrOrderDepList = [];
                        const ocrOrderDepListStr = localStorage.getItem(storageKey);
                        if (ocrOrderDepListStr) {
                            ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
                            if (Array.isArray(ocrOrderDepList)) {
                                // 过滤掉当前部门的缓存
                                const beforeCount = ocrOrderDepList.length;
                                const filteredList = ocrOrderDepList.filter(item => {
                                    const itemDepIdStr = String(item.depId);
                                    const selectedDepIdStr = String(this.selectedAllCustomer);
                                    return itemDepIdStr !== selectedDepIdStr;
                                });
                                const afterCount = filteredList.length;
                                // 如果过滤后没有数据了，删除整个缓存
                                if (filteredList.length === 0) {
                                    localStorage.removeItem(storageKey);
                                } else {
                                    // 保存更新后的缓存
                                    localStorage.setItem(storageKey, JSON.stringify(filteredList));
                                }
                            }
                        } else {
                            console.log('   - 缓存不存在或为空');
                        }
                    } catch (error) {
                        console.error('❌ [clearSave] 删除缓存失败:', error);
                    }

                    // 如果当前是 Excel 上传模式，清除已选择的 Excel 文件
                    if (this.uploadType === 'excel') {
                        console.log('🔄 [clearSave] 清除Excel文件信息');
                        this.uploadedExcelFile = null;
                        this.uploadedExcelPreview = null;
                        if (this.$refs.excelFileInput) {
                            this.$refs.excelFileInput.value = '';
                        }
                    }

                    // 如果当前是图片上传模式，清除已选择的图片文件
                    if (this.uploadType === 'image') {
                        console.log('🔄 [clearSave] 清除图片文件信息');
                        this.uploadedImageFile = null;
                        this.imagePreview = null;
                        if (this.$refs.imageFileInput) {
                            this.$refs.imageFileInput.value = '';
                        }
                    }

                    // 重置相关状态
                    console.log('🔄 [clearSave] 重置状态数据');
                    this.orderItems = [];
                    this.hasCache = false;
                    this.ocrOrderDepIndex = -1;

                    // 重置搜索和匹配商品列表状态
                    this.resetSearchAndMatchedGoodsState();

                    // 如果是转订单模式，刷新文件夹列表（因为文件已移动到"已完成"文件夹）
                    if (this.uploadType === 'auto' && this.customerFolderPath) {
                        console.log('🔄 [clearSave] 转订单模式：刷新文件夹列表');
                        try {
                            await this.scanFolderFiles();
                            console.log('✅ [clearSave] 文件夹列表已刷新');
                        } catch (error) {
                            console.error('❌ [clearSave] 刷新文件夹列表失败:', error);
                        }
                    }

                    console.log('✅ [clearSave] 清除草稿订单完成');
                } else {
                    // 如果还有草稿订单，更新缓存
                    console.log('💾 [clearSave] 还有草稿订单，更新缓存');
                    this._saveToStorage(filteredOrderArr, this.uploadType);
                    console.log('✅ [clearSave] 清除草稿订单完成（保留部分订单）');
                }
            },

            // 重新上传：批量删除所有订单
            async reUpload() {
                console.log('========== [reUpload] 开始执行 ==========');
                
                if (!this.selectedAllCustomer) {
                    console.log('❌ [reUpload] 未选择客户');
                    alert('请先选择客户');
                    return;
                }

                // 根据上传类型获取对应的订单列表
                let currentOrderItems;
                let sourceType = this.uploadType || 'image';
                
                console.log('📋 [reUpload] 上传类型:', sourceType);
                console.log('📋 [reUpload] 客户ID:', this.selectedAllCustomer);
                
                if (sourceType === 'paste') {
                    // 复制粘贴模式使用 pasteOrderItems
                    currentOrderItems = this.pasteOrderItems || [];
                    console.log('📋 [reUpload] 使用 pasteOrderItems, 数量:', currentOrderItems.length);
                    console.log('📋 [reUpload] pasteOrderItems:', currentOrderItems);
                } else {
                    // image/excel/auto 模式使用 orderItems
                    currentOrderItems = this.orderItems || [];
                    console.log('📋 [reUpload] 使用 orderItems, 数量:', currentOrderItems.length);
                    console.log('📋 [reUpload] orderItems:', currentOrderItems);
                }

                // 收集当前上传类型的所有已保存订单ID（有nxDepartmentOrdersId的订单）
                const allOrderIds = currentOrderItems
                    .map(item => item?.nxDepartmentOrdersId)
                    .filter(id => id != null);
                
                console.log('📋 [reUpload] 所有订单的ID列表:', allOrderIds);
                
                // 详细输出每个订单的信息，特别是检查nxDepartmentOrdersId字段
                console.log('📋 [reUpload] 订单详情（前5个）:', currentOrderItems.slice(0, 5).map((item, index) => {
                    const orderInfo = {
                        index: index,
                        goodsName: item?.nxDoGoodsName,
                        orderId: item?.nxDepartmentOrdersId,
                        orderIdType: typeof item?.nxDepartmentOrdersId,
                        orderIdValue: item?.nxDepartmentOrdersId,
                        status: item?.nxDoStatus,
                        hasOrderId: !!item?.nxDepartmentOrdersId,
                        orderIdIsNull: item?.nxDepartmentOrdersId === null,
                        orderIdIsUndefined: item?.nxDepartmentOrdersId === undefined,
                        // 输出完整的订单对象（仅前5个）
                        fullItem: item
                    };
                    return orderInfo;
                }));
                
                // 统计订单状态
                const orderStats = {
                    total: currentOrderItems.length,
                    withOrderId: currentOrderItems.filter(item => item?.nxDepartmentOrdersId).length,
                    withoutOrderId: currentOrderItems.filter(item => !item?.nxDepartmentOrdersId).length,
                    statusCounts: {}
                };
                
                currentOrderItems.forEach(item => {
                    const status = item?.nxDoStatus ?? 'unknown';
                    orderStats.statusCounts[status] = (orderStats.statusCounts[status] || 0) + 1;
                });
                
                console.log('📊 [reUpload] 订单统计:', orderStats);

                const orderIds = currentOrderItems
                    .filter(item => item && item.nxDepartmentOrdersId)
                    .map(item => item.nxDepartmentOrdersId);

                console.log('📋 [reUpload] 过滤后的订单ID列表:', orderIds);
                console.log('📋 [reUpload] 需要删除的订单数量:', orderIds.length);

                if (orderIds.length === 0) {
                    console.log('⚠️ [reUpload] 没有需要删除的订单（没有已保存的订单）');
                    
                    // 检查是否有草稿订单
                    const draftOrders = currentOrderItems.filter(item => 
                        item && (item.nxDoStatus === -2 || !item.nxDepartmentOrdersId)
                    );
                    
                    if (draftOrders.length > 0) {
                        console.log(`⚠️ [reUpload] 发现 ${draftOrders.length} 个草稿订单（未保存到服务器）`);
                        console.log('💡 [reUpload] 提示：草稿订单无法删除，因为它们还没有保存到服务器');
                        alert(`当前有 ${currentOrderItems.length} 个订单，但都是草稿订单（未保存到服务器），无法删除。\n\n如果需要清空草稿订单，请使用"清空内容"功能。`);
                    } else {
                        alert('没有需要删除的订单');
                    }
                    return;
                }

                // 确认删除
                const uploadTypeName = sourceType === 'paste' ? '复制粘贴' : 
                                      sourceType === 'excel' ? 'Excel上传' : 
                                      sourceType === 'auto' ? '转订单' : '图片上传';
                const confirmMessage = `确定要删除所有 ${orderIds.length} 个订单吗？\n删除后可以重新${uploadTypeName}。`;
                console.log('📋 [reUpload] 确认删除对话框:', confirmMessage);
                
                if (!confirm(confirmMessage)) {
                    console.log('❌ [reUpload] 用户取消删除操作');
                    return;
                }

                console.log('✅ [reUpload] 用户确认删除，开始调用批量删除接口');

                try {
                    this.$store.commit('SET_LOADING', true);
                    console.log('📤 [reUpload] 调用批量删除接口，订单ID:', orderIds);
                    console.log('📤 [reUpload] 请求开始时间:', new Date().toISOString());
                    
                    const startTime = Date.now();

                    // 调用批量删除接口（超时时间已设置为5分钟）
                    const res = await api.deleteBatchOrders(orderIds);
                    
                    const endTime = Date.now();
                    const duration = ((endTime - startTime) / 1000).toFixed(2);
                    console.log('📥 [reUpload] 批量删除接口响应:', res);
                    console.log(`⏱️ [reUpload] 请求耗时: ${duration} 秒`);
                    console.log('📥 [reUpload] 请求结束时间:', new Date().toISOString());

                    if (res && res.data && res.data.code === 0) {
                        // 删除成功，清空当前上传类型的所有订单列表和缓存
                        console.log('✅ [reUpload] 批量删除订单成功');
                        console.log('📋 [reUpload] 删除响应数据:', res.data);

                        // 根据上传类型清空对应的订单列表
                        if (sourceType === 'paste') {
                            // 复制粘贴模式
                            console.log('🔄 [reUpload] 清空复制粘贴模式的数据');
                            console.log('🔄 [reUpload] 删除前 pasteOrderItems 数量:', this.pasteOrderItems?.length);
                            this.pasteOrderItems = [];
                            this.pasteHasCache = false;
                            this.pasteInputText = '';
                            this.pasteInputContent = '';
                            this.pasteOriginText = '';
                            this.pasteSaveCount = null;
                            console.log('✅ [reUpload] 复制粘贴模式数据已清空');
                        } else {
                            // image/excel/auto 模式
                            console.log('🔄 [reUpload] 清空 image/excel/auto 模式的数据');
                            console.log('🔄 [reUpload] 删除前 orderItems 数量:', this.orderItems?.length);
                            this.orderItems = [];
                            this.hasCache = false;
                            this.ocrOrderDepIndex = -1;
                            console.log('✅ [reUpload] image/excel/auto 模式数据已清空');
                        }

                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                        // 清除缓存
                        const storageKey = `ocrOrderDepList_${this.selectedAllCustomer}_${sourceType}`;
                        console.log('🔄 [reUpload] 清除缓存，storageKey:', storageKey);
                        try {
                            localStorage.removeItem(storageKey);
                            console.log('✅ [reUpload] 缓存已清除');
                        } catch (error) {
                            console.error('❌ [reUpload] 清除缓存失败:', error);
                        }

                        // 清除所有上传文件路径和预览
                        // 图片上传模式
                        if (sourceType === 'image') {
                            console.log('🔄 [reUpload] 清除图片上传文件');
                            this.uploadedImageFile = null;
                            this.imagePreview = null;
                            if (this.$refs.imageFileInput) {
                                this.$refs.imageFileInput.value = '';
                            }
                            console.log('✅ [reUpload] 图片上传文件已清除');
                        }

                        // Excel上传模式
                        if (sourceType === 'excel') {
                            console.log('🔄 [reUpload] 清除Excel上传文件');
                            this.uploadedExcelFile = null;
                            this.uploadedExcelPreview = null;
                            if (this.$refs.excelFileInput) {
                                this.$refs.excelFileInput.value = '';
                            }
                            console.log('✅ [reUpload] Excel上传文件已清除');
                        }

                        // 转订单模式：清除文件夹路径和相关文件信息
                        if (sourceType === 'auto') {
                            console.log('🔄 [reUpload] 清除转订单模式的文件信息');
                            this.customerFolderPath = null;
                            this.autoProcessFiles = [];
                            this.autoProcessImagePreviews = {};
                            this.autoProcessExcelPreviews = {};
                            this.activeProcessedFileTab = null;
                            this.autoProcessImagePreview = null;
                            this.autoProcessImagePreviewFileName = '';
                            this.autoProcessResults = [];
                            console.log('✅ [reUpload] 转订单模式文件信息已清除');
                        }

                        // 复制粘贴模式不需要清除文件，因为它是文本输入

                        const uploadTypeName = sourceType === 'paste' ? '复制粘贴' : 
                                              sourceType === 'excel' ? 'Excel上传' : 
                                              sourceType === 'auto' ? '转订单' : '图片上传';
                        console.log('✅ [reUpload] 所有操作完成，显示成功提示');
                        alert(`成功删除 ${orderIds.length} 个订单，可以重新${uploadTypeName}`);
                        console.log('========== [reUpload] 执行完成 ==========');
                    } else {
                        const errorMsg = res?.data?.msg || res?.data?.message || '删除失败';
                        console.error('❌ [reUpload] 批量删除订单失败');
                        console.error('❌ [reUpload] 错误信息:', errorMsg);
                        console.error('❌ [reUpload] 响应数据:', res?.data);
                        alert(errorMsg);
                        console.log('========== [reUpload] 执行失败 ==========');
                    }
                } catch (error) {
                    console.error('❌ [reUpload] 批量删除订单异常');
                    console.error('❌ [reUpload] 异常详情:', error);
                    console.error('❌ [reUpload] 异常堆栈:', error.stack);
                    alert('删除失败，请检查网络连接');
                    console.log('========== [reUpload] 执行异常 ==========');
                } finally {
                    this.$store.commit('SET_LOADING', false);
                    console.log('🔄 [reUpload] 关闭加载状态');
                }
            },

            // ========== 图片上传相关方法 ==========

            // 处理图片文件上传（打开预览弹窗）
            async handleImageUpload(event) {
                const file = event.target.files[0];
                if (!file) return;

                // 验证文件类型
                if (!file.type.startsWith('image/')) {
                    alert('请选择有效的图片文件');
                    return;
                }

                // 验证文件大小（限制10MB）
                if (file.size > 10 * 1024 * 1024) {
                    alert('图片文件过大，请选择小于10MB的图片');
                    return;
                }

                if (!this.selectedAllCustomer) {
                    alert('请先选择客户');
                    return;
                }

                // 检查是否选择了子部门（如果有子部门的话）
                if (!this.checkSubDepartmentSelected()) {
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
                this.showCropMode = false;
                this.previewImageDataUrl = null;
                // 重置图片变换（确保下次打开时图片完整显示）
                this.imageScale = 1;
                this.imageTranslateX = 0;
                this.imageTranslateY = 0;
                // 清空文件输入
                if (this.$refs.imageFileInput) {
                    this.$refs.imageFileInput.value = '';
                }
            },

            // 从弹窗直接识别（不裁剪）
            async recognizeFromModal() {
                if (!this.previewImageDataUrl) {
                    alert('没有可识别的图片');
                    return;
                }
                // 关闭弹窗
                this.closeImagePreviewModal();
                // 设置预览图片并执行识别
                this.imagePreview = this.previewImageDataUrl;
                await this.recognizeImage(this.previewImageDataUrl);
            },

            // 应用裁剪并识别
            async applyCropAndRecognize() {
                if (!this.previewImageDataUrl || !this.$refs.previewImageModal) {
                    alert('没有可裁剪的图片');
                    return;
                }

                try {
                    const imgElement = this.$refs.previewImageModal;
                    const imgRect = imgElement.getBoundingClientRect();
                    
                    // 计算裁剪区域在原始图片中的坐标
                    const imgNaturalWidth = imgElement.naturalWidth;
                    const imgNaturalHeight = imgElement.naturalHeight;
                    const imgDisplayWidth = imgRect.width;
                    const imgDisplayHeight = imgRect.height;
                    
                    // 计算缩放比例（显示尺寸 vs 原始尺寸）
                    const scaleX = imgNaturalWidth / imgDisplayWidth;
                    const scaleY = imgNaturalHeight / imgDisplayHeight;
                    
                    // 考虑图片的transform偏移和缩放
                    const scale = this.imageScale;
                    const offsetX = this.imageTranslateX;
                    const offsetY = this.imageTranslateY;
                    
                    // 计算裁剪区域在原始图片中的坐标和尺寸
                    const cropX = Math.max(0, (this.cropBox.x - offsetX) * scaleX / scale);
                    const cropY = Math.max(0, (this.cropBox.y - offsetY) * scaleY / scale);
                    const cropWidth = Math.min(imgNaturalWidth - cropX, this.cropBox.width * scaleX / scale);
                    const cropHeight = Math.min(imgNaturalHeight - cropY, this.cropBox.height * scaleY / scale);
                    
                    // 创建canvas进行裁剪
                    const canvas = document.createElement('canvas');
                    canvas.width = cropWidth;
                    canvas.height = cropHeight;
                    const ctx = canvas.getContext('2d');
                    
                    const img = new Image();
                    img.onload = async () => {
                        ctx.drawImage(
                            img,
                            cropX, cropY, cropWidth, cropHeight,
                            0, 0, cropWidth, cropHeight
                        );
                        
                        // 转换为base64
                        const croppedDataUrl = canvas.toDataURL('image/png');
                        
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
                    };
                    img.src = this.previewImageDataUrl;
                } catch (error) {
                    console.error('裁剪失败:', error);
                    alert('裁剪失败，请重试');
                }
            },

            // 执行OCR识别（使用当前预览的图片或裁剪后的图片）
            async recognizeImage(imageDataUrl) {
                if (!this.selectedAllCustomer) {
                    alert('请先选择客户');
                    return;
                }

                // 确定要使用的部门ID（如果有子部门选择，使用子部门ID，否则使用父部门ID）
                const targetDepId = this.selectedSubDepartment || this.selectedAllCustomer;

                try {
                    this.recognizingImage = true;
                    this.$store.commit('SET_LOADING', true);

                    // 将图片DataURL转换为Base64（去掉data:image/...;base64,前缀）
                    const imageBase64 = imageDataUrl.includes(',') ? imageDataUrl.split(',')[1] : imageDataUrl;

                    // 调用OCR识别API（参考微信小程序 callTencentOCR）
                    const ocrData = {
                        ImageBase64: imageBase64,
                        depId: targetDepId, // 使用确定的部门ID（可能是子部门ID）
                        depFatherId: this.selectedAllCustomer, // 父部门ID始终是选中的客户ID
                        disId: this.disUser.nxDiuDistributerId,
                        userId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId
                    };

                    const res = await api.recognizeOrderOCR(ocrData);

                    if (res && res.data && res.data.code === 0) {
                        // 检查后端是否已经保存了订单（pasteSearchGoods 已调用）
                        // 如果 res.data.data 是数组，说明后台已经保存了订单
                        if (Array.isArray(res.data.data) && res.data.data.length > 0) {
                            console.log('后台已保存订单，直接使用已保存的数据，订单数量:', res.data.data.length);
                            this.orderItems = res.data.data;
                            // 保存到缓存（图片解析）
                            this._saveToStorage(this.orderItems, 'image');
                            // 重置搜索和匹配商品列表状态
                            this.resetSearchAndMatchedGoodsState();
                            alert('识别并保存完成！');
                            // 发出事件通知父组件刷新客户列表
                            this.$emit('order-saved');
                            return;
                        }

                        // 检查后端是否返回了 DeepSeek 解析后的商品列表
                        const items = res.data.items || (res.data.data && res.data.data.items);
                        const ocrText = res.data.ocrText || (res.data.data && res.data.data.ocrText) || '';

                        if (items && items.length > 0) {
                            // 将后端返回的 items 转换为订单格式（参考微信小程序实现）
                            const formattedOrders = items.map(item => ({
                                nxDoGoodsName: item.name || '',
                                nxDoGoodsNameOriginal: item.name || '', // 保存原始商品名称
                                nxDoQuantity: item.qty || '',
                                nxDoStandard: item.unit || '斤', // 默认单位
                                nxDoRemark: item.remark || '',
                                nxDoAddRemark: !!(item.remark && item.remark.trim()),
                                nxDoStatus: -2, // 未匹配状态
                                nxDoDepartmentId: targetDepId, // 使用确定的部门ID（可能是子部门ID）
                                nxDoDepartmentFatherId: this.selectedAllCustomer,
                                nxDoDisGoodsId: null,
                                nxDoStandardWarn: 0,
                                goodsNameWarn: 0,
                                nxDoDistributerId: this.disUser.nxDiuDistributerId,
                                nxDoPurchaseUserId: -1,
                                nxDoOrderUserId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId,
                                nxDoIsAgent: -1,
                            }));

                            // 过滤掉无效订单（商品名为空）
                            this.orderItems = formattedOrders.filter(order =>
                                order.nxDoGoodsName && order.nxDoGoodsName.trim()
                            );

                            // 保存到缓存（图片解析）
                            this._saveToStorage(this.orderItems, 'image');
                            // 重置搜索和匹配商品列表状态
                            this.resetSearchAndMatchedGoodsState();
                            alert('识别完成！');
                        } else {
                            alert('识别失败：未返回有效数据');
                        }
                    } else {
                        const errorMsg = res?.data?.msg || res?.data?.message || '识别失败';

                        // 处理不同类型的错误
                        if (errorMsg.includes('资源包耗尽') || errorMsg.includes('ResourcePackageRunOut')) {
                            alert('OCR 资源包已耗尽，请联系管理员购买资源包');
                        } else if (errorMsg.includes('服务未开通') || errorMsg.includes('UnOpenError')) {
                            alert('OCR 服务未开通，请联系管理员开通服务');
                        } else {
                            alert('识别失败：' + errorMsg);
                        }
                    }
                } catch (error) {

                    // 处理404错误（接口未实现）
                    if (error.response && error.response.status === 404) {
                        alert('OCR 接口未实现，请联系后端开发人员实现接口：POST /api/ocr/recognizeOrder');
                    } else {
                        alert('图片识别失败，请重试：' + (error.message || '未知错误'));
                    }
                } finally {
                    this.recognizingImage = false;
                    this.$store.commit('SET_LOADING', false);
                    // 不清空文件输入，保留以便重新识别
                }
            },

            // 切换裁剪模式
            toggleCropMode() {
                this.showCropMode = !this.showCropMode;
                if (this.showCropMode) {
                    // 初始化裁剪框位置和大小
                    this.$nextTick(() => {
                        // 优先使用弹窗中的图片元素
                        const imgElement = this.showImagePreviewModal ? this.$refs.previewImageModal : this.$refs.previewImage;
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
                }
            },

            // 开始拖拽裁剪框
            startCropDrag(event) {
                if (!this.showCropMode) return;
                
                // 获取图片容器（弹窗或主界面）
                const container = event.currentTarget.closest('.border.rounded');
                if (!container) return;
                
                const containerRect = container.getBoundingClientRect();
                const x = event.clientX - containerRect.left;
                const y = event.clientY - containerRect.top;
                
                // 检查是否点击在裁剪框内
                if (x >= this.cropBox.x && x <= this.cropBox.x + this.cropBox.width &&
                    y >= this.cropBox.y && y <= this.cropBox.y + this.cropBox.height) {
                    this.isDraggingCrop = true;
                    this.cropDragStart.x = x - this.cropBox.x;
                    this.cropDragStart.y = y - this.cropBox.y;
                    this.cropDragStart.containerRect = containerRect;
                }
            },

            // 拖拽裁剪框
            onCropDrag(event) {
                if (!this.showCropMode || (!this.isDraggingCrop && !this.isResizingCrop)) return;
                
                // 获取图片容器（弹窗或主界面）
                const container = event.currentTarget.closest('.border.rounded');
                if (!container) return;
                
                const containerRect = container.getBoundingClientRect();
                const x = event.clientX - containerRect.left;
                const y = event.clientY - containerRect.top;
                
                // 获取图片元素（弹窗或主界面）
                const imgElement = this.showImagePreviewModal ? this.$refs.previewImageModal : this.$refs.previewImage;
                if (!imgElement) return;
                
                const imgRect = imgElement.getBoundingClientRect();
                // 计算图片在容器中的相对位置
                const imgOffsetX = imgRect.left - containerRect.left;
                const imgOffsetY = imgRect.top - containerRect.top;
                const imgDisplayWidth = imgRect.width;
                const imgDisplayHeight = imgRect.height;
                
                if (this.isResizingCrop) {
                    // 调整裁剪框大小
                    const startRect = this.cropDragStart.containerRect || containerRect;
                    const startX = this.cropDragStart.x - startRect.left;
                    const startY = this.cropDragStart.y - startRect.top;
                    
                    // 计算相对于图片的坐标
                    const startRelativeX = startX - imgOffsetX;
                    const startRelativeY = startY - imgOffsetY;
                    const currentRelativeX = x - imgOffsetX;
                    const currentRelativeY = y - imgOffsetY;
                    
                    const deltaX = currentRelativeX - startRelativeX;
                    const deltaY = currentRelativeY - startRelativeY;
                    
                    let newWidth = this.cropDragStart.initialWidth;
                    let newHeight = this.cropDragStart.initialHeight;
                    let newX = this.cropDragStart.initialX;
                    let newY = this.cropDragStart.initialY;
                    
                    switch (this.cropResizeHandle) {
                        case 'nw':
                            newWidth = this.cropDragStart.initialWidth - deltaX;
                            newHeight = this.cropDragStart.initialHeight - deltaY;
                            newX = this.cropDragStart.initialX + deltaX;
                            newY = this.cropDragStart.initialY + deltaY;
                            break;
                        case 'ne':
                            newWidth = this.cropDragStart.initialWidth + deltaX;
                            newHeight = this.cropDragStart.initialHeight - deltaY;
                            newY = this.cropDragStart.initialY + deltaY;
                            break;
                        case 'sw':
                            newWidth = this.cropDragStart.initialWidth - deltaX;
                            newHeight = this.cropDragStart.initialHeight + deltaY;
                            newX = this.cropDragStart.initialX + deltaX;
                            break;
                        case 'se':
                            newWidth = this.cropDragStart.initialWidth + deltaX;
                            newHeight = this.cropDragStart.initialHeight + deltaY;
                            break;
                    }
                    
                    // 限制最小尺寸
                    newWidth = Math.max(50, newWidth);
                    newHeight = Math.max(50, newHeight);
                    
                    // 限制在图片范围内
                    if (newX < 0) {
                        newWidth += newX;
                        newX = 0;
                    }
                    if (newY < 0) {
                        newHeight += newY;
                        newY = 0;
                    }
                    if (newX + newWidth > imgDisplayWidth) {
                        newWidth = imgDisplayWidth - newX;
                    }
                    if (newY + newHeight > imgDisplayHeight) {
                        newHeight = imgDisplayHeight - newY;
                    }
                    
                    this.cropBox.width = newWidth;
                    this.cropBox.height = newHeight;
                    this.cropBox.x = newX;
                    this.cropBox.y = newY;
                } else if (this.isDraggingCrop) {
                    // 移动裁剪框
                    // 计算相对于图片的坐标（考虑图片在容器中的偏移）
                    const relativeX = x - imgOffsetX;
                    const relativeY = y - imgOffsetY;
                    
                    let newX = relativeX - this.cropDragStart.x;
                    let newY = relativeY - this.cropDragStart.y;
                    
                    // 限制在图片范围内
                    newX = Math.max(0, Math.min(newX, imgDisplayWidth - this.cropBox.width));
                    newY = Math.max(0, Math.min(newY, imgDisplayHeight - this.cropBox.height));
                    
                    this.cropBox.x = newX;
                    this.cropBox.y = newY;
                }
            },

            // 结束拖拽裁剪框
            endCropDrag() {
                this.isDraggingCrop = false;
                this.isResizingCrop = false;
            },

            // 开始调整裁剪框大小
            startCropResize(event, handle) {
                event.stopPropagation();
                event.preventDefault();
                this.isResizingCrop = true;
                this.isDraggingCrop = false; // 确保不是拖拽模式
                this.cropResizeHandle = handle;
                
                const container = event.currentTarget.closest('.border.rounded');
                if (!container) return;
                
                const containerRect = container.getBoundingClientRect();
                this.cropDragStart.x = event.clientX;
                this.cropDragStart.y = event.clientY;
                this.cropDragStart.containerRect = containerRect;
                this.cropDragStart.initialWidth = this.cropBox.width;
                this.cropDragStart.initialHeight = this.cropBox.height;
                this.cropDragStart.initialX = this.cropBox.x;
                this.cropDragStart.initialY = this.cropBox.y;
            },

            // 应用裁剪
            async applyCrop() {
                if (!this.imagePreview || !this.$refs.previewImage) {
                    alert('没有可裁剪的图片');
                    return;
                }

                try {
                    const imgElement = this.$refs.previewImage;
                    const imgRect = imgElement.getBoundingClientRect();
                    const container = imgElement.closest('.border.rounded');
                    const containerRect = container.getBoundingClientRect();
                    
                    // 计算裁剪区域在原始图片中的坐标
                    const scale = this.imageScale;
                    const imgNaturalWidth = imgElement.naturalWidth;
                    const imgNaturalHeight = imgElement.naturalHeight;
                    const imgDisplayWidth = imgRect.width;
                    const imgDisplayHeight = imgRect.height;
                    
                    // 计算缩放比例（显示尺寸 vs 原始尺寸）
                    const scaleX = imgNaturalWidth / imgDisplayWidth;
                    const scaleY = imgNaturalHeight / imgDisplayHeight;
                    
                    // 考虑图片的transform偏移
                    const offsetX = this.imageTranslateX;
                    const offsetY = this.imageTranslateY;
                    
                    // 计算裁剪区域在原始图片中的坐标和尺寸
                    const cropX = (this.cropBox.x - offsetX) * scaleX / scale;
                    const cropY = (this.cropBox.y - offsetY) * scaleY / scale;
                    const cropWidth = this.cropBox.width * scaleX / scale;
                    const cropHeight = this.cropBox.height * scaleY / scale;
                    
                    // 创建canvas进行裁剪
                    const canvas = document.createElement('canvas');
                    canvas.width = cropWidth;
                    canvas.height = cropHeight;
                    const ctx = canvas.getContext('2d');
                    
                    const img = new Image();
                    img.onload = () => {
                        ctx.drawImage(
                            img,
                            cropX, cropY, cropWidth, cropHeight,
                            0, 0, cropWidth, cropHeight
                        );
                        
                        // 转换为base64
                        const croppedDataUrl = canvas.toDataURL('image/png');
                        
                        // 更新预览
                        this.imagePreview = croppedDataUrl;
                        if (this.uploadedImageFile) {
                            this.uploadedImageFile.dataUrl = croppedDataUrl;
                        }
                        
                        // 重置变换
                        this.resetImageTransform();
                        
                        // 退出裁剪模式
                        this.showCropMode = false;
                        
                        // 自动执行OCR识别
                        this.recognizeImage(croppedDataUrl);
                    };
                    img.src = this.imagePreview;
                } catch (error) {
                    console.error('裁剪失败:', error);
                    alert('裁剪失败，请重试');
                }
            },

            // 取消裁剪
            cancelCrop() {
                this.showCropMode = false;
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
            },

            // AI识别优化文本（参考小程序 aiRecogniseFirst）
            async aiRecogniseFirst() {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                // 优先使用 pasteInputContent，因为用户修改输入框时更新的是 pasteInputContent
                // 如果没有 pasteInputContent，再使用 pasteInputText
                const content = this.pasteInputContent || this.pasteInputText;

                if (!content || content.trim() === '') {
                    alert('内容为空');
                    return;
                }

                console.log('开始第一次 AI 识别，输入内容:', content);

                this.showDeepSeekLoading = true;

                try {
                    const optimizedText = await this.optimizeTextWithDeepSeek(content, 0.2, []);
                    console.log('第一次 AI 识别完成，优化后内容:', optimizedText);

                    this.pasteInputText = optimizedText;
                    this.pasteInputContent = optimizedText;
                    this.pasteOriginText = content; // 保存原始内容用于再次识别

                    // 重新进行订单解析
                    this.parsePasteText();

                    alert('AI识别完成');
                } catch (error) {
                    console.error('第一次 AI 识别失败:', error);
                    alert('AI识别失败：' + (error.message || '未知错误'));
                } finally {
                    this.showDeepSeekLoading = false;
                }
            },

            // DeepSeek API 优化文本（参考小程序 optimizeTextWithDeepSeek）
            async optimizeTextWithDeepSeek(text, temperature = 0.2, brandList = []) {
                try {
                    console.log('开始调用 DeepSeek API，输入文本:', text, '温度:', temperature);

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
                                    content: `你是一个专业的餐饮行业订单解析助手。请将用户输入的语音识别文本转换为标准化的订单 JSON 数据。

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

请严格按照上述格式输出，只输出 JSON 数组，不要添加任何其他内容。`
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

            // 从剪贴板粘贴
            async pasteFromClipboard() {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                try {
                    const text = await navigator.clipboard.readText();
                    this.pasteInputText = text;
                    this.pasteInputContent = text;
                } catch (error) {
                    alert('无法读取剪贴板，请手动粘贴');
                }
            },

            // 解析粘贴文本为订单
            parsePasteText() {
                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

                if (!this.pasteInputText || !this.pasteInputText.trim()) {
                    alert('请输入或粘贴订单文本');
                    return;
                }

                if (!this.selectedAllCustomer) {
                    alert('请先选择客户');
                    return;
                }

                // 检查是否选择了子部门（如果有子部门的话）
                if (!this.checkSubDepartmentSelected()) {
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

                // 删除当前部门的缓存
                const storageKey = `ocrOrderDepList_paste`;
                try {
                    let ocrOrderDepList = [];
                    const ocrOrderDepListStr = localStorage.getItem(storageKey);
                    if (ocrOrderDepListStr) {
                        ocrOrderDepList = JSON.parse(ocrOrderDepListStr);
                        if (Array.isArray(ocrOrderDepList)) {
                            // 过滤掉当前部门的缓存
                            const filteredList = ocrOrderDepList.filter(item => {
                                const itemDepIdStr = String(item.depId);
                                const selectedDepIdStr = String(this.selectedAllCustomer);
                                return itemDepIdStr !== selectedDepIdStr;
                            });

                            // 如果过滤后没有数据了，删除整个缓存
                            if (filteredList.length === 0) {
                                localStorage.removeItem(storageKey);
                            } else {
                                // 保存更新后的缓存
                                localStorage.setItem(storageKey, JSON.stringify(filteredList));
                            }
                        }
                    }
                } catch (error) {
                }

                // 重置相关状态（清空文本内容和订单）
                this.pasteOrderItems = [];
                this.pasteInputText = '';
                this.pasteInputContent = '';
                this.pasteOriginText = ''; // 也清空原始文本
                this.pasteSaveCount = null;
                this.pasteHasCache = false;
                this.ocrOrderDepIndex = -1;

                // 重置搜索和匹配商品列表状态
                this.resetSearchAndMatchedGoodsState();

            },

            // ========== 文本解析为订单（复制粘贴模式专用）==========

            // 解析文本为订单（复制粘贴模式专用）
            parseTextToOrders(text, depId = null) {
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

                        // 转换为系统需要的格式
                        const formattedOrders = ordersJson.map(item => ({
                            nxDoGoodsName: item.name || '',
                            nxDoGoodsNameOriginal: item.name || '',
                            nxDoQuantity: item.qty || '',
                            nxDoStandard: item.unit || '斤',
                            nxDoRemark: item.remark || '',
                            nxDoAddRemark: !!(item.remark && item.remark.trim()),
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

                        // 过滤掉无效订单
                        const validOrders = formattedOrders.filter(order =>
                            order.nxDoGoodsName && order.nxDoGoodsName.trim()
                        );

                        console.log('[parseTextToOrders] 有效订单数量:', validOrders.length);

                        // 设置复制粘贴模式的订单列表
                        this.pasteOrderItems = validOrders;
                        // 注意：不设置 pasteHasCache，因为此时还没有保存缓存
                        // pasteHasCache 只在从缓存加载或保存缓存后设置为 true
                        this.pasteSaveCount = null; // 新解析的订单都是未保存的草稿，所以 saveCount 为 null

                        // 重置搜索和匹配商品列表状态
                        this.resetSearchAndMatchedGoodsState();

                        return;
                    }
                } catch (jsonError) {
                    alert("订单格式不正确！")
                    console.log('[parseTextToOrders] JSON 解析失败，使用正则解析:', jsonError.message);
                }

                // JSON 解析失败，使用正则解析
                const content = text
                    .replace(/(\d)\s+/g, '$1') // 处理数字后的空格
                    .replace(/[^\S\r\n]+/g, ' '); // 只替换水平空白，保留换行符

                const orders = this._formatOrderContent(content, targetDepId);

                // 设置复制粘贴模式的订单列表
                this.pasteOrderItems = orders;
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
                        alert('扫描文件夹失败：' + (result.error || '未知错误'));
                    }
                } catch (error) {
                    console.error('扫描文件夹失败:', error);
                    alert('扫描文件夹失败：' + error.message);
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
                if (!this.checkSubDepartmentSelected()) {
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

                    // 保存到缓存（转订单类型）
                    this._saveToStorage(this.orderItems, 'auto');

                    // 重置搜索和匹配商品列表状态
                    this.resetSearchAndMatchedGoodsState();

                    // 切换到显示订单列表（确保右侧显示订单）
                    console.log(`✅ 转订单完成，共处理 ${allProcessedOrders.length} 条订单`);
                }

                // 显示处理完成提示
                const successCount = this.autoProcessResults.filter(r => r.success).length;
                const failCount = this.autoProcessResults.length - successCount;
                const orderCount = allProcessedOrders.length;
                alert(`处理完成！成功：${successCount}，失败：${failCount}${orderCount > 0 ? `，共 ${orderCount} 条订单已显示在右侧` : ''}`);

                // 处理完成后，重新扫描文件夹（包括已处理文件夹），以便显示已处理的文件
                if (this.customerFolderPath) {
                    // 延迟一下，确保文件移动操作已完成
                    setTimeout(async () => {
                        try {
                            // 重新扫描文件夹（包括已处理文件夹）
                            const includeProcessed = true; // 强制包含已处理文件夹
                            const result = await window.electronAPI.scanFolderFiles(this.customerFolderPath, includeProcessed);

                            if (result.success) {
                                // 更新文件列表，标记已处理的文件
                                this.autoProcessFiles = result.files.map(file => {
                                    // 查找原文件列表中对应的文件，保留处理状态
                                    const existingFile = this.autoProcessFiles.find(f => f.filePath === file.filePath || f.fileName === file.fileName);
                                    if (existingFile && existingFile.status === 'success') {
                                        return {
                                            ...file,
                                            status: 'processed', // 标记为已处理
                                            progress: 100,
                                            orderCount: existingFile.orderCount || 0,
                                            error: null
                                        };
                                    }
                                    // 如果是新扫描到的已处理文件
                                    if (file.isProcessed) {
                                        return {
                                            ...file,
                                            status: 'processed',
                                            progress: 100,
                                            orderCount: 0,
                                            error: null
                                        };
                                    }
                                    // 其他文件保持待处理状态
                                    return {
                                        ...file,
                                        status: 'pending',
                                        progress: 0,
                                        orderCount: 0,
                                        error: null
                                    };
                                });

                                // 为已处理的图片文件加载完整图片预览
                                this.loadProcessedImagePreviews();

                                // 为已处理的Excel文件加载预览
                                this.loadProcessedExcelPreviews();

                                // 设置默认激活的标签（第一个已处理的文件）
                                const processedFiles = this.autoProcessFiles.filter(f => f.status === 'processed');
                                if (processedFiles.length > 0) {
                                    this.activeProcessedFileTab = processedFiles[0].filePath;
                                }
                            }
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
                        // 检查是否返回了已保存的订单
                        if (Array.isArray(res.data.data) && res.data.data.length > 0) {
                            // 转换为订单格式（参考 handleExcelUpload）
                            const orders = res.data.data.map(item => ({
                                nxDoGoodsName: item.goodsName || item.nxDoGoodsName || '',
                                nxDoGoodsNameOriginal: item.goodsName || item.nxDoGoodsName || '',
                                nxDoQuantity: item.quantity || item.nxDoQuantity || '',
                                nxDoStandard: item.standard || item.nxDoStandard || '斤',
                                nxDoRemark: item.remark || item.nxDoRemark || '',
                                nxDoAddRemark: !!(item.remark || item.nxDoRemark),
                                nxDoStatus: item.status !== undefined ? item.status : (item.nxDoStatus !== undefined ? item.nxDoStatus : -2),
                                nxDoDepartmentId: targetDepId,
                                nxDoDepartmentFatherId: this.selectedAllCustomer,
                                nxDoDisGoodsId: item.disGoodsId || item.nxDoDisGoodsId || null,
                                nxDoStandardWarn: 0,
                                goodsNameWarn: 0,
                                nxDoDistributerId: this.disUser.nxDiuDistributerId,
                                nxDoPurchaseUserId: -1,
                                nxDoOrderUserId: this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1,
                                nxDoIsAgent: -1,
                                nxDepartmentOrdersId: item.orderId || item.nxDepartmentOrdersId || null,
                                nxDistributerGoodsEntityList: item.matchedGoods || item.nxDistributerGoodsEntityList || [],
                                nxGoodsEntities: item.matchedGoods || item.nxGoodsEntities || []
                            }));

                            return {
                                orderCount: orders.length,
                                orders: orders
                            };
                        } else if (Array.isArray(res.data.items) && res.data.items.length > 0) {
                            // 转换为订单格式（仅解析，未保存）
                            const orders = res.data.items.map(item => ({
                                nxDoGoodsName: item.name || '',
                                nxDoGoodsNameOriginal: item.name || '',
                                nxDoQuantity: item.qty || '',
                                nxDoStandard: item.unit || '斤',
                                nxDoRemark: item.remark || '',
                                nxDoAddRemark: !!(item.remark && item.remark.trim()),
                                nxDoStatus: -2, // 未保存的草稿
                                nxDoDepartmentId: targetDepId,
                                nxDoDepartmentFatherId: this.selectedAllCustomer,
                                nxDoDisGoodsId: null,
                                nxDoStandardWarn: 0,
                                goodsNameWarn: 0,
                                nxDoDistributerId: this.disUser.nxDiuDistributerId,
                                nxDoPurchaseUserId: -1,
                                nxDoOrderUserId: this.disUser.nxDepartmentUserId || this.disUser.nxDistributerUserId || -1,
                                nxDoIsAgent: -1
                            }));

                            return {
                                orderCount: orders.length,
                                orders: orders
                            };
                        } else {
                            throw new Error('Excel文件中没有可读取的数据');
                        }
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
                    if (Array.isArray(res.data.data) && res.data.data.length > 0) {
                        // 已保存的订单，直接返回
                        return {
                            orderCount: res.data.data.length,
                            orders: res.data.data
                        };
                    } else {
                        // 检查是否有解析的商品列表
                        const items = res.data.items || (res.data.data && res.data.data.items);
                        if (items && items.length > 0) {
                            // 转换为订单格式（参考 handleImageUpload）
                            const orders = items.map(item => ({
                                nxDoGoodsName: item.name || '',
                                nxDoGoodsNameOriginal: item.name || '',
                                nxDoQuantity: item.qty || '',
                                nxDoStandard: item.unit || '斤',
                                nxDoRemark: item.remark || '',
                                nxDoAddRemark: !!(item.remark && item.remark.trim()),
                                nxDoStatus: -2, // 未匹配状态
                                nxDoDepartmentId: targetDepId,
                                nxDoDepartmentFatherId: this.selectedAllCustomer,
                                nxDoDisGoodsId: null,
                                nxDoStandardWarn: 0,
                                goodsNameWarn: 0,
                                nxDoDistributerId: this.disUser.nxDiuDistributerId,
                                nxDoPurchaseUserId: -1,
                                nxDoOrderUserId: this.disUser.nxDistributerUserId || this.disUser.nxDiuDistributerId,
                                nxDoIsAgent: -1,
                            })).filter(order => order.nxDoGoodsName && order.nxDoGoodsName.trim());

                            return {
                                orderCount: orders.length,
                                orders: orders
                            };
                        } else {
                            throw new Error('图片中未识别到订单信息');
                        }
                    }
                } else {
                    const errorMsg = res?.data?.msg || res?.data?.message || '识别失败';
                    throw new Error(errorMsg);
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
                    alert('Electron API 不可用');
                    return;
                }

                if (typeof window.electronAPI.openFile !== 'function') {
                    alert('openFile API 不可用，请重启应用');
                    return;
                }

                try {
                    const result = await window.electronAPI.openFile(filePath, this.customerFolderPath);
                    if (!result.success) {
                        alert('打开文件失败：' + (result.error || '未知错误'));
                    }
                } catch (error) {
                    console.error('打开文件失败:', error);
                    alert('打开文件失败：' + error.message);
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
                    alert('Electron API 不可用');
                    return;
                }

                if (typeof window.electronAPI.readFile !== 'function') {
                    alert('readFile API 不可用，请重启应用');
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
                        alert('无法读取图片文件，文件可能已被移动或删除');
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



                    // 等待下一帧，确保DOM更新
                    // this.$nextTick(() => {
                    //     console.log('🖼️ [previewAutoProcessImage] DOM更新后检查:', {
                    //         previewElement: document.querySelector('.card-body[style*="min-height: 400px"]'),
                    //         imageElement: document.querySelector('img[src*="' + imageBase64.substring(0, 30) + '"]')
                    //     });
                    // });
                    //
                    // // 图片加载完成后，记录图片尺寸信息
                    // this.$nextTick(() => {
                    //     const img = new Image();
                    //     img.onload = () => {
                    //         console.log('🖼️ [previewAutoProcessImage] 图片加载完成，尺寸信息:', {
                    //             fileName: file.fileName,
                    //             filePath: file.filePath,
                    //             naturalWidth: img.naturalWidth,
                    //             naturalHeight: img.naturalHeight,
                    //             imageScale: this.imageScale,
                    //             imageTranslateX: this.imageTranslateX,
                    //             imageTranslateY: this.imageTranslateY,
                    //             computedWidth: img.naturalWidth * this.imageScale,
                    //             computedHeight: img.naturalHeight * this.imageScale
                    //         });
                    //
                    //         // 检查容器尺寸
                    //         this.$nextTick(() => {
                    //             const imgElement = document.querySelector('img[src="' + imageBase64 + '"]');
                    //             if (imgElement) {
                    //                 const container = imgElement.closest('.card-body');
                    //                 if (container) {
                    //                     const containerRect = container.getBoundingClientRect();
                    //                     const imgRect = imgElement.getBoundingClientRect();
                    //                 }
                    //             }
                    //         });
                    //     };
                    //     img.src = imageBase64;
                    // });

                } catch (error) {
                    alert('预览图片失败：' + error.message);
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
</style>
