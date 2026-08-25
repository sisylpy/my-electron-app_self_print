<template>
  <OrderEditor v-bind="$attrs" />
</template>

<script>
import OrderEditor from '@/modules/order/components/OrderEditor.vue';

/**
 * OrderList 历史兼容入口。
 * 新代码应直接使用 order/components/OrderEditor，避免继续扩大根 components。
 */
export default {
  name: 'OrderList',
  inheritAttrs: false,
  components: {
    OrderEditor,
  },
};
</script>
