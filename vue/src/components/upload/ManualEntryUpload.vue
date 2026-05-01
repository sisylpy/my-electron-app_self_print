<template>
    <div class="upload-section" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <div class="row g-3" style="flex: 1; min-height: 0; overflow: hidden; margin: 0; align-items: stretch;">
            <!-- 左侧：参考区（复制文字 / 图片） -->
            <div class="col-md-4">
                <div class="card h-100">
                    <div class="card-header py-2 px-2 d-flex gap-1" style="flex-shrink: 0;">
                        <button type="button" class="btn btn-sm"
                                :class="refTab === 'text' ? 'btn-primary' : 'btn-outline-secondary'"
                                @click="refTab = 'text'">复制文字</button>
                        <button type="button" class="btn btn-sm"
                                :class="refTab === 'image' ? 'btn-primary' : 'btn-outline-secondary'"
                                @click="refTab = 'image'">图片</button>
                    </div>
                    <div class="card-body p-2" style="display: flex; flex-direction: column; min-height: 0; flex: 1;">
                        <!-- 复制文字参考 -->
                        <div v-show="refTab === 'text'" style="flex: 1; min-height: 120px; display: flex; flex-direction: column;">
                            <textarea
                                    :value="refText"
                                    @input="$emit('ref-text-input', $event.target.value)"
                                    class="form-control flex-grow-1 ref-textarea"
                                    placeholder="粘贴订单文字内容"
                                    style="font-size: 22px; min-height: 100px; resize: none;"
                            ></textarea>
                            <button class="btn btn-sm btn-outline-secondary mt-2" @click="$emit('clear-ref-text')">
                                清除文字
                            </button>
                        </div>
                        <!-- 图片参考 -->
                        <div v-show="refTab === 'image'" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
                            <div v-if="!refImageDataUrl" class="drop-zone border rounded p-3 text-center flex-grow-1 d-flex flex-column align-items-center justify-content-center"
                                 :class="{ 'drag-over': isRefImageDragOver }"
                                 style="background-color: #f8f9fa; cursor: pointer; transition: all 0.3s;"
                                 @dragover.prevent="handleRefImageDragOver"
                                 @dragenter.prevent="handleRefImageDragEnter"
                                 @dragleave.prevent="handleRefImageDragLeave"
                                 @drop.prevent="handleRefImageDrop"
                                 @click="$refs.refImageInput?.click()"
                                 tabindex="0">
                                <input type="file" ref="refImageInput" accept="image/*" class="d-none"
                                       @change="onRefImageChange"/>
                                <small class="text-muted">点击选择、拖放或粘贴图片</small>
                                <small class="text-primary mt-1">💡 可从微信拖放图片，或复制图片后 Ctrl+V 粘贴</small>
                            </div>
                            <div v-else class="position-relative border rounded overflow-hidden"
                                 style="flex: 1; min-height: 0; display: flex; flex-direction: column; cursor: move; background-color: #f5f5f5;"
                                 @mousedown="refImageStartDrag"
                                 @mousemove="refImageOnDrag"
                                 @mouseup="refImageEndDrag"
                                 @mouseleave="refImageEndDrag"
                                 @wheel.prevent="refImageHandleWheel">
                                <div class="position-absolute top-0 end-0 m-1 d-flex gap-1" style="z-index: 10;">
                                    <button class="btn btn-sm btn-outline-secondary"
                                            @click.stop="refImageReset"
                                            @mousedown.stop
                                            title="重置">🔄</button>
                                    <button class="btn btn-sm btn-outline-secondary"
                                            @click.stop="refImageZoomIn"
                                            @mousedown.stop
                                            title="放大">➕</button>
                                    <button class="btn btn-sm btn-outline-secondary"
                                            @click.stop="refImageZoomOut"
                                            @mousedown.stop
                                            title="缩小">➖</button>
                                    <button class="btn btn-sm btn-outline-danger"
                                            @click.stop="$emit('clear-ref-image')"
                                            @mousedown.stop>清除</button>
                                </div>
                                <div class="d-flex align-items-start justify-content-start flex-grow-1 overflow-hidden"
                                     style="transform-origin: top left; position: relative;">
                                    <img :src="refImageDataUrl" alt="参考" class="rounded ref-image-fill"
                                         :style="{
                                             transform: `translate(${refImageTranslateX}px, ${refImageTranslateY}px) scale(${refImageScale})`,
                                             transition: isRefImageDragging ? 'none' : 'transform 0.1s',
                                             cursor: isRefImageDragging ? 'grabbing' : 'grab',
                                             maxWidth: '100%',
                                             maxHeight: '100%',
                                             objectFit: 'contain',
                                             display: 'block'
                                         }"/>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 右侧：录入区 -->
            <div class="col-md-8 order-items-section"
                 style="display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden;">
                <div class="card h-100 p-2"
                     style="display: flex; flex-direction: column; min-height: 0; overflow: hidden;">
                    <div class="d-flex justify-content-between align-items-center mb-2" style="flex-shrink: 0;">
                        <h6 class="mb-0">手动录入订单</h6>
                    </div>
                    <!-- 录入表格（已保存订单显示在第一行，录入行从第二行开始） -->
                    <div class="flex-grow-1" style="min-height: 0; overflow-y: auto;">
                        <div v-if="!depId" class="alert alert-warning py-2 small mb-2">请先选择客户</div>
                        <div class="small text-muted mb-1">快速录入：商品名回车搜索→↑↓选择商品→数量→规格回车保存</div>
                        <table class="table table-sm table-bordered mb-0" style="font-size: 18px;">
                            <thead class="table-light">
                            <tr>
                                <th style="width: 5%;">序号</th>
                                <th style="width: 40%;">商品名称</th>
                                <th style="width: 10%;">数量</th>
                                <th style="width: 10%;">规格</th>
                                <th style="width: 15%;">备注</th>
                                <th style="width: 20%;">操作</th>
                            </tr>
                            </thead>
                            <tbody>
                            <!-- 已保存订单（只读，最新在前，显示在第一行） -->
                            <template v-for="(item, idx) in sortedOrderItemsForDisplay" :key="item.nxDepartmentOrdersId || idx">
                            <!-- 向上插入表单（表格行布局，与正常录入一致） -->
                            <tr v-if="addingOrderBeforeIndex === orderItemsIndexOf(item)" class="table-warning"
                                :ref="el => { if (el) beforeOrderRowRef = el }">
                                <td class="p-1 text-center" style="width: 5%;">{{ idx + 1 }}</td>
                                <td class="p-1 position-relative" style="width: 40%;">
                                    <div class="d-flex align-items-center gap-1" style="min-width: 0;">
                                        <input type="text" class="form-control form-control-sm flex-grow-1"
                                               spellcheck="false"
                                               style="font-size: 22px; min-width: 0; background-color: #fff;"
                                               :value="beforeOrderForm.goodsName"
                                               @focus="scrollInputIntoView"
                                               @input="$emit('before-order-goods-name-input', $event.target.value)"
                                               @keydown="onBeforeOrderGoodsNameKeydown($event, item)"
                                               @keydown.tab="onBeforeOrderTab($event, 'goods-name', item)"
                                               data-input-type="goods-name"
                                        />
                                        <span v-if="beforeOrderForm.selectedGoods && getCartonDisplay(beforeOrderForm.selectedGoods)"
                                              class="text-muted flex-shrink-0 small"
                                              style="font-size: 16px; white-space: nowrap;">{{ getCartonDisplay(beforeOrderForm.selectedGoods) }}</span>
                                    </div>
                                    <!-- 搜索结果下拉 -->
                                    <div v-if="beforeOrderForm.showSearchResults && (beforeOrderForm.disArr?.length > 0 || beforeOrderForm.nxArr?.length > 0)"
                                         :ref="el => { if (el) beforeOrderSearchRef = el }"
                                         class="border rounded shadow-sm bg-white position-absolute mt-1"
                                         style="max-height: 240px; overflow-y: auto; z-index: 1000; left: 0; right: 0; font-size: 16px;">
                                        <div v-for="(g, gi) in (beforeOrderForm.disArr || [])" :key="'d'+gi"
                                             class="p-2 border-bottom"
                                             :data-search-index="gi"
                                             style="cursor: pointer;"
                                             :class="{ 'bg-primary bg-opacity-10': beforeOrderForm.selectedSearchIndex === gi }"
                                             @click="$emit('select-before-order-goods', g)">
                                            <div>
                                                <span class="text-muted fw-bold me-2" style="color: #666;">{{ gi + 1 }}.</span>
                                                <span v-if="disUser?.nxDiuDistributerId != null && g.nxDgDistributerId != null && g.nxDgDistributerId !== disUser.nxDiuDistributerId && g.goodsNxDistributerName"
                                                      class="font-xs text-primary me-1">[{{ g.goodsNxDistributerName }}]</span>
                                                <span v-if="g.nxDgGoodsBrand && g.nxDgGoodsBrand !== 'null'"
                                                      class="badge bg-warning text-dark me-1">{{ g.nxDgGoodsBrand }}</span>
                                                <span class="text-dark">{{ g.nxDgGoodsName }}</span>
                                                <span class="text-muted ms-1"
                                                      v-if="g.nxDgItemsPerCarton && g.nxDgItemsPerCarton !== 'null'">
                                                    ({{ (g.nxDgGoodsStandardWeight || '') + '/' + (g.nxDgGoodsStandardname || '') + '*' + g.nxDgItemsPerCarton + '/' + (g.nxDgCartonUnit || '') }})
                                                </span>
                                                <span v-else class="text-muted ms-1">
                                                    <span v-if="g.nxDgGoodsStandardWeight && g.nxDgGoodsStandardWeight !== 'null'">
                                                        ({{ g.nxDgGoodsStandardWeight }}/{{ g.nxDgGoodsStandardname || '' }})
                                                    </span>
                                                    <span v-else>({{ g.nxDgGoodsStandardname || '' }})</span>
                                                </span>
                                            </div>
                                            <div v-if="g.departmentDisGoodsEntity != null" class="mt-2 d-flex"
                                                 style="font-size: 15px; padding-left: 24px; gap: 20px; flex-wrap: nowrap;">
                                                <span style="white-space: nowrap;">
                                                    <span>上次订货:</span>
                                                    <span>{{ g.departmentDisGoodsEntity.nxDdgOrderDate }}</span>
                                                </span>
                                                <span style="white-space: nowrap;">
                                                    <span>单价:</span>
                                                    <span>{{ g.departmentDisGoodsEntity.nxDdgOrderPrice }}/{{ g.nxDgGoodsStandardname }}</span>
                                                </span>
                                                <span style="white-space: nowrap;">
                                                    <span>订货:</span>
                                                    <span>{{ g.departmentDisGoodsEntity.nxDdgOrderQuantity }}</span>
                                                    <span v-if="g.departmentDisGoodsEntity.nxDdgOrderStandard">{{ g.departmentDisGoodsEntity.nxDdgOrderStandard }}</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div v-for="(g, gi) in (beforeOrderForm.nxArr || [])" :key="'n'+gi"
                                             class="p-2 border-bottom d-flex align-items-center justify-content-between"
                                             :data-search-index="(beforeOrderForm.disArr?.length || 0) + gi"
                                             style="cursor: pointer;"
                                             :class="{ 'bg-primary bg-opacity-10': beforeOrderForm.selectedSearchIndex === (beforeOrderForm.disArr?.length || 0) + gi }"
                                             @click="$emit('download-goods-nx', { goods: g, orderIndex: orderItemsIndexOf(item) })">
                                            <div class="flex-grow-1" style="min-width: 0;">
                                                <span class="text-muted me-1">{{ (beforeOrderForm.disArr?.length || 0) + gi + 1 }}.</span>
                                                <span v-if="g.nxGoodsBrand && g.nxGoodsBrand !== 'null'"
                                                      class="badge bg-warning text-dark me-1">{{ g.nxGoodsBrand }}</span>
                                                <span>{{ g.nxGoodsName }}</span>
                                                <span class="text-muted ms-1"
                                                      v-if="g.nxGoodsItemsPerCarton && g.nxGoodsItemsPerCarton !== 'null'">
                                                    ({{ (g.nxGoodsStandardWeight || '') + '/' + (g.nxGoodsStandardname || '') + '*' + g.nxGoodsItemsPerCarton + '/' + (g.nxGoodsCartonUnit || '') }})
                                                </span>
                                                <span v-else class="text-muted ms-1">
                                                    <span v-if="g.nxGoodsStandardWeight && g.nxGoodsStandardWeight !== 'null'">
                                                        ({{ g.nxGoodsStandardWeight }}/{{ g.nxGoodsStandardname || '' }})
                                                    </span>
                                                    <span v-else>({{ g.nxGoodsStandardname || '' }})</span>
                                                </span>
                                            </div>
                                            <button class="btn btn-info btn-sm flex-shrink-0"
                                                    @click.stop="$emit('download-goods-nx', { goods: g, orderIndex: orderItemsIndexOf(item) })"
                                                    style="min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                                    title="下载商品">⬇️</button>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-1" style="width: 10%;">
                                    <input type="text" class="form-control form-control-sm"
                                           spellcheck="false"
                                           style="font-size: 22px; background-color: #fff;"
                                           :value="beforeOrderForm.quantity"
                                           @focus="scrollInputIntoView"
                                           @input="$emit('before-order-quantity-input', $event.target.value)"
                                           @keydown.enter="onBeforeOrderQuantityEnter($event, item)"
                                           @keydown.tab="onBeforeOrderTab($event, 'quantity', item)"
                                           data-input-type="quantity"
                                    />
                                </td>
                                <td class="p-1" style="width: 10%;">
                                    <input type="text" class="form-control form-control-sm"
                                           spellcheck="false"
                                           style="font-size: 22px; background-color: #fff;"
                                           :value="beforeOrderForm.standard"
                                           @focus="scrollInputIntoView"
                                           @input="$emit('before-order-standard-input', $event.target.value)"
                                           @keydown.enter="onBeforeOrderStandardEnter($event, item)"
                                           @keydown.tab="onBeforeOrderTab($event, 'standard', item)"
                                           data-input-type="standard"
                                    />
                                </td>
                                <td class="p-1" style="width: 15%;">
                                    <input type="text" class="form-control form-control-sm"
                                           spellcheck="false"
                                           style="font-size: 22px; background-color: #fff;"
                                           :value="beforeOrderForm.remark"
                                           @focus="scrollInputIntoView"
                                           @input="$emit('before-order-remark-input', $event.target.value)"
                                           @keydown.tab="onBeforeOrderTab($event, 'remark', item)"
                                           data-input-type="remark"
                                    />
                                </td>
                                <td class="p-1" style="width: 20%;">
                                    <div class="d-flex gap-3 flex-wrap" style=" padding: 5px;">
                                        <span class="manual-entry-action-btn" @click="$emit('cancel-add-order-before')" title="取消">✕</span>
                                        <button v-if="String(beforeOrderForm.goodsName || '').length > 0"
                                                class="btn btn-sm"
                                                :disabled="!canAddBeforeOrder(beforeOrderForm)"
                                                :style="!canAddBeforeOrder(beforeOrderForm) ? 'font-size: 14px; padding: 4px 8px; background-color: transparent !important; border: none; color: #adb5bd; cursor: not-allowed;' : 'font-size: 14px; padding: 4px 8px; background-color: transparent !important; border: none; color: #6c757d; transition: all 0.2s;'"
                                                @click="beforeOrderForm.selectedGoods ? $emit('save-before-order', { item, orderIndex: orderItemsIndexOf(item) }) : $emit('save-new-goods-from-before-order', { item, orderIndex: orderItemsIndexOf(item) })"
                                                :title="beforeOrderForm.selectedGoods ? '保存订单' : '保存新商品'"
                                                @mouseenter="canAddBeforeOrder(beforeOrderForm) ? $event.target.style.color='#495057' : null"
                                                @mouseleave="canAddBeforeOrder(beforeOrderForm) ? $event.target.style.color='#6c757d' : null">
                                            💾
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr class="table-light">
                                <td class="p-1 text-center" style="width: 5%;">{{ idx + 1 }}</td>
                                <td class="p-1" style="width: 40%;">
                                    {{ item.nxDoGoodsName }}<span v-if="getOrderItemCartonDisplay(item)" class="text-muted"> {{ getOrderItemCartonDisplay(item) }}</span>
                                </td>
                                <td class="p-1" style="width: 10%;">{{ item.nxDoQuantity }}</td>
                                <td class="p-1" style="width: 10%;">{{ item.nxDoStandard || item.nxDoPrintStandard }}</td>
                                <td class="p-1" style="width: 15%;">{{ item.nxDoRemark || '' }}</td>
                                <td class="p-1 text-center" style="width: 20%;">
                                    <div class="d-flex gap-1 flex-wrap justify-content-center">
                                        <span class="manual-entry-action-btn"
                                        @click="$emit('update-order', { item, orderIndex: orderItemsIndexOf(item) })"
                                                title="修改"> ✏️</span>
                                        <span class="manual-entry-action-btn"
                                                @click="$emit('add-order-before', { item, orderIndex: orderItemsIndexOf(item) })"
                                                title="向上插入">⬆️</span>
                                    </div>
                                </td>
                            </tr>
                            </template>
                            <!-- 录入行（从第二行开始） -->
                            <tr v-for="(row, rowIndex) in manualRows" :key="'entry-' + rowIndex"
                                :ref="el => { if (el) rowRefs[rowIndex] = el }">
                                <td class="p-1 text-center" style="width: 5%;"></td>
                                <td class="p-1 position-relative">
                                    <div class="d-flex align-items-center gap-1" style="min-width: 0;">
                                        <input type="text" class="form-control form-control-sm flex-grow-1"
                                               spellcheck="false"
                                               style="font-size: 22px; min-width: 0;"
                                               :value="row.goodsName"
                                               @focus="scrollInputIntoView"
                                               @input="onRowGoodsNameInput($event, rowIndex)"
                                               @keydown="onRowGoodsNameKeydown($event, rowIndex)"
                                               @keydown.tab="onRowTab($event, rowIndex, 'goods-name')"
                                               :data-row-index="rowIndex"
                                               data-input-type="goods-name"
                                        />
                                        <span v-if="row.selectedGoods && getCartonDisplay(row.selectedGoods)"
                                              class="text-muted flex-shrink-0 small"
                                              style="font-size: 16px; white-space: nowrap;">{{ getCartonDisplay(row.selectedGoods) }}</span>
                                    </div>
                                    <!-- 搜索结果下拉 -->
                                    <div v-if="row.showSearchResults && (row.disArr?.length > 0 || row.nxArr?.length > 0)"
                                         :ref="el => { if (el) searchDropdownRefs[rowIndex] = el }"
                                         class="border rounded shadow-sm bg-white position-absolute mt-1"
                                         style="max-height: 240px; overflow-y: auto; z-index: 1000; left: 0; right: 0; font-size: 16px;">
                                        <div v-for="(g, gi) in (row.disArr || [])" :key="'d'+gi"
                                             class="p-2 border-bottom"
                                             :data-search-index="gi"
                                             style="cursor: pointer;"
                                             :class="{ 'bg-primary bg-opacity-10': row.selectedSearchIndex === gi }"
                                             @click="onSelectGoods(rowIndex, g, 'dis')">
                                            <div>
                                                <span class="text-muted fw-bold me-2" style="color: #666;">{{ gi + 1 }}.</span>
                                                <span v-if="disUser?.nxDiuDistributerId != null && g.nxDgDistributerId != null && g.nxDgDistributerId !== disUser.nxDiuDistributerId && g.goodsNxDistributerName"
                                                      class="font-xs text-primary me-1">[{{ g.goodsNxDistributerName }}]</span>
                                                <span v-if="g.nxDgGoodsBrand && g.nxDgGoodsBrand !== 'null'"
                                                      class="badge bg-warning text-dark me-1">{{ g.nxDgGoodsBrand }}</span>
                                                <span class="text-dark">{{ g.nxDgGoodsName }}</span>
                                                <span class="text-muted ms-1"
                                                      v-if="g.nxDgItemsPerCarton && g.nxDgItemsPerCarton !== 'null'">
                                                    ({{ (g.nxDgGoodsStandardWeight || '') + '/' + (g.nxDgGoodsStandardname || '') + '*' + g.nxDgItemsPerCarton + '/' + (g.nxDgCartonUnit || '') }})
                                                </span>
                                                <span v-else class="text-muted ms-1">
                                                    <span v-if="g.nxDgGoodsStandardWeight && g.nxDgGoodsStandardWeight !== 'null'">
                                                        ({{ g.nxDgGoodsStandardWeight }}/{{ g.nxDgGoodsStandardname || '' }})
                                                    </span>
                                                    <span v-else>({{ g.nxDgGoodsStandardname || '' }})</span>
                                                </span>
                                            </div>
                                            <div v-if="g.departmentDisGoodsEntity != null" class="mt-2 d-flex"
                                                 style="font-size: 15px; padding-left: 24px; gap: 20px; flex-wrap: nowrap;">
                                                <span style="white-space: nowrap;">
                                                    <span>上次订货:</span>
                                                    <span>{{ g.departmentDisGoodsEntity.nxDdgOrderDate }}</span>
                                                </span>
                                                <span style="white-space: nowrap;">
                                                    <span>单价:</span>
                                                    <span>{{ g.departmentDisGoodsEntity.nxDdgOrderPrice }}/{{ g.nxDgGoodsStandardname }}</span>
                                                </span>
                                                <span style="white-space: nowrap;">
                                                    <span>订货:</span>
                                                    <span>{{ g.departmentDisGoodsEntity.nxDdgOrderQuantity }}</span>
                                                    <span v-if="g.departmentDisGoodsEntity.nxDdgOrderStandard">{{ g.departmentDisGoodsEntity.nxDdgOrderStandard }}</span>
                                                </span>
                                            </div>
                                        </div>
                                        <div v-for="(g, gi) in (row.nxArr || [])" :key="'n'+gi"
                                             class="p-2 border-bottom d-flex align-items-center justify-content-between"
                                             :data-search-index="(row.disArr?.length || 0) + gi"
                                             style="cursor: pointer;"
                                             :class="{ 'bg-primary bg-opacity-10': row.selectedSearchIndex === (row.disArr?.length || 0) + gi }"
                                             @click="onDownloadNxGoods(rowIndex, g)">
                                            <div class="flex-grow-1" style="min-width: 0;">
                                                <span class="text-muted me-1">{{ (row.disArr?.length || 0) + gi + 1 }}.</span>
                                                <span v-if="g.nxGoodsBrand && g.nxGoodsBrand !== 'null'"
                                                      class="badge bg-warning text-dark me-1">{{ g.nxGoodsBrand }}</span>
                                                <span>{{ g.nxGoodsName }}</span>
                                                <span class="text-muted ms-1"
                                                      v-if="g.nxGoodsItemsPerCarton && g.nxGoodsItemsPerCarton !== 'null'">
                                                    ({{ (g.nxGoodsStandardWeight || '') + '/' + (g.nxGoodsStandardname || '') + '*' + g.nxGoodsItemsPerCarton + '/' + (g.nxGoodsCartonUnit || '') }})
                                                </span>
                                                <span v-else class="text-muted ms-1">
                                                    <span v-if="g.nxGoodsStandardWeight && g.nxGoodsStandardWeight !== 'null'">
                                                        ({{ g.nxGoodsStandardWeight }}/{{ g.nxGoodsStandardname || '' }})
                                                    </span>
                                                    <span v-else>({{ g.nxGoodsStandardname || '' }})</span>
                                                </span>
                                            </div>
                                            <button class="btn btn-info btn-sm flex-shrink-0"
                                                    @click.stop="onDownloadNxGoods(rowIndex, g)"
                                                    style="min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                                    title="下载商品">⬇️</button>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-1">
                                    <input type="text" class="form-control form-control-sm"
                                           spellcheck="false"
                                           style="font-size: 22px;"
                                           :value="row.quantity"
                                           @focus="scrollInputIntoView"
                                           @input="row.quantity = $event.target.value"
                                           @keydown.enter="onRowQuantityEnter($event, rowIndex)"
                                           @keydown.tab="onRowTab($event, rowIndex, 'quantity')"
                                           data-input-type="quantity"
                                    />
                                </td>
                                <td class="p-1">
                                    <input type="text" class="form-control form-control-sm"
                                           spellcheck="false"
                                           style="font-size: 22px;"
                                           :value="row.standard"
                                           @focus="scrollInputIntoView"
                                           @input="onRowStandardInput($event.target.value, rowIndex)"
                                           @keydown.enter="onRowStandardEnter($event, rowIndex)"
                                           @keydown.tab="onRowTab($event, rowIndex, 'standard')"
                                           data-input-type="standard"
                                    />
                                </td>
                                <td class="p-1">
                                    <input type="text" class="form-control form-control-sm"
                                           spellcheck="false"
                                           style="font-size: 22px;"
                                           :value="row.remark"
                                           @focus="scrollInputIntoView"
                                           @input="row.remark = $event.target.value"
                                           @keydown.enter="onRowRemarkEnter($event, rowIndex)"
                                           @keydown.tab="onRowTab($event, rowIndex, 'remark')"
                                           data-input-type="remark"
                                    />
                                </td>
                                <td class="p-1">
                                    <button v-if="String(row.goodsName || '').length > 0"
                                            class="btn btn-sm"
                                            :disabled="!canAddOrder(row)"
                                            :style="!canAddOrder(row) ? 'font-size: 14px; padding: 4px 8px; background-color: transparent !important; border: none; color: #adb5bd; cursor: not-allowed;' : 'font-size: 14px; padding: 4px 8px; background-color: transparent !important; border: none; color: #6c757d; transition: all 0.2s;'"
                                            @click="onSaveOrderClick(rowIndex, row)"
                                            :title="addOrderButtonTitle(row)"
                                            @mouseenter="canAddOrder(row) ? $event.target.style.color='#495057' : null"
                                            @mouseleave="canAddOrder(row) ? $event.target.style.color='#6c757d' : null">
<!--                                        {{ addOrderButtonText(row) }}--> 💾
                                    </button>
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
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
</template>

<script>
    import api from '../../api/all';
    import Toast from '../Toast.vue';

    export default {
        name: 'ManualEntryUpload',
        components: {
            Toast
        },
        props: {
            refText: { type: String, default: '' },
            refImageDataUrl: { type: String, default: null },
            orderItems: { type: Array, default: () => [] },
            depId: { type: [Number, String], default: null },
            disUser: { type: Object, default: null },
            savingOrder: { type: Boolean, default: false },
            addingOrderBeforeIndex: { type: Number, default: -1 },
            beforeOrderForm: { type: Object, default: () => ({}) }
        },
        emits: [
            'ref-text-input', 'clear-ref-text', 'ref-image-upload', 'clear-ref-image',
            'manual-save-order', 'save-new-goods', 'update-order', 'add-order-before',
            'cancel-add-order-before', 'before-order-goods-name-input', 'select-before-order-goods',
            'close-before-order-search-results', 'before-order-quantity-input', 'before-order-standard-input',
            'before-order-remark-input', 'save-before-order', 'save-new-goods-from-before-order', 'download-goods-nx',
            'before-order-goods-name-enter', 'before-order-goods-name-keydown'
        ],
        data() {
            return {
                refTab: 'text',
                manualRows: this.initRows(8),
                rowRefs: {},
                searchDropdownRefs: {},
                beforeOrderRowRef: null,
                beforeOrderSearchRef: null,
                isRefImageDragOver: false,
                // 参考图片缩放/平移
                refImageScale: 1,
                refImageTranslateX: 0,
                refImageTranslateY: 0,
                isRefImageDragging: false,
                refImageDragStartX: 0,
                refImageDragStartY: 0,

                // Toast 提示相关
                toastVisible: false,
                toastMessage: '',
                toastType: 'info',
                toastDuration: 3000
            };
        },
        computed: {
            /** 按 nxDoTodayOrder 升序后 reverse，确保之前插入的订单（序号大）显示在上面；同序号时按 id 升序（新插入的 id 大，排后面，reverse 后显示在上） */
            sortedOrderItemsForDisplay() {
                const seq = (o) => o?.getNxDoTodayOrder ?? o?.nxDoTodayOrder ?? 0;
                const id = (o) => o?.nxDepartmentOrdersId ?? 0;
                return [...(this.orderItems || [])].sort((a, b) => {
                    const sa = seq(a), sb = seq(b);
                    if (sa !== sb) return sa - sb;
                    return id(a) - id(b); // 同序号时 id 小的在前，reverse 后 id 大的（新插入）在上
                }).reverse();
            }
        },
        mounted() {
            this._pasteHandler = (e) => {
                if (this.refTab !== 'image') return;
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.kind === 'file' && item.type?.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file) {
                            e.preventDefault();
                            const reader = new FileReader();
                            reader.onload = ev => this.$emit('ref-image-upload', ev.target.result);
                            reader.readAsDataURL(file);
                        }
                        break;
                    }
                }
            };
            document.addEventListener('paste', this._pasteHandler);
        },
        beforeUnmount() {
            document.removeEventListener('paste', this._pasteHandler);
            if (this._refImageOnDrag) {
                document.removeEventListener('mousemove', this._refImageOnDrag);
                document.removeEventListener('mouseup', this._refImageEndDrag);
            }
            if (this._goodsSearchAbort) this._goodsSearchAbort.abort();
        },
        watch: {
            refImageDataUrl(val) {
                if (val) {
                    this.refImageScale = 1;
                    this.refImageTranslateX = 0;
                    this.refImageTranslateY = 0;
                    this.isRefImageDragging = false;
                }
            },
            addingOrderBeforeIndex(val) {
                if (val >= 0) this.$nextTick(() => this.focusBeforeOrderInput('goods-name'));
            },
            'beforeOrderForm.selectedGoods'(val) {
                if (val && this.addingOrderBeforeIndex >= 0) {
                    this.$nextTick(() => this.focusBeforeOrderInput('quantity'));
                }
            }
        },
        methods: {
            // 显示 Toast 提示
            showToast(message, type = 'info', duration = 3000) {
                this.toastMessage = message;
                this.toastType = type;
                this.toastDuration = duration;
                this.toastVisible = true;
            },

            /** 获取订单项大包装显示文本，兼容 orderItem 的 standardWeight/itemUnit/itemsPerCarton/cartonUnit */
            getOrderItemCartonDisplay(item) {
                if (!item) return '';
                const itemsPerCarton = item.itemsPerCarton;
                const weight = item.standardWeight;
                const standard = item.itemUnit || item.nxDoStandard || item.nxDoPrintStandard;
                const cartonUnit = item.cartonUnit;
                if (itemsPerCarton && itemsPerCarton !== 'null' && String(itemsPerCarton).trim()) {
                    return '(' + (weight || '') + '/' + (standard || '') + '*' + itemsPerCarton + '/' + (cartonUnit || '') + ')';
                }
                if (weight && weight !== 'null') {
                    return '(' + weight + '/' + (standard || '') + ')';
                }
                const basicSpec = item.nxDoPrintStandard || item.nxDoStandard;
                if (basicSpec && basicSpec !== 'null') return '(' + basicSpec + ')';
                return '';
            },
            /** 获取大包装显示文本，兼容 dis(nxDg*) 和 nx(nxGoods*) 字段 */
            getCartonDisplay(goods) {
                if (!goods) return '';
                const itemsPerCarton = goods.nxDgItemsPerCarton ?? goods.nxGoodsItemsPerCarton;
                const weight = goods.nxDgGoodsStandardWeight ?? goods.nxGoodsStandardWeight;
                const standard = goods.nxDgGoodsStandardname ?? goods.nxGoodsStandardname;
                const cartonUnit = goods.nxDgCartonUnit ?? goods.nxGoodsCartonUnit;
                if (itemsPerCarton && itemsPerCarton !== 'null') {
                    return '(' + (weight || '') + '/' + (standard || '') + '*' + itemsPerCarton + '/' + (cartonUnit || '') + ')';
                }
                if (weight && weight !== 'null') {
                    return '(' + weight + '/' + (standard || '') + ')';
                }
                if (standard && standard !== 'null') return '(' + standard + ')';
                return '';
            },
            /** 未选商品：保存新商品（弹窗）；已选商品：添加订单（需数量规格） */
            canAddOrder(row) {
                if (!row.goodsName || !String(row.goodsName).trim()) return false;
                if (row.selectedGoods) {
                    return !!(row.quantity && String(row.quantity).trim() && row.standard && String(row.standard).trim());
                }
                return true;  // 保存新商品只需商品名
            },
            onSaveOrderClick(rowIndex, row) {
                row.selectedGoods ? this.$emit('manual-save-order', { rowIndex, row }) : this.$emit('save-new-goods', { rowIndex, row });
            },
            addOrderButtonTitle(row) {
                if (!this.canAddOrder(row)) {
                    if (row.selectedGoods) return '请填写数量和规格';
                    return '请填写商品名称';
                }
                return '保存新商品';
            },
            addOrderButtonText(row) {
                if (!this.canAddOrder(row)) {
                    if (row.selectedGoods) return '请填数量规格';
                    return '请填商品名称';
                }
                return '保存新商品';
            },
            orderItemsIndexOf(item) {
                const arr = this.orderItems || [];
                return arr.findIndex(o => o === item || (o?.nxDepartmentOrdersId && o.nxDepartmentOrdersId === item?.nxDepartmentOrdersId));
            },
            /** 插入订单表单：是否可保存（与 canAddOrder 逻辑一致） */
            canAddBeforeOrder(form) {
                if (!form.goodsName || !String(form.goodsName).trim()) return false;
                if (form.selectedGoods) {
                    return !!(form.quantity && String(form.quantity).trim() && form.standard && String(form.standard).trim());
                }
                return true;
            },
            focusBeforeOrderInput(inputType) {
                this.$nextTick(() => {
                    const tr = this.beforeOrderRowRef;
                    if (!tr) return;
                    const el = tr.querySelector(`[data-input-type="${inputType}"]`);
                    if (el) el.focus();
                });
            },
            onBeforeOrderGoodsNameKeydown(e, item) {
                if (e.isComposing) return;
                const form = this.beforeOrderForm;
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (form.showSearchResults && (form.disArr?.length > 0 || form.nxArr?.length > 0)) {
                        this.$emit('before-order-goods-name-enter', { type: 'select', item, orderIndex: this.orderItemsIndexOf(item) });
                        return;
                    }
                    const val = (e.target?.value ?? form.goodsName ?? '').toString().trim();
                    if (val.length >= 1) {
                        this.$emit('before-order-goods-name-enter', { type: 'search', item, orderIndex: this.orderItemsIndexOf(item), searchStr: val });
                    }
                    return;
                }
                if (!form.showSearchResults || (form.disArr?.length === 0 && form.nxArr?.length === 0)) return;
                const total = (form.disArr?.length || 0) + (form.nxArr?.length || 0);
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.$emit('before-order-goods-name-keydown', { key: 'ArrowDown', total });
                    this.$nextTick(() => this.scrollBeforeOrderSearchIntoView());
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.$emit('before-order-goods-name-keydown', { key: 'ArrowUp', total });
                    this.$nextTick(() => this.scrollBeforeOrderSearchIntoView());
                }
            },
            scrollBeforeOrderSearchIntoView() {
                const dropdown = this.beforeOrderSearchRef;
                if (!dropdown || !this.beforeOrderForm) return;
                const idx = this.beforeOrderForm.selectedSearchIndex ?? 0;
                const el = dropdown.querySelector(`[data-search-index="${idx}"]`);
                if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            },
            /** 输入框聚焦时滚动到可视区域中央，避免靠近底部时被遮挡 */
            scrollInputIntoView(e) {
                const el = e?.target;
                if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            },
            onBeforeOrderTab(e, inputType, item) {
                const types = ['goods-name', 'quantity', 'standard', 'remark'];
                const idx = types.indexOf(inputType);
                const direction = e.shiftKey ? -1 : 1;
                const nextIdx = idx + direction;
                if (nextIdx >= 0 && nextIdx < 4) {
                    e.preventDefault();
                    this.focusBeforeOrderInput(types[nextIdx]);
                }
            },
            onBeforeOrderQuantityEnter(e, item) {
                if (e.isComposing) return;
                e.preventDefault();
                this.focusBeforeOrderInput('standard');
            },
            onBeforeOrderStandardEnter(e, item) {
                if (e.isComposing) return;
                e.preventDefault();
                const form = this.beforeOrderForm;
                if (form.selectedGoods && form.quantity && form.standard && this.canAddBeforeOrder(form)) {
                    this.$emit('save-before-order', { item, orderIndex: this.orderItemsIndexOf(item) });
                    return;
                }
                this.focusBeforeOrderInput('remark');
            },
            initRows(n) {
                return Array.from({ length: n }, () => ({
                    goodsName: '',
                    quantity: '',
                    standard: '',
                    remark: '',
                    selectedGoods: null,
                    showSearchResults: false,
                    disArr: [],
                    nxArr: [],
                    selectedSearchIndex: 0,
                    searchSource: null,
                    searchDone: false,  // 搜索已完成（用于判断无结果时可添加为新商品）
                    _hasAutoFilledCarton: false  // 规格首次清空时已自动填入大包装，第二次清空不再自动填入
                }));
            },
            onRefImageChange(e) {
                const file = e.target?.files?.[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = ev => this.$emit('ref-image-upload', ev.target.result);
                    reader.readAsDataURL(file);
                }
                e.target.value = '';
            },
            handleRefImageDragOver(e) {
                e.preventDefault();
                this.isRefImageDragOver = true;
            },
            handleRefImageDragEnter(e) {
                e.preventDefault();
                this.isRefImageDragOver = true;
            },
            handleRefImageDragLeave(e) {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget)) {
                    this.isRefImageDragOver = false;
                }
            },
            handleRefImageDrop(e) {
                e.preventDefault();
                this.isRefImageDragOver = false;
                const dt = e.dataTransfer;
                const files = dt?.files ?? [];
                const items = dt?.items ?? [];
                let file = null;
                if (files && files.length > 0) {
                    file = files[0];
                }
                if (!file && items.length > 0) {
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        if (item.kind === 'file' && item.type?.startsWith('image/')) {
                            file = item.getAsFile();
                            break;
                        }
                    }
                }
                if (file && file.type?.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = ev => this.$emit('ref-image-upload', ev.target.result);
                    reader.readAsDataURL(file);
                }
            },
            refImageZoomIn() {
                this.refImageScale = Math.min(this.refImageScale + 0.2, 5);
            },
            refImageZoomOut() {
                this.refImageScale = Math.max(this.refImageScale - 0.2, 0.5);
            },
            refImageReset() {
                this.refImageScale = 1;
                this.refImageTranslateX = 0;
                this.refImageTranslateY = 0;
            },
            refImageHandleWheel(e) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.refImageScale = Math.max(0.5, Math.min(5, this.refImageScale + delta));
            },
            refImageStartDrag(e) {
                if (e.button !== 0) return;
                if (e.target.closest('button')) return;
                e.preventDefault();
                e.stopPropagation();
                this.isRefImageDragging = true;
                this.refImageDragStartX = e.clientX - this.refImageTranslateX;
                this.refImageDragStartY = e.clientY - this.refImageTranslateY;
                this._refImageOnDrag = (ev) => this.refImageOnDrag(ev);
                this._refImageEndDrag = (ev) => this.refImageEndDrag(ev);
                document.addEventListener('mousemove', this._refImageOnDrag);
                document.addEventListener('mouseup', this._refImageEndDrag);
            },
            refImageOnDrag(e) {
                if (!this.isRefImageDragging) return;
                e.preventDefault();
                e.stopPropagation();
                this.refImageTranslateX = e.clientX - this.refImageDragStartX;
                this.refImageTranslateY = e.clientY - this.refImageDragStartY;
            },
            refImageEndDrag(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                this.isRefImageDragging = false;
                if (this._refImageOnDrag) {
                    document.removeEventListener('mousemove', this._refImageOnDrag);
                    document.removeEventListener('mouseup', this._refImageEndDrag);
                    this._refImageOnDrag = null;
                    this._refImageEndDrag = null;
                }
            },
            onRowGoodsNameInput(e, rowIndex) {
                const val = e.target.value;
                const row = this.manualRows[rowIndex];
                const prevName = (row.selectedGoods?.nxDgGoodsName || row.selectedGoods?.nxGoodsName || '').trim();
                row.goodsName = val;
                // 用户修改输入时清除已选商品，避免大包装显示错误
                if (row.selectedGoods && (val || '').trim() !== prevName) {
                    row.selectedGoods = null;
                }
                // 不再在输入时请求接口，改为回车时再搜索（见 onRowGoodsNameEnter）
                row.showSearchResults = false;
                row.disArr = [];
                row.nxArr = [];
            },
            onRowGoodsNameKeydown(e, rowIndex) {
                if (e.isComposing) return; // 中文输入法组字时，↑↓ 用于选候选字
                const row = this.manualRows[rowIndex];
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (row.showSearchResults && (row.disArr?.length > 0 || row.nxArr?.length > 0)) {
                        const idx = row.selectedSearchIndex ?? 0;
                        const disLen = row.disArr?.length || 0;
                        if (idx < disLen) {
                            this.onSelectGoods(rowIndex, row.disArr[idx], 'dis');
                            return;
                        }
                        if (idx < disLen + (row.nxArr?.length || 0)) {
                            this.onDownloadNxGoods(rowIndex, row.nxArr[idx - disLen]);
                            return;
                        }
                    }
                    const val = (e.target?.value ?? row.goodsName ?? '').toString().trim();
                    if (val.length >= 1) this.doGoodsSearch(rowIndex, val);
                    return;
                }
                if (!row.showSearchResults || (row.disArr?.length === 0 && row.nxArr?.length === 0)) return;
                const total = (row.disArr?.length || 0) + (row.nxArr?.length || 0);
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    row.selectedSearchIndex = (row.selectedSearchIndex + 1) % total;
                    this.scrollSearchItemIntoView(rowIndex);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    row.selectedSearchIndex = row.selectedSearchIndex <= 0 ? total - 1 : row.selectedSearchIndex - 1;
                    this.scrollSearchItemIntoView(rowIndex);
                }
            },
            scrollSearchItemIntoView(rowIndex) {
                this.$nextTick(() => {
                    const dropdown = this.searchDropdownRefs[rowIndex];
                    if (!dropdown) return;
                    const el = dropdown.querySelector(`[data-search-index="${this.manualRows[rowIndex]?.selectedSearchIndex}"]`);
                    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                });
            },
            async doGoodsSearch(rowIndex, value) {
                const depId = this.depId;
                if (!depId || !this.disUser) return;
                if (this._goodsSearchAbort) this._goodsSearchAbort.abort();
                this._goodsSearchAbort = new AbortController();
                const signal = this._goodsSearchAbort.signal;
                try {
                    const res = await api.queryDisGoodsByQuickSearchWithDepId({
                        disId: this.disUser.nxDiuDistributerId,
                        searchStr: value,
                        depId
                    }, { signal });
                    if (res?.data?.code === 0) {
                        const disArr = res.data.data?.disArr || [];
                        const nxArr = res.data.data?.nxArr || [];
                        this.setSearchResults(rowIndex, disArr, nxArr);
                    } else if (res?.data?.code === -1 && res?.data?.msg) {
                        if (res.data.msg.includes('请继续输入')) {
                            this.showToast('搜索结果太多，请继续输入内容，缩小查询范围', 'warning');
                        } else {
                            this.showToast(res.data.msg, 'error');
                        }
                    }
                } catch (e) {
                    if (e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return;
                    console.error('商品搜索失败', e);
                }
            },
            async onSelectGoods(rowIndex, goods, source) {
                const row = this.manualRows[rowIndex];
                let g = source === 'dis' ? goods : {
                    ...goods,
                    nxDgGoodsName: goods.nxGoodsName,
                    nxDgGoodsStandardname: goods.nxGoodsStandardname,
                    nxDistributerGoodsId: goods.nxGoodsId || goods.nxDistributerGoodsId
                };
                if (g.nxDistributerGoodsId) {
                    try {
                        const res = await api.disGetGoods(g.nxDistributerGoodsId);
                        if (res?.data?.code === 0 && res.data.data) g = res.data.data;
                    } catch (e) {}
                }
                row.selectedGoods = g;
                row.goodsName = g.nxDgGoodsName || g.nxGoodsName || '';
                row.standard = g.nxDgGoodsStandardname || g.nxGoodsStandardname || '';
                row._hasAutoFilledCarton = false;
                row.showSearchResults = false;
                this.$nextTick(() => this.focusInput(rowIndex, 'quantity'));
            },
            /** 系统商品需先下载，下载成功后选择商品 */
            async onDownloadNxGoods(rowIndex, goods) {
                if (!goods?.nxGoodsId) {
                    this.showToast('商品数据错误', 'error');
                    return;
                }
                if (!this.disUser?.nxDiuDistributerId) {
                    this.showToast('无法获取配送商信息', 'error');
                    return;
                }
                try {
                    this.$store?.commit('SET_LOADING', true);
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
                        ...(goods.nxGoodsStandardEntities && { nxStandardEntities: goods.nxGoodsStandardEntities }),
                        ...(goods.nxAliasEntities && { nxAliasEntities: goods.nxAliasEntities }),
                    };
                    const res = await api.downDisGoods(dg);
                    if (res?.data?.code === 0 && res.data.data) {
                        this.onSelectGoods(rowIndex, res.data.data, 'dis');
                    } else {
                        const errorMsg = res?.data?.msg || res?.data?.message || '下载失败';
                        if (String(res?.data?.code) === '1' || String(res?.data?.code) === '-1') {
                            const found = await this.searchExistingDisGoods(goods);
                            if (found) {
                                this.onSelectGoods(rowIndex, found, 'dis');
                                return;
                            }
                        }
                        this.showToast(errorMsg, 'error');
                    }
                } catch (e) {
                    console.error('下载商品失败', e);
                    this.showToast('下载商品失败，请检查网络', 'error');
                } finally {
                    this.$store?.commit('SET_LOADING', false);
                }
            },
            async searchExistingDisGoods(nxGoods) {
                if (!this.depId || !this.disUser) return null;
                try {
                    const res = await api.queryDisGoodsByQuickSearchWithDepId({
                        disId: this.disUser.nxDiuDistributerId,
                        searchStr: nxGoods?.nxGoodsName || '',
                        depId: this.depId
                    });
                    if (res?.data?.code === 0) {
                        const disArr = res.data.data?.disArr || [];
                        let found = disArr.find(d => d.nxDgNxGoodsId === nxGoods?.nxGoodsId);
                        if (!found) {
                            found = disArr.find(d => (d.nxDgGoodsName || '').trim() === (nxGoods?.nxGoodsName || '').trim());
                        }
                        if (!found && disArr.length > 0) {
                            found = disArr[0];
                        }
                        return found || null;
                    }
                } catch (e) {}
                return null;
            },
            onRowQuantityEnter(e, rowIndex) {
                if (e.isComposing) return;
                e.preventDefault();
                this.$nextTick(() => this.focusInput(rowIndex, 'standard'));
            },
            /** 规格逻辑：选择商品后默认商品规格；首次删除→有大包装则填箱（nxDgCartonUnit）；再次删除→允许用户自定义 */
            onRowStandardInput(value, rowIndex) {
                const row = this.manualRows[rowIndex];
                const trimmed = (value ?? '').trim();
                const cartonUnit = (row.selectedGoods?.nxDgCartonUnit ?? row.selectedGoods?.nxGoodsCartonUnit ?? '').toString().trim();
                if (trimmed !== '') {
                    row.standard = value ?? '';
                    if (cartonUnit && trimmed !== cartonUnit && !cartonUnit.startsWith(trimmed)) {
                        row._hasAutoFilledCarton = false;  // 用户输入了非大包装单位，视为自定义
                    }
                    return;
                }
                if (row._hasAutoFilledCarton) {
                    row.standard = '';
                    row._hasAutoFilledCarton = false;  // 删除大包装后允许空，用户可自定义
                    return;
                }
                if (cartonUnit) {
                    row.standard = cartonUnit;
                    row._hasAutoFilledCarton = true;   // 首次删除商品规格，自动填箱
                } else {
                    row.standard = '';
                }
            },
            onRowStandardEnter(e, rowIndex) {
                if (e.isComposing) return;
                e.preventDefault();
                const row = this.manualRows[rowIndex];
                if (row.selectedGoods && row.quantity && row.standard) {
                    this.$emit('manual-save-order', { rowIndex, row });
                    return;
                }
                this.$nextTick(() => this.focusInput(rowIndex, 'remark'));
            },
            onRowRemarkEnter(e, rowIndex) {
                if (e.isComposing) return;
                e.preventDefault();
                const row = this.manualRows[rowIndex];
                if (this.canAddOrder(row)) {
                    row.selectedGoods ? this.$emit('manual-save-order', { rowIndex, row }) : this.$emit('save-new-goods', { rowIndex, row });
                } else {
                    this.$nextTick(() => this.focusInput(Math.min(rowIndex + 1, this.manualRows.length - 1), 'goods-name'));
                }
            },
            onRowTab(e, rowIndex, inputType) {
                const types = ['goods-name', 'quantity', 'standard', 'remark'];
                const idx = types.indexOf(inputType);
                const direction = e.shiftKey ? -1 : 1;
                let nextIdx = idx + direction;
                let nextRowIndex = rowIndex;
                if (nextIdx >= 4) {
                    nextIdx = 0;
                    nextRowIndex = Math.min(rowIndex + 1, this.manualRows.length - 1);
                } else if (nextIdx < 0) {
                    nextIdx = 3;
                    nextRowIndex = Math.max(rowIndex - 1, 0);
                }
                e.preventDefault();
                this.$nextTick(() => this.focusInput(nextRowIndex, types[nextIdx]));
            },
            focusInput(rowIndex, inputType) {
                const tr = this.rowRefs[rowIndex];
                if (!tr) return;
                const el = tr.querySelector(`[data-input-type="${inputType}"]`);
                if (el) el.focus();
            },
            setSearchResults(rowIndex, disArr, nxArr) {
                const row = this.manualRows[rowIndex];
                if (!row) return;
                row.disArr = disArr || [];
                row.nxArr = nxArr || [];
                row.showSearchResults = (row.disArr.length + row.nxArr.length) > 0;
                row.selectedSearchIndex = 0;
                row.searchSource = row.disArr.length > 0 ? 'dis' : 'nx';
                row.searchDone = true;
            },
            /** 弹窗保存新商品后，将行设为已选商品状态，用户继续填数量规格 */
            setRowSelectedGoodsAfterSave(rowIndex, goods, standardName) {
                const row = this.manualRows[rowIndex];
                if (!row) return;
                row.selectedGoods = goods;
                row.goodsName = goods.nxDgGoodsName || goods.nxGoodsName || '';
                row.standard = (standardName || '').trim() || (goods.nxDgGoodsStandardname || goods.nxGoodsStandardname || '斤');
                row.showSearchResults = false;
                row.disArr = [];
                row.nxArr = [];
            },
            clearRowAfterSave(rowIndex) {
                const row = this.manualRows[rowIndex];
                if (!row) return;
                row.goodsName = '';
                row.quantity = '';
                row.standard = '';
                row.remark = '';
                row.selectedGoods = null;
                row.showSearchResults = false;
                row.searchDone = false;
                row.disArr = [];
                row.nxArr = [];
                // 保存后光标转到第二行（第一个录入行）继续录入新订单
                this.$nextTick(() => this.focusInput(0, 'goods-name'));
            }
        }
    };
</script>

<style scoped>
.drop-zone {
    transition: all 0.3s ease;
}
.drop-zone.drag-over {
    background-color: #e3f2fd !important;
    border-color: #2196f3 !important;
    border-width: 2px !important;
}
.ref-image-fill {
    width: 100%;
    height: 100%;
    object-fit: contain;
}
.ref-textarea::placeholder {
    font-size: 14px;
}
.manual-entry-action-btn {
    font-size: 14px;
    color: #6c757d;
    cursor: pointer;
    padding: 0 4px;
    margin-right: 12px;
    background: none;
    border: none;
}
.manual-entry-action-btn:last-child {
    margin-right: 0;
}
.manual-entry-action-btn:hover {
    color: #495057;
}
</style>

