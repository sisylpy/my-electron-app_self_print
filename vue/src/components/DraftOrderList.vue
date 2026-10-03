<template>
    <div class="order-list-container flex-grow-1 d-flex flex-column"
         style="flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; border: 1px solid #dee2e6; border-radius: 0.375rem; padding: 0;">
        <div v-if="orderItems.length === 0"
             class="text-center text-muted p-4 d-flex flex-column align-items-center justify-content-center"
             style="flex: 1; min-height: 0;">
            <div class="mb-2">📋 暂无订单</div>
            <small>{{ emptyMessage }}</small>
        </div>
        <!-- 表头 -->
        <div v-if="orderItems.length > 0"
             class="table-header-fixed bg-light border-bottom p-1 d-flex align-items-center fw-bold small"
             style="position: sticky; top: 0; z-index: 10; background-color: #eeeeee;">
            <div style="width: 40px; flex-shrink: 0; margin-left: 15px;"
                 class="text-center table-cell">序号
            </div>
            <div style="flex: 2; min-width: 0;" class="table-cell">商品名称</div>
            <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">数量
            </div>
            <div style="width: 80px; flex-shrink: 0;" class="text-center table-cell">规格
            </div>
            <div style="width: 82px; flex-shrink: 0;" class="text-center table-cell">操作
            </div>
        </div>
        <!-- 订单列表 -->
        <div style="padding: 0.5rem; flex: 1; min-height: 0; overflow-y: auto;">
            <div
                v-for="(item, orderIndex) in orderItems"
                :key="orderIndex"
                ref="orderItemRefs"
                class="order-item-card mb-1 p-1 bg-white rounded border-bottom"
                :class="{
                    'order-item-selected': selectedOrderIndex === orderIndex,
                    'is-actions-open': openActionIndex === orderIndex
                }"
                style="position: relative;">

                <!-- 第一行：序号、商品名称、数量、规格 -->
                <div class="d-flex align-items-center gap-2 mb-1" style="min-height: 32px;">
                    <!-- 序号 -->
                    <div style="width: 30px; flex-shrink: 0; margin-left: 15px;"
                         class="text-center fw-bold">
                        {{ orderIndex + 1 }}.
                    </div>
                    <!-- 商品名称输入框（草稿状态下只编辑，不搜索） -->
                    <div style="flex: 2; min-width: 0;">
                        <input
                            type="text"
                            class="form-control form-control-sm"
                            :value="item.nxDoGoodsName"
                            @input="$emit('goods-name-input', { item, orderIndex, value: $event.target.value })"
                            @keydown.enter="handleGoodsNameEnter(orderIndex)"
                            :ref="`draft-goods-name-${orderIndex}`"
                            style="font-size: 16px; background-color: transparent; width: 100%;"
                        />
                    </div>
                    <!-- 数量 -->
                    <div style="width: 80px; flex-shrink: 0;">
                        <input
                            type="number"
                            class="form-control form-control-sm text-center"
                            :value="item.nxDoQuantity"
                            @input="$emit('quantity-input', { item, orderIndex, value: $event.target.value })"
                            @keydown.enter="handleQuantityEnter(orderIndex)"
                            :ref="`draft-quantity-${orderIndex}`"
                            style="background-color: transparent; font-size: 16px;"
                        />
                    </div>
                    <!-- 规格 -->
                    <div style="width: 80px; flex-shrink: 0;">
                        <input
                            type="text"
                            class="form-control form-control-sm text-center"
                            :value="item.nxDoStandard"
                            @input="$emit('standard-change', { item, orderIndex, value: $event.target.value })"
                            @keydown.enter="handleStandardEnter($event)"
                            :ref="`draft-standard-${orderIndex}`"
                            style="background-color: transparent; font-size: 16px;"
                        />
                    </div>
                    <!-- 操作按钮 -->
                    <div class="draft-actions">
                        <button
                            type="button"
                            class="draft-actions-trigger"
                            aria-haspopup="menu"
                            :aria-expanded="openActionIndex === orderIndex"
                            :aria-controls="`draft-actions-menu-${orderIndex}`"
                            @click.stop="toggleActionMenu(orderIndex)"
                            @keydown.esc.stop="closeActionMenu"
                        >
                            <span>操作</span>
                            <span class="draft-actions-chevron" aria-hidden="true">⌄</span>
                        </button>
                        <div
                            v-if="openActionIndex === orderIndex"
                            :id="`draft-actions-menu-${orderIndex}`"
                            class="draft-actions-menu"
                            role="menu"
                            @click.stop
                            @keydown.esc.stop="closeActionMenu"
                        >
                            <button type="button" class="draft-action-item draft-action-item--delete"
                                    role="menuitem"
                                    @click="handleDeleteOrder(item, orderIndex)">
                                <span class="draft-btn-icon">×</span> 删除
                            </button>
                            <button type="button" class="draft-action-item draft-action-item--add"
                                    role="menuitem"
                                    @click="handleAddOrderBefore(orderIndex)">
                                <span class="draft-btn-icon">+</span> 新订单
                            </button>
                            <button type="button" class="draft-action-item draft-action-item--remark"
                                    :class="{ 'is-active': item.nxDoAddRemark }"
                                    role="menuitem"
                                    @click="handleRemarkClick(orderIndex)">
                                <span class="draft-btn-icon">※</span>
                                {{ item.nxDoAddRemark ? '移除备注' : '备注' }}
                            </button>
                        </div>
                    </div>
                </div>
                <!-- 规格信息显示行（standardWeight/itemUnit/itemsPerCarton/cartonUnit 任一有值则显示） -->

<!--                || (item.itemUnit && item.itemUnit !== 'null') || (item.itemsPerCarton && item.itemsPerCarton !== 'null' && item.itemsPerCarton !== '') || (item.cartonUnit && item.cartonUnit !== 'null')-->
                  <div v-if="(item.standardWeight && item.standardWeight !== 'null') "
                       class="mt-2 "
                       style="padding: 8px 12px; margin-left: 50px; ">
                      <div class="d-flex align-items-center gap-3 flex-wrap">
                          <!-- 规格单位 -->
                          <div class="d-flex align-items-center gap-1">

                              <input
                                      type="text"
                                      class="form-control form-control-sm"
                                      :value="item.standardWeight"
                                      @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'standardWeight' })"
                                      :disabled="item.nxDoStatus === 0"
                                      style="width: 90px;"
                              />
                              <span class="text-muted small mx-1">/</span>
                              <input
                                      type="text"
                                      class="form-control form-control-sm"
                                      :value="item.itemUnit"
                                      @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'itemUnit' })"
                                      :disabled="item.nxDoStatus === 0"
                                      style="width: 70px;"
                              />
                          </div>

                          <div class="d-flex align-items-center gap-1" v-if="item.cartonUnit && item.cartonUnit !== 'null'" >

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
                  <div v-if="item.nxDoAddRemark"
                       class="d-flex align-items-center gap-2 mt-1 ps-5">
                      <input
                              type="text"
                              class="form-control form-control-sm"
                              :value="item.nxDoRemark"
                              @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'nxDoRemark' })"
                              :ref="`draft-remark-${orderIndex}`"
                              maxlength="15"
                              style="margin-left:30px;font-size: 12px; background-color: transparent; width: 300px; flex-shrink: 0;"
                      />
                  </div>


            </div>

        <div style="line-height: 100px; text-align:center; font-size:12px; " v-if="orderItems.length > 0">没有订单了！</div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'DraftOrderList',
    data() {
        return {
            openActionIndex: -1
        };
    },
    props: {
        orderItems: {
            type: Array,
            default: () => []
        },
        emptyMessage: {
            type: String,
            default: '请粘贴订单文本并解析后，系统将显示订单列表'
        },
        addingOrderBeforeIndex: {
            type: Number,
            default: -1
        },
        beforeOrderForm: {
            type: Object,
            default: () => ({
                goodsName: '',
                quantity: '',
                standard: '',
                remark: '',
                selectedGoods: null,
                showSearchResults: false,
                searchResults: []
            })
        },
        /** 要滚动并选中的订单序号（0-based），-1 表示不选中 */
        selectedOrderIndex: {
            type: Number,
            default: -1
        }
    },
    emits: [
        'cancel-add-order-before',
        'before-order-goods-name-input',
        'select-before-order-goods',
        'before-order-quantity-input',
        'before-order-standard-input',
        'before-order-remark-input',
        'save-before-order',
        'goods-name-input',
        'quantity-input',
        'standard-change',
        'delete-order',
        'add-order-before',
        'add-remark',
        'clear-remark',
        'remark-input'
    ],
    watch: {
        selectedOrderIndex(val) {
            if (val >= 0 && this.orderItems && this.orderItems.length > val) {
                this.$nextTick(() => this.scrollToSelected());
            }
        }
    },
    mounted() {
        document.addEventListener('pointerdown', this.handleDocumentPointerDown);
        if (this.selectedOrderIndex >= 0) {
            this.$nextTick(() => this.scrollToSelected());
        }
    },
    beforeUnmount() {
        document.removeEventListener('pointerdown', this.handleDocumentPointerDown);
    },
    methods: {
        toggleActionMenu(orderIndex) {
            this.openActionIndex = this.openActionIndex === orderIndex ? -1 : orderIndex;
        },
        closeActionMenu() {
            this.openActionIndex = -1;
        },
        handleDocumentPointerDown(event) {
            if (this.openActionIndex < 0) return;
            if (!event.target?.closest?.('.draft-actions')) {
                this.closeActionMenu();
            }
        },
        handleDeleteOrder(item, orderIndex) {
            this.closeActionMenu();
            this.$emit('delete-order', { item, orderIndex });
        },
        scrollToSelected() {
            const idx = this.selectedOrderIndex;
            if (idx < 0) return;
            const refs = this.$refs.orderItemRefs;
            const el = Array.isArray(refs) ? refs[idx] : (refs && refs[idx]);
            const node = el && el.$el ? el.$el : el;
            if (node && typeof node.scrollIntoView === 'function') {
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        handleGoodsNameEnter(orderIndex) {
            console.log('🟢 [DraftOrderList] 商品名称回车, orderIndex:', orderIndex);
            this.$nextTick(() => {
                const refKey = `draft-quantity-${orderIndex}`;
                console.log('🟢 [DraftOrderList] refKey:', refKey);
                const quantityRef = this.$refs[refKey];
                console.log('🟢 [DraftOrderList] quantityRef:', quantityRef);
                console.log('🟢 [DraftOrderList] quantityRef isArray:', Array.isArray(quantityRef));
                const targetRef = Array.isArray(quantityRef) ? quantityRef[0] : quantityRef;
                if (targetRef && typeof targetRef.focus === 'function') {
                    targetRef.focus();
                    console.log('🟢 [DraftOrderList] 已聚焦到数量输入框');
                } else {
                    console.warn('🔴 [DraftOrderList] targetRef 不存在或没有 focus 方法');
                }
            });
        },
        handleQuantityEnter(orderIndex) {
            console.log('🟢 [DraftOrderList] 数量回车, orderIndex:', orderIndex);
            this.$nextTick(() => {
                const refKey = `draft-standard-${orderIndex}`;
                console.log('🟢 [DraftOrderList] refKey:', refKey);
                const standardRef = this.$refs[refKey];
                console.log('🟢 [DraftOrderList] standardRef:', standardRef);
                console.log('🟢 [DraftOrderList] standardRef isArray:', Array.isArray(standardRef));
                const targetRef = Array.isArray(standardRef) ? standardRef[0] : standardRef;
                if (targetRef && typeof targetRef.focus === 'function') {
                    targetRef.focus();
                    console.log('🟢 [DraftOrderList] 已聚焦到规格输入框');
                } else {
                    console.warn('🔴 [DraftOrderList] targetRef 不存在或没有 focus 方法');
                }
            });
        },
        handleStandardEnter(event) {
            console.log('🟢 [DraftOrderList] 规格回车，失去焦点');
            event.target.blur();
        },
        handleAddOrderBefore(orderIndex) {
            this.closeActionMenu();
            console.log('🟢 [DraftOrderList] 点击新订单, orderIndex:', orderIndex);
            this.$emit('add-order-before', { orderIndex });
            this.$nextTick(() => {
                const refKey = `draft-goods-name-${orderIndex}`;
                console.log('🟢 [DraftOrderList] refKey:', refKey);
                const goodsNameRef = this.$refs[refKey];
                console.log('🟢 [DraftOrderList] goodsNameRef:', goodsNameRef);
                console.log('🟢 [DraftOrderList] goodsNameRef isArray:', Array.isArray(goodsNameRef));
                const targetRef = Array.isArray(goodsNameRef) ? goodsNameRef[0] : goodsNameRef;
                if (targetRef && typeof targetRef.focus === 'function') {
                    targetRef.focus();
                    console.log('🟢 [DraftOrderList] 已聚焦到商品名称输入框');
                } else {
                    console.warn('🔴 [DraftOrderList] targetRef 不存在或没有 focus 方法');
                }
            });
        },
        handleRemarkClick(orderIndex) {
            this.closeActionMenu();
            const item = this.orderItems[orderIndex];
            console.log('🟢 [DraftOrderList] 点击备注按钮, orderIndex:', orderIndex, 'nxDoAddRemark:', item.nxDoAddRemark);

            if (item.nxDoAddRemark) {
                // 如果已有备注，清除备注
                this.$emit('clear-remark', { item, orderIndex });
            } else {
                // 如果没有备注，添加备注并聚焦到输入框
                this.$emit('add-remark', { item, orderIndex });
                this.$nextTick(() => {
                    const refKey = `draft-remark-${orderIndex}`;
                    console.log('🟢 [DraftOrderList] refKey:', refKey);
                    const remarkRef = this.$refs[refKey];
                    console.log('🟢 [DraftOrderList] remarkRef:', remarkRef);
                    console.log('🟢 [DraftOrderList] remarkRef isArray:', Array.isArray(remarkRef));
                    const targetRef = Array.isArray(remarkRef) ? remarkRef[0] : remarkRef;
                    if (targetRef && typeof targetRef.focus === 'function') {
                        targetRef.focus();
                        console.log('🟢 [DraftOrderList] 已聚焦到备注输入框');
                    } else {
                        console.warn('🔴 [DraftOrderList] targetRef 不存在或没有 focus 方法');
                    }
                });
            }
        }
    }
}
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

    /* 订单选中状态 */
    .order-item-card.order-item-selected {
        background-color: #e7f1ff !important;
        border-color: #0056b3 !important;
        border-width: 1px 1px 1px 3px;
        border-left: 3px solid #0056b3;
        box-shadow: 0 0 0 1px rgba(0, 86, 179, 0.2);
    }

    /* 草稿行操作菜单：常态只占一个紧凑按钮的宽度 */
    .order-item-card.is-actions-open {
        z-index: 20;
    }

    .draft-actions {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 82px;
        flex-shrink: 0;
    }

    .draft-actions-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-width: 66px;
        padding: 5px 10px;
        color: #40564b;
        background: #fff;
        border: 1px solid #bfd2c8;
        border-radius: 7px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.3;
        cursor: pointer;
        transition: color .15s, background-color .15s, border-color .15s, box-shadow .15s;
    }

    .draft-actions-trigger:hover,
    .draft-actions-trigger[aria-expanded="true"] {
        color: #087443;
        background: #f2fbf6;
        border-color: #55ae7d;
        box-shadow: 0 2px 8px rgba(20, 118, 72, .12);
    }

    .draft-actions-chevron {
        font-size: 14px;
        line-height: 1;
        transition: transform .15s ease;
    }

    .draft-actions-trigger[aria-expanded="true"] .draft-actions-chevron {
        transform: rotate(180deg);
    }

    .draft-actions-menu {
        position: absolute;
        top: calc(100% + 5px);
        right: 8px;
        z-index: 100;
        display: grid;
        width: 132px;
        padding: 5px;
        background: #fff;
        border: 1px solid #d7e2dc;
        border-radius: 9px;
        box-shadow: 0 9px 24px rgba(30, 61, 46, .18);
    }

    .draft-action-item {
        display: flex;
        align-items: center;
        gap: 7px;
        width: 100%;
        padding: 7px 9px;
        color: #44554d;
        background: transparent;
        border: 0;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
    }

    .draft-action-item:hover,
    .draft-action-item:focus-visible {
        color: #0a6f43;
        background: #eef8f3;
        outline: none;
    }

    .draft-btn-icon {
        font-size: 14px;
        line-height: 1;
        opacity: 0.85;
    }

    .draft-action-item--delete {
        color: #c82333;
    }

    .draft-action-item--delete:hover,
    .draft-action-item--delete:focus-visible {
        color: #a91624;
        background: #fff5f5;
    }

    .draft-action-item--add {
        color: #0a58ca;
    }

    .draft-action-item--add:hover,
    .draft-action-item--add:focus-visible {
        color: #084298;
        background: #f0f7ff;
    }

    .draft-action-item--remark.is-active {
        color: #0a58ca;
        background: #f0f7ff;
    }
</style>


