<template>
    <div class="product-panel border bg-white">
        <div class="d-flex justify-content-between align-items-center p-2 border-bottom product-panel__header">
            <span class="small text-muted">搜索结果</span>
            <button
                    class="btn btn-sm btn-link p-0 product-panel__close"
                    type="button"
                    @click="$emit('close')">
                ✕ 关闭
            </button>
        </div>

        <section v-if="form.disArr?.length">
            <div class="text-muted small fw-bold p-2 border-bottom">
                配送商品 ({{ form.disArr.length }})
            </div>
            <div
                    v-for="(goods, idx) in form.disArr"
                    :key="goods?.nxDistributerGoodsId || idx"
                    class="p-2 border-bottom product-panel__row"
                    :data-search-index="idx"
                    :style="{ backgroundColor: form.selectedSearchIndex === idx ? 'rgba(13, 110, 253, 0.1)' : (idx % 2 === 0 ? '#fff' : '#f8f9fa') }"
                    @click="$emit('select', goods)">
                <div class="d-flex">
                    <div class="flex-grow-1" style="min-width: 0;">
                        <div v-if="goods">
                            <span class="text-muted fw-bold me-2">{{ idx + 1 }}.</span>
                            <span
                                    v-if="disId != null && goods.nxDgDistributerId != null && goods.nxDgDistributerId !== disId && goods.goodsNxDistributerName"
                                    class="font-xs text-primary me-1">
                                [{{ goods.goodsNxDistributerName }}]
                            </span>
                            <span
                                    v-if="goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null'"
                                    class="badge bg-warning text-dark me-1">
                                {{ goods.nxDgGoodsBrand }}
                            </span>
                            <span>{{ goods.nxDgGoodsName }}</span>
                            <span v-if="goods.nxDgItemsPerCarton" class="ms-2">
                                ({{ goods.nxDgGoodsStandardWeight }} *{{ goods.nxDgItemsPerCarton }}/{{ goods.nxDgCartonUnit }})
                            </span>
                            <span v-else>
                                <span v-if="goods.nxDgGoodsStandardWeight" class="ms-2">
                                    ({{ goods.nxDgGoodsStandardWeight }}/{{ goods.nxDgGoodsStandardname }})
                                </span>
                                <span v-else class="ms-2">({{ goods.nxDgGoodsStandardname || '' }})</span>
                            </span>
                        </div>
                        <div
                                v-if="goods?.departmentDisGoodsEntity !== null"
                                class="mt-2 d-flex product-panel__history">
                            <span>
                                <span>上次订货:</span>
                                <span>{{ goods.departmentDisGoodsEntity.nxDdgOrderDate }}</span>
                            </span>
                            <span>
                                <span>单价:</span>
                                <span>{{ goods.departmentDisGoodsEntity.nxDdgOrderPrice }}/{{ goods.nxDgGoodsStandardname }}</span>
                            </span>
                            <span>
                                <span>订货:</span>
                                <span>{{ goods.departmentDisGoodsEntity.nxDdgOrderQuantity }}</span>
                                <span v-if="goods.departmentDisGoodsEntity.nxDdgOrderStandard">
                                    {{ goods.departmentDisGoodsEntity.nxDdgOrderStandard }}
                                </span>
                            </span>
                        </div>
                    </div>
                    <div class="align-self-center product-panel__action">
                        <span class="badge bg-secondary">选择</span>
                    </div>
                </div>
            </div>
        </section>

        <section v-if="form.nxArr?.length">
            <div class="text-muted small fw-bold p-2 border-bottom">
                系统商品 ({{ form.nxArr.length }})
            </div>
            <div
                    v-for="(goods, idx) in form.nxArr"
                    :key="goods?.nxGoodsId || idx"
                    class="p-2 border-bottom product-panel__row"
                    :data-search-index="(form.disArr?.length || 0) + idx"
                    :style="{ backgroundColor: form.selectedSearchIndex === (form.disArr?.length || 0) + idx ? 'rgba(13, 110, 253, 0.1)' : (idx % 2 === 0 ? '#fff' : '#f8f9fa') }">
                <div v-if="goods" class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="text-muted fw-bold me-2">{{ idx + 1 }}.</span>
                        <span
                                v-if="disId != null && goods.nxDgDistributerId != null && goods.nxDgDistributerId !== disId && goods.goodsNxDistributerName"
                                class="font-xs text-primary me-1">
                            [{{ goods.goodsNxDistributerName }}]
                        </span>
                        <span
                                v-if="(goods.nxDgGoodsBrand && goods.nxDgGoodsBrand !== 'null') || (goods.nxGoodsBrand && goods.nxGoodsBrand !== 'null')"
                                class="badge bg-warning text-dark me-1">
                            {{ goods.nxDgGoodsBrand || goods.nxGoodsBrand }}
                        </span>
                        <span>{{ goods.nxGoodsName }}</span>
                        <span
                                v-if="goods.nxGoodsItemsPerCarton && goods.nxGoodsItemsPerCarton !== 'null'"
                                class="ms-2">
                            ({{ (goods.nxGoodsStandardWeight || '') + '/' + (goods.nxGoodsStandardname || '') + '*' + goods.nxGoodsItemsPerCarton }}{{ goods.nxGoodsStandardname }}/{{ goods.nxGoodsCartonUnit || '' }})
                        </span>
                        <span v-else class="ms-2">
                            ({{ goods.nxGoodsStandardWeight && goods.nxGoodsStandardWeight !== 'null'
                                ? (goods.nxGoodsStandardWeight || '') + '/' + (goods.nxGoodsStandardname || '')
                                : (goods.nxGoodsStandardname || '') }})
                        </span>
                    </div>
                    <button
                            class="btn btn-info btn-sm product-panel__download"
                            type="button"
                            title="下载商品"
                            @click.stop="$emit('download', { goods, orderIndex })">
                        ⬇️
                    </button>
                </div>
            </div>
        </section>
    </div>
</template>

<script>
export default {
    name: 'ProductPanel',
    props: {
        form: {
            type: Object,
            required: true
        },
        disId: {
            type: [Number, String],
            default: null
        },
        orderIndex: {
            type: Number,
            required: true
        }
    },
    emits: ['close', 'select', 'download']
};
</script>

<style scoped>
.product-panel {
    position: absolute;
    z-index: 1000;
    width: 100%;
    max-height: 300px;
    margin-top: 4px;
    overflow-y: auto;
    border-radius: 3px;
    box-shadow: 0 8px 20px rgba(23, 38, 54, 0.12);
}

.product-panel__header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f8f9fa;
}

.product-panel__close {
    color: #856404;
    font-size: 14px;
    text-decoration: none;
}

.product-panel__row {
    cursor: pointer;
}

.product-panel__history {
    gap: 20px;
    margin-left: 24px;
    font-size: 12px;
    flex-wrap: nowrap;
}

.product-panel__history > span {
    white-space: nowrap;
}

.product-panel__action {
    flex-shrink: 0;
    margin-left: 40px;
}

.product-panel__download {
    flex-shrink: 0;
    min-width: 53px;
    margin-left: 8px;
    padding: 4px 8px;
    font-size: 12px;
}
</style>
