<template>
  <div class="today-order-actions">
    <button
      v-if="policy.canModify"
      class="btn btn-sm btn-secondary"
      type="button"
      @click="$emit('modify')"
    >
      修改
    </button>
    <button
      v-if="policy.canFinishOutbound"
      class="btn btn-sm btn-success"
      type="button"
      :disabled="busy"
      @click="$emit('finish-outbound')"
    >
      {{ busyAction === 'finish-outbound' ? '处理中…' : '完成出库' }}
    </button>
    <button
      v-if="policy.canRestock"
      class="btn btn-sm btn-outline-primary"
      type="button"
      :disabled="busy"
      @click="$emit('restock')"
    >
      {{ busyAction === 'restock' ? '处理中…' : '重新出库' }}
    </button>
    <button
      v-if="policy.canFinishDelivery"
      class="btn btn-sm btn-outline-success"
      type="button"
      :disabled="busy"
      @click="$emit('finish-delivery')"
    >
      {{ busyAction === 'finish-delivery' ? '处理中…' : '完成送货' }}
    </button>
    <button
      v-if="policy.canCancelDelivery"
      class="btn btn-sm btn-outline-warning"
      type="button"
      :disabled="busy"
      @click="$emit('cancel-delivery')"
    >
      {{ busyAction === 'cancel-delivery' ? '处理中…' : '撤回送货' }}
    </button>
    <button
      v-if="policy.canDelete"
      class="btn btn-sm btn-danger"
      type="button"
      @click="$emit('delete')"
    >
      删除
    </button>
    <button
      v-if="showMore"
      class="btn btn-sm btn-light border"
      type="button"
      title="更多订单操作"
      @click="$emit('more')"
    >
      更多
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { getTodayOrderActionPolicy } from '../modules/order/services/todayOrderActionPolicy';

const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
  busyAction: {
    type: String,
    default: '',
  },
});

defineEmits([
  'modify',
  'delete',
  'finish-outbound',
  'restock',
  'finish-delivery',
  'cancel-delivery',
  'more',
]);

const policy = computed(() => getTodayOrderActionPolicy(props.order));
const busy = computed(() => Boolean(props.busyAction));
const showMore = computed(() => (
  policy.value.canReplaceGoods
  || policy.value.canInsertBefore
  || policy.value.canViewGoods
));
</script>

<style scoped>
.today-order-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
}

.today-order-actions .btn {
  min-height: 27px;
  padding: 3px 7px;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.2;
}
</style>
