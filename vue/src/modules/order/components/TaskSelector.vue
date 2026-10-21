<template>
  <Teleport :to="teleportTo || 'body'" :disabled="!teleportTo">
    <div v-if="loading || tasks.length" :class="['task-selector', { 'is-context': teleportTo }]">
      <span>任务</span>
      <small v-if="loading">加载中...</small>
      <div v-else class="task-selector__items">
        <div
          v-for="task in tasks"
          :key="task.nxOcrTaskId"
          class="task-selector__item"
          :class="{ active: String(selectedTaskId) === String(task.nxOcrTaskId) }"
        >
          <button type="button" class="task-selector__name" :title="task.nxOcrTaskFileName" @click="$emit('select', task)">
            {{ task.nxOcrTaskFileName }}
          </button>
          <button
            v-if="deletable && String(selectedTaskId) === String(task.nxOcrTaskId)"
            type="button"
            class="task-selector__delete"
            :disabled="deleteDisabled"
            :aria-label="`删除任务：${task.nxOcrTaskFileName}`"
            title="删除当前任务"
            @click.stop="$emit('delete-selected')"
          >×</button>
        </div>
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
  deletable: {
    type: Boolean,
    default: false,
  },
  deleteDisabled: {
    type: Boolean,
    default: false,
  },
  teleportTo: {
    type: String,
    default: '',
  },
});

defineEmits(['select', 'delete-selected']);
</script>

<style scoped>
.task-selector {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 10px;
  flex: none;
  flex-wrap: wrap;
  padding: 7px 12px;
  border-bottom: 1px solid var(--product-border, var(--product-tint));
  background: var(--product-surface);
}

.task-selector > span,
.task-selector > small {
  color: var(--product-text-muted, var(--product-text-muted));
  font-size: 11px;
}

.task-selector > span {
  min-width: 36px;
  font-weight: 750;
}

.task-selector__item {
  position: relative;
  min-width: 0;
  max-width: 260px;
}

.task-selector__name {
  display: block;
  max-width: 100%;
  overflow: hidden;
  padding: 7px 8px;
  border: 0;
  border-bottom: 2px solid transparent;
  color: var(--product-info);
  background: transparent;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-selector__item.active .task-selector__name {
  padding-right: 27px;
  border-bottom-color: var(--product-info);
  color: var(--product-info);
}

.task-selector__delete {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--product-danger);
  background: var(--product-surface);
  font-size: 17px;
  font-weight: 700;
  line-height: 1;
}

.task-selector__delete:disabled { opacity: .4; cursor: not-allowed; }
.task-selector__delete:not(:disabled):hover { color: #fff; background: var(--product-danger); }
.task-selector__name:focus-visible,
.task-selector__delete:focus-visible { outline: 2px solid var(--product-info); outline-offset: 2px; }

.task-selector__items {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
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
  color: var(--product-warning);
  background: var(--product-warning-soft);
  font-size: 9px;
  font-weight: 900;
}

.task-selector.is-context .task-selector__items {
  overflow-x: auto;
  flex: 1;
  flex-wrap: nowrap;
  padding: 2px 0;
}

.task-selector.is-context .task-selector__name {
  flex: none;
  max-width: 190px;
  overflow: hidden;
  padding: 6px 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
