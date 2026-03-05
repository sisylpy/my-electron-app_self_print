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
            <div style="width: 240px; flex-shrink: 0;" class="text-center table-cell">操作
            </div>
        </div>
        <!-- 订单列表 -->
        <div style="padding: 0.5rem; flex: 1; min-height: 0; overflow-y: auto;">
            <div
                v-for="(item, orderIndex) in orderItems"
                :key="orderIndex"
                ref="orderItemRefs"
                class="order-item-card mb-1 p-1 bg-white rounded border-bottom"
                :class="{ 'order-item-selected': selectedOrderIndex === orderIndex }"
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
                            placeholder="请输入商品名称"
                            style="font-size: 14px; background-color: transparent; width: 100%;"
                        />
                    </div>
                    <!-- 数量 -->
                    <div style="width: 80px; flex-shrink: 0;">
                        <input
                            type="number"
                            class="form-control form-control-sm text-center"
                            :value="item.nxDoQuantity"
                            @input="$emit('quantity-input', { item, orderIndex, value: $event.target.value })"
                            placeholder="数量"
                            style="background-color: transparent;"
                        />
                    </div>
                    <!-- 规格 -->
                    <div style="width: 80px; flex-shrink: 0;">
                        <input
                            type="text"
                            class="form-control form-control-sm text-center"
                            :value="item.nxDoStandard"
                            @input="$emit('standard-change', { item, orderIndex, value: $event.target.value })"
                            placeholder="规格"
                            style="background-color: transparent;"
                        />
                    </div>
                    <!-- 操作按钮 -->
                    <div class="draft-actions" style="width: 240px; flex-shrink: 0;">
                        <button type="button" class="draft-btn draft-btn-delete"
                                @click="$emit('delete-order', { item, orderIndex })">
                            <span class="draft-btn-icon">×</span> 删除
                        </button>
                        <button type="button" class="draft-btn draft-btn-add"
                                @click="$emit('add-order-before', { orderIndex })">
                            <span class="draft-btn-icon">+</span> 新订单
                        </button>
                        <button type="button" class="draft-btn draft-btn-remark"
                                :class="{ 'draft-btn-remark-active': item.nxDoAddRemark }"
                                @click="item.nxDoAddRemark ? $emit('clear-remark', { item, orderIndex }) : $emit('add-remark', { item, orderIndex })">
                            <span class="draft-btn-icon">※</span> 备注
                        </button>
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
                                      placeholder="规格重量"
                                      style="width: 90px;"
                              />
                              <span class="text-muted small mx-1">/</span>
                              <input
                                      type="text"
                                      class="form-control form-control-sm"
                                      :value="item.itemUnit"
                                      @input="$emit('remark-input', { item, orderIndex, value: $event.target.value, field: 'itemUnit' })"
                                      :disabled="item.nxDoStatus === 0"
                                      placeholder="商品单位"
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
                                      placeholder="数量"
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
                                      placeholder="大包装"
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
                              placeholder="备注"
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
        if (this.selectedOrderIndex >= 0) {
            this.$nextTick(() => this.scrollToSelected());
        }
    },
    methods: {
        scrollToSelected() {
            const idx = this.selectedOrderIndex;
            if (idx < 0) return;
            const refs = this.$refs.orderItemRefs;
            const el = Array.isArray(refs) ? refs[idx] : (refs && refs[idx]);
            const node = el && el.$el ? el.$el : el;
            if (node && typeof node.scrollIntoView === 'function') {
                node.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    /* 草稿行操作按钮 */
    .draft-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 200px;
        flex-shrink: 0;
    }

    .draft-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        padding: 4px 10px;
        font-size: 12px;
        font-weight: 500;
        line-height: 1.3;
        border: 1px solid transparent;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.15s, border-color 0.15s, transform 0.1s;
    }

    .draft-btn:hover {
        transform: translateY(-1px);
    }

    .draft-btn:active {
        transform: translateY(0);
    }

    .draft-btn-icon {
        font-size: 14px;
        line-height: 1;
        opacity: 0.85;
    }

    .draft-btn-delete {
        color: #c82333;
        background: #fff;
        border: 1px solid #e8b4b8;
    }

    .draft-btn-delete:hover {
        border-color: #c82333;
        background: #fff5f5;
    }

    .draft-btn-add {
        color: #0a58ca;
        background: #fff;
        border: 1px solid #a5c8f7;
    }

    .draft-btn-add:hover {
        border-color: #0a58ca;
        background: #f0f7ff;
    }

    .draft-btn-remark {
        color: #6c757d;
        background: #fff;
        border: 1px solid #dee2e6;
    }

    .draft-btn-remark:hover {
        border-color: #6c757d;
        background: #f8f9fa;
    }

    .draft-btn-remark.draft-btn-remark-active {
        color: #0a58ca;
        border-color: #0a58ca;
        background: #f0f7ff;
    }

    .draft-btn-remark.draft-btn-remark-active:hover {
        border-color: #084298;
        background: #e7f1ff;
    }
</style>

