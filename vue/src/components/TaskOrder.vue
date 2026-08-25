<template>
  <TaskOrderWorkspace v-bind="$attrs" />
</template>

<script>
import TaskOrderWorkspace from '@/modules/order/components/TaskOrderWorkspace.vue';

/**
 * 兼容入口：旧路径保留，避免外部扩展失效。
 * Bills 使用模块实现，以保留 clearTaskStatusOnCustomerChange 等公开方法。
 */
export default {
  name: 'TaskOrder',
  inheritAttrs: false,
  components: {
    TaskOrderWorkspace,
  },
};
</script>
