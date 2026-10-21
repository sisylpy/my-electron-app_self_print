<template>
  <div class="dialog-backdrop" role="presentation" @mousedown.self="$emit('close')">
    <section class="driver-dialog" role="dialog" aria-modal="true" aria-labelledby="driver-select-title">
      <header>
        <div>
          <span>{{ purpose === 'lock' ? '当次派单锁定' : '分配司机' }}</span>
          <h2 id="driver-select-title">{{ stop?.customerName || '所选客户' }}</h2>
          <p v-if="purpose === 'lock'">只锁定本次派单的司机，客户在司机路线中的顺序仍由系统自动计算。</p>
          <p v-else>选择目标司机后，服务端将重新校验司机状态、任务状态和路线可插入性。</p>
        </div>
        <button type="button" aria-label="关闭" @click="$emit('close')">×</button>
      </header>

      <div class="driver-dialog__list">
        <button
          v-for="driver in drivers"
          :key="driver.driverUserId"
          type="button"
          :class="{ selected: sameId(selectedDriverId, driver.driverUserId) }"
          @click="selectedDriverId = driver.driverUserId"
        >
          <span class="driver-dialog__avatar">{{ initial(driver.driverName) }}</span>
          <span class="driver-dialog__copy">
            <strong>{{ driver.driverName || '未命名司机' }}</strong>
            <small>{{ driver._taskLabel || '暂无当前任务' }}</small>
          </span>
          <span class="driver-dialog__status" :class="{ online: driver._online }">
            <i></i>{{ driver._onlineLabel || '状态未知' }}
          </span>
        </button>
        <div v-if="!drivers.length" class="driver-dialog__empty">
          暂无司机数据，请关闭弹窗并刷新工作台。
        </div>
      </div>

      <footer>
        <button type="button" class="secondary" @click="$emit('close')">取消</button>
        <button
          type="button"
          class="primary"
          :disabled="selectedDriverId == null || submitting"
          @click="confirm"
        >
          {{ submitting ? '服务端处理中…' : (purpose === 'lock' ? '确认锁定' : '确认分配') }}
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  stop: {
    type: Object,
    required: true,
  },
  drivers: {
    type: Array,
    default: () => [],
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  purpose: {
    type: String,
    default: 'assign',
  },
});

const emit = defineEmits(['close', 'confirm']);
const selectedDriverId = ref(props.stop?._driverUserId ?? null);

function initial(name) {
  return String(name || '司').trim().slice(0, 1);
}

function sameId(left, right) {
  return left != null && right != null && String(left) === String(right);
}

function confirm() {
  const driver = props.drivers.find(
    (item) => sameId(item.driverUserId, selectedDriverId.value)
  );
  if (driver) emit('confirm', driver);
}
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  z-index: 1000;
  display: grid;
  inset: 0;
  place-items: center;
  padding: 24px;
  background: rgba(var(--product-text-rgb), 0.56);
  backdrop-filter: blur(5px);
}

.driver-dialog {
  width: min(560px, 92vw);
  max-height: min(680px, 88vh);
  overflow: hidden;
  border-radius: 20px;
  background: var(--product-surface);
  box-shadow: 0 24px 80px rgba(var(--product-text-rgb), 0.28);
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 24px 25px 17px;
  border-bottom: 1px solid var(--product-info-soft);
}

header span {
  color: var(--product-primary-strong);
  font-size: 10px;
  font-weight: 800;
}

header h2 {
  margin: 4px 0;
  color: var(--product-text);
  font-size: 20px;
}

header p {
  margin: 0;
  color: var(--product-info);
  font-size: 10px;
}

header button {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: var(--product-info);
  background: var(--product-info-soft);
  font-size: 22px;
  cursor: pointer;
}

.driver-dialog__list {
  display: flex;
  max-height: 430px;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding: 15px 25px;
}

.driver-dialog__list > button {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 11px;
  align-items: center;
  padding: 11px;
  border: 1px solid var(--product-info-soft);
  border-radius: 12px;
  color: inherit;
  background: var(--product-surface);
  text-align: left;
  cursor: pointer;
}

.driver-dialog__list > button:hover,
.driver-dialog__list > button.selected {
  border-color: var(--product-info);
  background: var(--product-info-soft);
  box-shadow: 0 0 0 2px rgba(var(--product-info-rgb), 0.09);
}

.driver-dialog__avatar {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--product-info), var(--product-info));
  font-weight: 900;
}

.driver-dialog__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.driver-dialog__copy strong {
  color: var(--product-text);
  font-size: 13px;
}

.driver-dialog__copy small {
  overflow: hidden;
  margin-top: 4px;
  color: var(--product-info);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.driver-dialog__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--product-info);
  font-size: 9px;
}

.driver-dialog__status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--product-info);
}

.driver-dialog__status.online {
  color: var(--product-primary-strong);
}

.driver-dialog__status.online i {
  background: var(--product-primary-strong);
}

.driver-dialog__empty {
  padding: 50px 20px;
  color: var(--product-info);
  text-align: center;
  font-size: 11px;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  padding: 16px 25px 22px;
  border-top: 1px solid var(--product-info-soft);
}

footer button {
  padding: 9px 18px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

footer .secondary {
  border: 1px solid var(--product-info-soft);
  color: var(--product-info);
  background: var(--product-surface);
}

footer .primary {
  border: 1px solid var(--product-primary-strong);
  color: #fff;
  background: var(--product-primary-strong);
}

footer button:disabled {
  cursor: not-allowed;
  opacity: .55;
}
</style>
