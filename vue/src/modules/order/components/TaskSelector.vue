<template>
  <Teleport :to="teleportTo || 'body'" :disabled="!teleportTo">
    <div v-if="loading || tasks.length" :class="['task-selector', { 'is-context': teleportTo }]">
      <span>任务</span>
      <small v-if="loading">加载中...</small>
      <div v-else class="task-selector__items">
        <button
          v-for="task in tasks"
          :key="task.nxOcrTaskId"
          type="button"
          :class="{ active: String(selectedTaskId) === String(task.nxOcrTaskId) }"
          @click="$emit('select', task)"
        >
          {{ task.nxOcrTaskFileName }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
  tasks: {
    type: Array,
    default: () => [],
  },
  selectedTaskId: {
    type: [Number, String],
    default: null,
  },
  teleportTo: {
    type: String,
    default: '',
  },
});

defineEmits(['select']);
</script>

<style scoped>
.task-selector {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 7px;
  flex: none;
  flex-wrap: wrap;
  padding: 7px 10px;
  border-bottom: 1px solid var(--product-border, #dde5e0);
  background: #f8faf9;
}

.task-selector > span,
.task-selector > small {
  color: var(--product-text-muted, #89958f);
  font-size: 11px;
}

.task-selector > span {
  min-width: 36px;
  font-weight: 750;
}

.task-selector button {
  padding: 5px 9px;
  border: 1px solid var(--product-border-strong, #cbd7d0);
  border-radius: 3px;
  color: var(--product-text-secondary, #5f6f67);
  background: #fff;
  font-size: 11px;
}

.task-selector button.active {
  border-color: var(--product-primary, #119b5d);
  color: #fff;
  background: var(--product-primary, #119b5d);
}

.task-selector__items {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.task-selector.is-context {
  width: 100%;
  min-height: 38px;
  flex-wrap: nowrap;
  padding: 0;
  border: 0;
  background: transparent;
}

.task-selector.is-context > span {
  min-width: auto;
  flex: none;
  padding: 3px 6px;
  border-radius: 4px;
  color: #7d5a25;
  background: #fff4df;
  font-size: 9px;
  font-weight: 900;
}

.task-selector.is-context .task-selector__items {
  overflow-x: auto;
  flex: 1;
  flex-wrap: nowrap;
  padding: 2px 0;
}

.task-selector.is-context button {
  flex: none;
  max-width: 190px;
  overflow: hidden;
  padding: 6px 9px;
  border-radius: 5px;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
