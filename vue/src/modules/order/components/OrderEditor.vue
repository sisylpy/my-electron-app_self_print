<template>
    <div ref="scrollContainer" class="order-list-container flex-grow-1"
         style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 0;"
         @keydown="handleGoodsListKeydown">
        <div v-if="orderItems.length === 0" class="text-center text-muted p-4">
            <div class="mb-2">📋 暂无订单</div>
            <small>{{ emptyMessage }}</small>
        </div>

        <!-- 表头 -->
        <div v-if="orderItems.length > 0">
            <div
                    ref="tableHeader"
                    class="table-header-fixed bg-light border-bottom p-1 d-flex align-items-center fw-bold small"
                    :style="{
                 position: 'sticky',
                 top: ttsPlayerHeight > 0 ? (ttsPlayerHeight + 'px') : '0',
                 zIndex: ttsPlayerHeight > 0 ? 9 : 10
             }">
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
                        :ref="el => { if (el) orderItemRefs[orderIndex] = el }"
                        :data-order-index="orderIndex"
                        class="order-item-card mb-1 p-1 rounded border-bottom"
                        :style="{
                    position: 'relative',
                    backgroundColor: getOrderItemBackgroundColor(item, orderIndex),
                    transition: 'background-color 0.3s ease'
                }">

                    <!-- 之前添加新订单的商品选择面板 -->
                    <div v-if="addingOrderBeforeIndex === orderIndex"
                         class="p-1 border rounded mb-1"
                         style="background-color: #fff; position: relative; z-index: 11;">
                        <!-- 第一行：商品名称、数量、规格、关闭按钮 -->
                        <div class="d-flex align-items-center gap-2 mb-1" style="min-height: 32px;">
                            <!-- 商品名称 -->
                            <div style="flex: 2; min-width: 0; position: relative;">
                                <input
                                        type="text"
                                        class="form-control form-control-sm"
                                        :value="beforeOrderForm.goodsName"
                                        @input="onBeforeOrderGoodsNameInput($event)"
                                        @keydown="handleBeforeOrderGoodsNameKeydown($event)"
                                        @keydown.tab="onBeforeOrderTab($event, 'goods-name', orderIndex)"
                                        data-input-type="before-order-goods-name"
                                        placeholder="商品名称"
                                        style="background-color: #fff; font-size: 16px;"
                                />
                                <ProductPanel
                                        v-if="beforeOrderForm.showSearchResults && (beforeOrderForm.disArr?.length > 0 || beforeOrderForm.nxArr?.length > 0)"
                                        :form="beforeOrderForm"
                                        :dis-id="disId"
                                        :order-index="orderIndex"
                                        @close="$emit('close-before-order-search-results')"
                                        @select="$emit('select-before-order-goods', $event)"
                                        @download="$emit('download-goods-nx', $event)"
                                />
                            </div>
                            <!-- 数量 -->
                            <div style="width: 50px; flex-shrink: 0;">
                                <input
                                        type="number"
                                        class="form-control form-control-sm text-center"
                                        :value="beforeOrderForm.quantity"
                                        @input="$emit('before-order-quantity-input', $event.target.value)"
                                        @keydown.enter="onBeforeOrderQuantityEnter($event, item, orderIndex)"
                                        @keydown.tab="onBeforeOrderTab($event, 'quantity', orderIndex)"
                                        data-input-type="before-order-quantity"
                                        placeholder="数量"
                                        style="background-color: #fff; font-size: 16px;"
                                />
                            </div>
                            <!-- 规格 -->
                            <div style="width: 50px; flex-shrink: 0;">
                                <input
                                        type="text"
                                        class="form-control form-control-sm text-center"
                                        :value="beforeOrderForm.standard"
                                        @input="$emit('before-order-standard-input', $event.target.value)"
                                        @keydown.enter="onBeforeOrderStandardEnter($event, item, orderIndex)"
                                        @keydown.tab="onBeforeOrderTab($event, 'standard', orderIndex)"
                                        data-input-type="before-order-standard"
                                        placeholder="规格"
                                        style="background-color: #fff; font-size: 16px;"
                                />
                            </div>
                            <!-- 操作按钮 -->
                            <div style="flex-shrink: 0; display: flex; gap: 4px;">
                                <!-- 保存按钮 -->
                                <button v-if="String(beforeOrderForm.goodsName || '').length > 0"
                                        class="btn btn-sm"
                                        :disabled="!canAddBeforeOrder(beforeOrderForm)"
                                        :style="!canAddBeforeOrder(beforeOrderForm) ? 'font-size: 14px; padding: 4px 8px; background-color: transparent !important; border: none; color: #adb5bd; cursor: not-allowed;' : 'font-size: 14px; padding: 4px 8px; background-color: transparent !important; border: none; color: #6c757d; transition: all 0.2s;'"
                                        @click="beforeOrderForm.selectedGoods ? $emit('save-before-order', { item, orderIndex }) : $emit('save-new-goods-from-before-order', { item, orderIndex })"
                                        :title="beforeOrderForm.selectedGoods ? '保存订单' : '保存新商品'"
                                        @mouseenter="canAddBeforeOrder(beforeOrderForm) ? $event.target.style.color='#495057' : null"
                                        @mouseleave="canAddBeforeOrder(beforeOrderForm) ? $event.target.style.color='#6c757d' : null">
                                    💾
                                </button>
                                <!-- 关闭按钮 -->
                                <button class="btn btn-sm btn-link p-0"
                                        @click="$emit('cancel-add-order-before')"
                                        style="font-size: 14px;">✕
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 第一行：序号、商品名称、数量、规格、状态 -->
                    <div class="d-flex align-items-center gap-2 mb-1" style="min-height: 32px;">
                        <!-- 序号 -->
                        <div style="width: 50px; flex-shrink: 0;"
                             class="text-center fw-bold d-flex align-items-center justify-content-center gap-1">
                            <!-- 暂停图标（点击取消朗读状态） -->
                            <span v-if="isPausedOrder(orderIndex)" style="font-size: 16px; cursor: pointer;"
                                  title="点击取消朗读状态"
                                  @click.stop="cancelPausedState">⏸️</span>
                            <!-- 朗读图标 -->
                            <span v-else-if="isCurrentReadingOrder(orderIndex)" style="font-size: 16px;"
                                  title="正在朗读">🔊</span>
                            <span>{{ orderIndex + 1 }}</span>
                        </div>
                        <!-- 商品名称输入框 -->
                        <div style="flex: 2; min-width: 0; display: flex; align-items: center; gap: 4px;"
                             class="position-relative">
                        <span v-if="item.nxDoStatus > -1 ">
<!--                            加这里-->
                        <span class=" form-control-md">{{item.nxDistributerGoodsEntity?.nxDgGoodsName || item.nxDoGoodsName || ''}}</span>
                            <span class="form-control-sm text-dark-emphasis"
                                  v-if="item.nxDistributerGoodsEntity && item.nxDistributerGoodsEntity.nxDgGoodsName !== item.nxDoGoodsName">原始:{{item.nxDoGoodsName}}</span>
                            <span class="text-center  table-cell"
                                  v-if="item.nxDistributerGoodsEntity &&  item.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== null && item.nxDistributerGoodsEntity.nxDgGoodsStandardWeight !== ''">
              <span class="text-muted small me-1" v-if="item.nxDistributerGoodsEntity.nxDgItemsPerCarton !== null">({{ item.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }}*{{ item.nxDistributerGoodsEntity.nxDgItemsPerCarton }}{{ item.nxDistributerGoodsEntity.nxDgCartonUnit }})
                </span>
               <span class="text-muted small me-1" v-else>({{ item.nxDistributerGoodsEntity.nxDgGoodsStandardWeight }}/{{item.nxDistributerGoodsEntity.nxDgGoodsStandardname}})</span>

            </span>

               <span class="text-muted small me-1" v-else>
                 ({{ item.nxDistributerGoodsEntity?.nxDgGoodsStandardname }})
                </span>
                </span>
                            <input v-else
                                   type="text"
                                   class="form-control form-control-lg"
                                   data-order-input="goods-name"
                                   :value="getGoodsNameValue(item, orderIndex)"
                                   @input="handleGoodsNameInput($event, item, orderIndex)"
                                   @keydown.enter="handleGoodsNameEnter($event, item, orderIndex)"
                                   @keydown.tab="handleTabKey($event, orderIndex, 'goods-name')"
                                   @focus="handleGoodsNameFocus(item, orderIndex)"
                                   @blur="$emit('goods-name-blur', { item, orderIndex })"
                                   :disabled="item.nxDoStatus === 0 || !isValidOrderQuantityAndStandard(item)"
                                   :title="!isValidOrderQuantityAndStandard(item) ? '请先填写数量和规格' : ''"
                                   style="font-size: 16px; background-color: transparent; flex: 1;"
                            />
                            <!-- 展开/收起匹配商品列表的图标 -->
                            <button
                                    v-if="item.nxDoStatus !== 0 && isValidOrderQuantityAndStandard(item) && item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0"
                                    class="btn btn-link btn-sm p-1"
                                    @click.stop="handleToggleMatchedGoods(orderIndex)"
                                    :title="showMatchedGoods[orderIndex] ? '收起匹配商品' : '展开匹配商品'"
                                    style="flex-shrink: 0; text-decoration: none; color: #0dcaf0; background-color: lightgoldenrodyellow; border-radius: 4px;"
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
                                    data-order-input="quantity"
                                    :value="item.nxDoQuantity"
                                    @input="$emit('quantity-input', { item, orderIndex, value: $event.target.value })"
                                    @keydown.enter="handleQuantityEnter($event, item, orderIndex)"
                                    @keydown.tab="handleTabKey($event, orderIndex, 'quantity')"
                                    @focus="handleQuantityOrStandardFocus(orderIndex)"
                                    :disabled="item.nxDoStatus > -1"
                                    style="background-color: transparent; font-size: 16px;"
                            />
                        </div>
                        <!-- 规格 -->
                        <div style="width: 50px; flex-shrink: 0;">
                            <input
                                    type="text"
                                    class="form-control form-control-sm text-center"
                                    data-order-input="standard"
                                    :value="item.nxDoStandard"
                                    @input="$emit('standard-change', { item, orderIndex, value: $event.target.value })"
                                    @keydown.enter="handleStandardEnter($event, item, orderIndex)"
                                    @keydown.tab="handleTabKey($event, orderIndex, 'standard')"
                                    @focus="handleQuantityOrStandardFocus(orderIndex)"
                                    :disabled="item.nxDoStatus > -1"
                                    style="background-color: transparent; font-size: 16px;"
                            />
                        </div>
                        <!-- 状态 -->
                        <div style="width: 100px; flex-shrink: 0;"
                             class="d-flex align-items-center justify-content-center gap-1">
                            <template v-if="item.nxDoStatus === 0">
                                <button
                                        class="btn btn-sm"
                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                        @click="handleOrderAction(() => $emit('update-order', { item, orderIndex }), orderIndex)"
                                        title="修改"
                                        @mouseenter="$event.target.style.color='#495057'"
                                        @mouseleave="$event.target.style.color='#6c757d'">
                                    ✏️
                                </button>
                                <button class="btn btn-sm"
                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                        @click="readOrderListFromIndex(orderIndex)"
                                        title="从这里开始朗读"
                                        @mouseenter="$event.target.style.color='#dc3545'"
                                        @mouseleave="$event.target.style.color='#6c757d'">
                                    🔊
                                </button>

                            </template>

                            <template v-else-if="item.nxDoStatus === -2">
                                <button class="btn btn-sm"
                                        :disabled="!isValidOrderQuantityAndStandard(item)"
                                        :style="!isValidOrderQuantityAndStandard(item) ? 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #adb5bd; cursor: not-allowed;' : 'font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;'"
                                        @click="handleOrderAction(() => $emit('save-new-goods', { item, orderIndex, goodsName: getGoodsNameValue(item, orderIndex) }), orderIndex)"
                                        :title="!isValidOrderQuantityAndStandard(item) ? '请填写订单数量和规格' : '保存新商品'"
                                        @mouseenter="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#495057'"
                                        @mouseleave="!isValidOrderQuantityAndStandard(item) ? null : $event.target.style.color='#6c757d'">
                                    {{ !isValidOrderQuantityAndStandard(item) ? '⚠️' : '💾' }}
                                </button>
                                <button class="btn btn-sm"
                                        style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                        @click="handleOrderAction(() => $emit('delete-order', { item, orderIndex }), orderIndex)"
                                        title="删除"
                                        @mouseenter="$event.target.style.color='#dc3545'"
                                        @mouseleave="$event.target.style.color='#6c757d'">
                                    🗑️
                                </button>
                            </template>

                            <button class="btn btn-sm"
                                    style="font-size: 14px; padding: 4px 8px; background: transparent; border: none; color: #6c757d; transition: all 0.2s;"
                                    @click="handleOrderAction(() => $emit('add-new-order-before', { item, orderIndex }), orderIndex)"
                                    title="之前添加订单"
                                    @mouseenter="$event.target.style.color='#495057'"
                                    @mouseleave="$event.target.style.color='#6c757d'">
                                ⬆️
                            </button>


                        </div>
                    </div>
                    <!-- 规格信息显示行（如果 standardWeight 不为 null） -->
                    <div v-if="item.standardWeight && item.standardWeight !== 'null' && item.standardWeight !== null"
                         class="mt-2 "
                         style="padding: 8px 12px; margin-left: 50px; ">
                        <div class="d-flex align-items-center gap-3 flex-wrap" v-if="item.nxDoStatus  == -2">
                            <!-- 规格单位 -->
                            <div class="d-flex align-items-center gap-1">
                                <span class="text-muted small">单位：</span>
                                <input
                                        type="text"
                                        class="form-control form-control-sm"
                                        :value="item.standardWeight"
                                        @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'standardWeight' })"
                                        :disabled="item.nxDoStatus === 0"
                                        style="width: 90px;"
                                /><span class="text-muted small mx-1">/</span><input
                                    type="text"
                                    class="form-control form-control-sm"
                                    :value="item.itemUnit"
                                    @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'itemUnit' })"
                                    :disabled="item.nxDoStatus === 0"
                                    style="width: 70px;"
                            />

                            </div>

                            <!-- 大包装信息 -->
                            <div class="d-flex align-items-center gap-1"
                                 v-if="item.cartonUnit && item.cartonUnit !== 'null'">
                                <span class="text-muted small">规格:</span>
                                <input
                                        type="number"
                                        class="form-control form-control-sm"
                                        :value="item.itemsPerCarton"
                                        @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'itemsPerCarton' })"
                                        :disabled="item.nxDoStatus === 0"
                                        min="0"
                                        step="1"
                                        style="width: 60px;"
                                />
                                <span v-if="item.itemsPerCarton && item.itemsPerCarton !== 'null' && item.itemsPerCarton !== '' && item.cartonUnit && item.cartonUnit !== 'null' && item.cartonUnit !== ''"
                                      class="text-muted small mx-1">{{ item.itemUnit || item.nxDoStandard || '' }}/</span>
                                <input
                                        type="text"
                                        class="form-control form-control-sm"
                                        :value="item.cartonUnit"
                                        @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'cartonUnit' })"
                                        :disabled="item.nxDoStatus === 0"
                                        style="width: 60px;"
                                />
                            </div>
                        </div>
                    </div>
                    <!-- 第二行：备注（如果有） -->
                    <div v-if="item.nxDoRemark" class="d-flex align-items-center gap-2 mt-1"
                         style="margin-left: 50px; padding: 8px 12px; ">
                        <span class="text-muted small">备注:</span>
                        <input
                                type="text"
                                class="form-control form-control-sm"
                                :value="item.nxDoRemark"
                                @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'nxDoRemark' })"
                                :disabled="item.nxDoStatus === 0"
                                maxlength="15"
                                style="font-size: 12px; background-color: transparent; width: 200px; flex-shrink: 0;"
                        />
                    </div>

                    <!-- 匹配的商品列表（可折叠） -->
                    <transition name="matched-goods">
                        <div v-if="item.nxDistributerGoodsEntityList && item.nxDistributerGoodsEntityList.length > 0 && showMatchedGoods[orderIndex] && !(orderArrIndex === orderIndex && (strArr.length > 0 || nxArr.length > 0))"
                             class="matched-goods-list mt-2"
                             :data-order-index="orderIndex"
                             style="margin-left: -0.5rem; margin-right: -0.5rem; width: calc(100% + 1rem); ">
                            <div class="matched-goods-container border rounded p-2"
                                 style="background-color: #e7f3ff; border-color: #0dcaf0 !important; box-shadow: 0 2px 8px rgba(13, 202, 240, 0.2);">
                                <div class="d-flex justify-content-between align-items-center mb-2">
                                    <small class="text-muted fw-bold">推荐商品 ({{
                                        item.nxDistributerGoodsEntityList.length }})</small>
                                    <button
                                            class="btn btn-sm btn-link p-2 text-muted"
                                            @click="$emit('toggle-matched-goods', orderIndex)"
                                            style="font-size: 12px; text-decoration: none;"
                                            title="收起">
                                        ✕
                                    </button>
                                </div>
                                <!-- 配送商商品 -->
                                <div class="mb-2">

                                    <div
                                            v-for="(matchedGoods, goodsIndex) in item.nxDistributerGoodsEntityList"
                                            :key="goodsIndex"
                                            class="matched-goods-item p-2 mb-1 rounded hover-bg d-flex"
                                            :class="{ 'goods-item-selected': selectedMatchedGoodsIndex[orderIndex] === goodsIndex && (orderArrIndex !== orderIndex || selectedNxGoodsIndex < 0) }"
                                            :data-goods-index="goodsIndex"
                                            style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                        <!-- 左侧内容区域 -->
                                        <div class="flex-grow-1" style="min-width: 0; margin-right: 40px;">
                                            <!-- 商品信息 -->
                                            <div>
                                                <span class="text-muted fw-bold me-2" style="color: #666;">{{ goodsIndex + 1 }}.</span>
                                                <span v-if="disId != null && matchedGoods.nxDgDistributerId != null && matchedGoods.nxDgDistributerId !== disId && matchedGoods.nxDgDistributerName"
                                                      class="font-xs text-primary me-1">[{{ matchedGoods.nxDgDistributerName }}]</span>
                                                <span v-if="matchedGoods.nxDgGoodsBrand && matchedGoods.nxDgGoodsBrand !== 'null'"
                                                      class="badge bg-warning text-dark me-1">
                                            {{ matchedGoods.nxDgGoodsBrand }}
                                        </span>
                                                <span class="text-dark"
                                                      style="color: #333; font-weight: 500;">{{ matchedGoods.nxDgGoodsName }}</span>

                                                <span class="text-muted small ms-1"
                                                      v-if="matchedGoods.nxDgItemsPerCarton && matchedGoods.nxDgItemsPerCarton !== 'null'">
                                            ({{matchedGoods.nxDgGoodsStandardWeight + '/'+ matchedGoods.nxDgGoodsStandardname + '*' + matchedGoods.nxDgItemsPerCarton +'/'+matchedGoods.nxDgCartonUnit }})
                                        </span>
                                                <span v-else>
                                             <span class="text-muted small ms-1" style="color: #666;"
                                                   v-if="matchedGoods.nxDgGoodsStandardWeight && matchedGoods.nxDgGoodsStandardWeight !== 'null'">
                                            ({{ matchedGoods.nxDgGoodsStandardWeight && matchedGoods.nxDgGoodsStandardWeight !== 'null'
                                              ? matchedGoods.nxDgGoodsStandardWeight + '/' + matchedGoods.nxDgGoodsStandardname
                                              : matchedGoods.nxDgGoodsStandardname }})
                                        </span>
                                        <span class="text-muted small ms-1" style="color: #666;" v-else>
                                            ({{matchedGoods.nxDgGoodsStandardname }})
                                        </span>

                                        </span>
                                            </div>

                                            <!-- 历史订货记录 -->
                                            <div v-if="matchedGoods.departmentDisGoodsEntity != null"
                                                 class="mt-2 d-flex"
                                                 style="font-size: 12px; padding-left: 28px; gap: 20px; flex-wrap: nowrap;">
                                                <!--                                    时间-->
                                                <span style="white-space: nowrap;">
                                            <span>上次订货:</span>
                                            <span>{{matchedGoods.departmentDisGoodsEntity.nxDdgOrderDate}}</span>
                                        </span>
                                                <!--                                    价格-->
                                                <span style="white-space: nowrap;">
                                            <span>单价:</span>
                                            <span>{{matchedGoods.departmentDisGoodsEntity.nxDdgOrderPrice}}/{{matchedGoods.nxDgGoodsStandardname}}</span>
                                        </span>
                                                <!--                                    订货-->
                                                <span style="white-space: nowrap;">
                                            <span>订货:</span>
                                            <span>{{matchedGoods.departmentDisGoodsEntity.nxDdgOrderQuantity}}</span>
                                            <span>{{matchedGoods.departmentDisGoodsEntity.nxDdgOrderStandard}}</span>
                                        </span>
                                            </div>
                                        </div>

                                        <!-- 选择按钮 -->
                                        <button
                                                class="btn btn-secondary btn-sm align-self-center"
                                                @click.stop="$emit('select-matched-goods', { item, orderIndex, goodsIndex })"
                                                style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff;">
                                            选择
                                        </button>
                                    </div>

<!-- 订单带的推荐系统商品列表（无搜索结果时显示，可下载） -->

                            <div v-if="item.nxGoodsEntities && item.nxGoodsEntities.length > 0 && orderArrIndex === orderIndex && strArr.length === 0 && nxArr.length === 0"
                                 class="border rounded p-2 mb-2 nx-goods-entities-container"
                                 style="background-color: #fff3cd; border-color: #ffc107 !important; margin-top: 4px;"
                                 :data-order-index="orderIndex">
                                <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                    <span class="text-muted small fw-bold">推荐系统商品 ({{ item.nxGoodsEntities.length }})</span>
                                    <button class="btn btn-sm btn-link p-0" @click="$emit('close-str')"
                                            style="font-size: 12px;">✕</button>
                                </div>
                                <div v-for="(goods, nxIndex) in item.nxGoodsEntities"
                                     :key="goods.nxGoodsId || nxIndex"
                                     class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                     :class="{ 'goods-item-selected': selectedNxGoodsIndex === nxIndex }"
                                     :data-goods-index="nxIndex"
                                     @click.stop="$emit('download-goods-nx', { goods, orderIndex })"
                                     style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                    <div class="flex-grow-1" style="min-width: 0;">
                                        <span class="text-muted fw-bold me-2" style="color: #666;">{{ nxIndex + 1 }}.</span>
                                        <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'"
                                              class="badge bg-warning text-dark me-1">{{ goods.nxGoodsBrand }}</span>
                                        <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                        <span v-if="goods.nxAliasEntities && goods.nxAliasEntities.length > 0"
                                              v-for="(alias, aliasIndex) in goods.nxAliasEntities"
                                              :key="alias.nxDaAliasName || aliasIndex"
                                              class="text-primary small ms-1">@{{ alias.nxDaAliasName }}</span>
                                        <span class="text-muted small ms-1"
                                              v-if="goods.nxGoodsItemsPerCarton && goods.nxGoodsItemsPerCarton !== 'null'">
                                            ({{ (goods.nxGoodsStandardWeight || '') + '/' + (goods.nxGoodsStandardname || '') + '*' + goods.nxGoodsItemsPerCarton + '/' + (goods.nxGoodsCartonUnit || '') }})
                                        </span>
                                        <span class="text-muted small ms-1" v-else-if="goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'">
                                            ({{ goods.nxGoodsStandardWeight }}/{{ goods.nxGoodsStandardname }})
                                        </span>
                                        <span class="text-muted small ms-1" v-else>
                                            ({{ goods.nxGoodsStandardname }})
                                        </span>
                                        <span v-if="goods.nxGoodsPlace && goods.nxGoodsPlace !== 'null'"
                                              class="text-muted small ms-2">产地:{{ goods.nxGoodsPlace }}</span>
                                        <span v-if="goods.nxGoodsDetail && goods.nxGoodsDetail !== 'null'"
                                              class="text-muted small ms-2">{{ goods.nxGoodsDetail }}</span>
                                    </div>
                                    <button class="btn btn-info btn-sm"
                                            @click.stop="$emit('download-goods-nx', { goods, orderIndex })"
                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                            title="下载商品">⬇️</button>
                                </div>
                            </div>


<!--                                    。。/-->

                                </div>
                            </div>
                        </div>
                    </transition>

                    <!-- 商品搜索下拉框（相对于订单项定位，覆盖整个订单列表宽度） -->
                    <transition name="search-results">
                        <div
                                v-if="orderArrIndex === orderIndex && item.nxDoStatus !== 0 && (strArr.length > 0 || nxArr.length > 0)"
                                class="goods-search-dropdown position-absolute border rounded shadow-lg p-2 search-results-container"
                                :data-order-index="orderIndex"
                                style="top: 100%; left: -0.5rem; right: -0.5rem; width: calc(100% + 1rem); z-index: 1000; max-height: 400px; overflow-y: auto; margin-top: 4px; background-color: #fff3cd; border-color: #ffc107 !important; box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);"
                        >
                            <!-- 搜索标题 -->
                            <div class="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                                <span class="text-muted small">搜索{{ strArr.length + nxArr.length }}个商品:</span>
                                <button class="btn btn-sm btn-link p-0" @click="$emit('close-str')"
                                        style="font-size: 12px;">✕
                                </button>
                            </div>

                            <!-- 配送商商品列表 -->
                            <div v-if="strArr.length > 0" class="mb-2">
                                <div class="text-muted small fw-bold mb-2">配送商品 ({{ strArr.length }})
                                </div>
                                <div
                                        v-for="(goods, goodsIndex) in strArr"
                                        :key="goods.nxDistributerGoodsId || goodsIndex"
                                        class="goods-item p-2 mb-1 rounded hover-bg d-flex"
                                        :class="{ 'goods-item-selected': selectedSearchResultIndex === goodsIndex }"
                                        :data-goods-index="goodsIndex"
                                        @click.stop="$emit('select-search-result', { goods, orderIndex })"
                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                    <!-- 左侧内容区域 -->
                                    <div class="flex-grow-1" style="min-width: 0; margin-right: 40px;">
                                        <!-- 商品信息 -->
                                        <div>
                                            <span class="text-muted fw-bold me-2" style="color: #666;">{{ goodsIndex + 1 }}.</span>
                                            <span v-if="disId != null && goods.nxDgDistributerId != null && goods.nxDgDistributerId !== disId && goods.goodsNxDistributerName"
                                                  class="font-xs text-primary me-1">[{{ goods.goodsNxDistributerName }}]</span>
                                            <span v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'"
                                                  class="badge bg-warning text-dark me-1">
                                        {{ goods.nxDgGoodsBrand }}
                                    </span>
                                            <span class="text-dark">{{ goods.nxDgGoodsName }}</span>
                                            <span class="text-muted small ms-1"
                                                  v-if="goods.nxDgItemsPerCarton && goods.nxDgItemsPerCarton !== 'null'">
                                        ({{ goods.nxDgGoodsStandardWeight + '/' +  goods.nxDgGoodsStandardname  + '*' + goods.nxDgItemsPerCarton + '/' + goods.nxDgCartonUnit }})
                                    </span>

                                            <span v-else>

                                        <span class="text-muted small ms-1">
                                        ({{ goods.nxDgGoodsStandardWeight && goods.nxDgGoodsStandardWeight !== 'null'
                                          ? goods.nxDgGoodsStandardWeight + '/' + goods.nxDgGoodsStandardname
                                          : goods.nxDgGoodsStandardname }})
                                    </span>
                                    </span>

                                        </div>

                                        <!-- 历史订货记录 -->
                                        <div v-if="goods.departmentDisGoodsEntity != null" class="mt-2 d-flex"
                                             style="font-size: 14px; padding-left: 24px; gap: 20px; flex-wrap: nowrap;">
                                            <!--                                    时间-->
                                            <span style="white-space: nowrap;">
                                        <span>上次订货:</span>
                                        <span>{{goods.departmentDisGoodsEntity.nxDdgOrderDate}}</span>
                                    </span>
                                            <!--                                    价格-->
                                            <span style="white-space: nowrap;">
                                        <span>单价:</span>
                                        <span>{{goods.departmentDisGoodsEntity.nxDdgOrderPrice}}/{{goods.nxDgGoodsStandardname}}</span>
                                    </span>
                                            <!--                                    订货-->
                                            <span style="white-space: nowrap;">
                                        <span>订货:</span>
                                        <span>{{goods.departmentDisGoodsEntity.nxDdgOrderQuantity}}</span>
                                        <span v-if="goods.departmentDisGoodsEntity.nxDdgOrderStandard">{{goods.departmentDisGoodsEntity.nxDdgOrderStandard}}</span>
                                    </span>
                                        </div>
                                    </div>

                                    <!-- 选择按钮 -->
                                    <button
                                            class="btn btn-secondary btn-sm align-self-center"
                                            @click.stop="$emit('select-search-result', { goods, orderIndex })"
                                            :class="{ 'btn-warning': !goods.nxDgNxGoodsId }"
                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; background-color: #6c757d; border-color: #6c757d; color: #fff;">
                                        {{ goods.nxDgNxGoodsId ? '选择' : '临时' }}
                                    </button>
                                </div>
                            </div>

                            <!-- 系统商品列表 -->
                            <div v-if="nxArr.length > 0" class="mb-2">
                                <div class="text-muted small fw-bold mb-2">新商品 ({{ nxArr.length }})
                                </div>
                                <div
                                        v-for="(goods, goodsIndex) in nxArr"
                                        :key="goods.nxGoodsId || goodsIndex"
                                        class="goods-item p-2 mb-1 rounded hover-bg d-flex align-items-center justify-content-between"
                                        :class="{ 'goods-item-selected': selectedSearchResultIndex === strArr.length + goodsIndex }"
                                        :data-goods-index="strArr.length + goodsIndex"
                                        @click.stop="$emit('download-goods-nx', { goods, orderIndex })"
                                        style="cursor: pointer; background-color: #ffffff; border-bottom: 1px solid #f0f0f0; padding: 12px 16px;">
                                    <!-- 商品信息 -->
                                    <div class="flex-grow-1" style="min-width: 0;">
                                        <span class="text-muted fw-bold me-2" style="color: #666;">{{ strArr.length + goodsIndex + 1 }}.</span>
                                        <span v-if="goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null'"
                                              class="badge bg-warning text-dark me-1">
                                    {{ goods.nxGoodsBrand }}
                                </span>
                                        <span class="text-dark">{{ goods.nxGoodsName }}</span>
                                        <span class="text-muted small ms-1"
                                              v-if="goods.nxGoodsItemsPerCarton && goods.nxGoodsItemsPerCarton !== 'null'">
                                    ({{goods.nxGoodsStandardWeight + '/' + goods.nxGoodsStandardname + '*' + goods.nxGoodsItemsPerCarton + '/' + goods.nxGoodsCartonUnit}})
                                </span>
                                        <span v-else>

                                    <span class="text-muted small ms-1">
                                    ({{ goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'
                                      ? goods.nxGoodsStandardWeight + '/' + goods.nxGoodsStandardname
                                      : goods.nxGoodsStandardname }})
                                </span>


                                </span>


                                    </div>
                                    <!-- 下载按钮 -->
                                    <button
                                            class="btn btn-info btn-sm"
                                            @click.stop="$emit('download-goods-nx', { goods, orderIndex })"
                                            style="flex-shrink: 0; min-width: 53px; padding: 4px 8px; font-size: 12px; margin-left: 8px;"
                                            title="下载商品">
                                        ⬇️
                                    </button>
                                </div>
                            </div>
                        </div>
                    </transition>
                </div>

                <div style="padding: 6rem 0;font-size:12px; color:#373b3e; text-align:center; margin-bottom:3rem;"
                     v-if="orderItems.length > 0">没有订单了！
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
import controller from '../services/orderEditorController';

export default controller;
</script>

<style scoped>
    /* 表头单元格样式 */
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

    .form-control {
        border: 1px solid red;
    }

    /* 商品列表选中项高亮（键盘上下键选择） */
    .goods-item-selected {
        background-color: rgba(13, 202, 240, 0.2) !important;
        border: 1px solid #0dcaf0 !important;
        box-shadow: 0 0 0 1px #0dcaf0;
    }

    /* 匹配商品容器样式增强 */
    .matched-goods-container {
        animation: pulse-border 2s ease-in-out infinite;
    }

    @keyframes pulse-border {
        0%, 100% {
            box-shadow: 0 2px 8px rgba(13, 202, 240, 0.2);
        }
        50% {
            box-shadow: 0 2px 12px rgba(13, 202, 240, 0.35);
        }
    }

    /* 搜索结果列表动画效果 */
    .search-results-enter-active {
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .search-results-leave-active {
        transition: all 0.3s ease-in;
    }

    .search-results-enter-from {
        opacity: 0;
        transform: translateY(-15px) scale(0.92);
    }

    .search-results-enter-to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }

    .search-results-leave-from {
        opacity: 1;
        transform: translateY(0) scale(1);
    }

    .search-results-leave-to {
        opacity: 0;
        transform: translateY(-8px) scale(0.96);
    }

    /* 播放器样式 */
    .tts-player-container {
        position: relative;
        overflow: hidden;
    }

    .tts-player-container::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
        pointer-events: none;
    }

    .tts-player-content {
        position: relative;
        z-index: 1;
        transition: all 0.3s ease;
    }

    .tts-player-content:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    /* 搜索结果容器样式增强 */
    .search-results-container {
        animation: pulse-border-yellow 2.5s ease-in-out infinite;
    }

    @keyframes pulse-border-yellow {
        0%, 100% {
            box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3);
        }
        50% {
            box-shadow: 0 2px 14px rgba(255, 193, 7, 0.45);
        }
    }
</style>
