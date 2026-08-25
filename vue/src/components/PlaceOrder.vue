<template>
  <PlaceOrderWorkspace v-bind="$attrs" />
</template>

<script>
import PlaceOrderWorkspace from '@/modules/order/components/PlaceOrderWorkspace.vue';

/**
 * 兼容入口：历史代码仍可从 components/PlaceOrder.vue 引入。
 * ProductShell 与 Bills 已转向模块实现，业务逻辑只保留一份。
 */
export default {
  name: 'PlaceOrder',
  inheritAttrs: false,
  components: {
    PlaceOrderWorkspace,
  },
};
</script>
