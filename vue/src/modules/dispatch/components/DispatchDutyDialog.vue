<template>
  <div class="duty-backdrop" role="presentation" @mousedown.self="$emit('close')">
    <section class="duty-dialog" role="dialog" aria-modal="true" aria-labelledby="duty-title">
      <header>
        <div>
          <span>司机可派管理</span>
          <h2 id="duty-title">司机上岗与类型</h2>
          <p>状态和禁用原因完全以服务端司机池为准。</p>
        </div>
        <button type="button" aria-label="关闭" :disabled="submitting" @click="$emit('close')">×</button>
      </header>

      <div class="duty-list">
        <article v-for="driver in drivers" :key="driver.driverUserId">
          <div class="duty-avatar">司</div>
          <div class="duty-copy">
            <strong>{{ driver.driverName || `司机${driver.driverUserId}` }}</strong>
            <span>{{ driver.driverPhone || '未登记手机号' }} · {{ driver._stageLabel || driver.dispatchStageLabel || '空闲' }}</span>
            <small v-if="driver.toggleDisabledReason">{{ driver.toggleDisabledReason }}</small>
          </div>
          <div class="duty-type" aria-label="司机类型">
            <button
              v-for="type in employmentTypes"
              :key="type.value"
              type="button"
              :class="{ active: driver.employmentType === type.value }"
              :disabled="submitting || driver.employmentType === type.value"
              @click="$emit('employment', { driver, employmentType: type.value })"
            >{{ type.label }}</button>
          </div>
          <button
            type="button"
            class="duty-toggle"
            :class="{ on: driver.dutyStatus !== 'OFF_DUTY' }"
            :disabled="submitting || driver.canToggleDuty === false"
            :title="driver.toggleDisabledReason || ''"
            @click="$emit('toggle-duty', { driver, dutyOn: driver.dutyStatus === 'OFF_DUTY' })"
          >{{ driver.dutyStatus === 'OFF_DUTY' ? '开启可派' : '关闭可派' }}</button>
        </article>
        <p v-if="!drivers.length" class="duty-empty">当前没有可管理的司机。</p>
      </div>
    </section>
  </div>
</template>

<script setup>
defineProps({
  drivers: { type: Array, default: () => [] },
  submitting: { type: Boolean, default: false },
});

defineEmits(['close', 'toggle-duty', 'employment']);

const employmentTypes = [
  { value: 'FULL_TIME', label: '专职' },
  { value: 'PART_TIME', label: '兼职' },
];
</script>

<style scoped>
.duty-backdrop { position: fixed; z-index: 1250; display: grid; inset: 0; place-items: center; padding: 24px; background: rgba(var(--product-text-rgb), 0.6); backdrop-filter: blur(4px); }
.duty-dialog { display: flex; width: min(840px, 92vw); max-height: min(760px, 90vh); flex-direction: column; overflow: hidden; border-radius: 16px; background: var(--product-tint); box-shadow: 0 28px 90px rgba(var(--product-text-rgb), 0.32); }
header { display: flex; align-items: flex-start; justify-content: space-between; padding: 18px 20px 15px; border-bottom: 1px solid var(--product-tint); background: var(--product-surface); }
header span, header h2, header p { margin: 0; }
header span { color: var(--product-primary-strong); font-size: 10px; font-weight: 800; }
header h2 { margin-top: 3px; color: var(--product-text); font-size: 21px; }
header p { margin-top: 4px; color: var(--product-text-muted); font-size: 10px; }
header > button { width: 34px; height: 34px; border: 1px solid var(--product-primary-soft); border-radius: 9px; color: var(--product-text-muted); background: var(--product-surface); font-size: 22px; cursor: pointer; }
.duty-list { overflow-y: auto; padding: 12px; }
article { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto auto; gap: 12px; align-items: center; margin-bottom: 8px; padding: 12px; border: 1px solid var(--product-tint); border-radius: 11px; background: var(--product-surface); }
.duty-avatar { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 50%; color: #fff; background: var(--product-primary-strong); font-size: 13px; font-weight: 800; }
.duty-copy { display: flex; min-width: 0; flex-direction: column; }
.duty-copy strong { color: var(--product-text); font-size: 13px; }
.duty-copy span, .duty-copy small { margin-top: 3px; color: var(--product-text-muted); font-size: 9px; }
.duty-copy small { color: var(--product-warning); }
.duty-type { display: flex; gap: 4px; }
.duty-type button, .duty-toggle { padding: 7px 10px; border: 1px solid var(--product-primary-soft); border-radius: 7px; color: var(--product-primary-strong); background: var(--product-surface); font-size: 9px; cursor: pointer; }
.duty-type button.active { border-color: var(--product-primary); color: var(--product-primary-strong); background: var(--product-primary-soft); }
.duty-toggle { min-width: 78px; font-weight: 800; }
.duty-toggle.on { border-color: var(--product-danger); color: var(--product-danger); }
button:disabled { cursor: not-allowed; opacity: .45; }
.duty-empty { margin: 28px; color: var(--product-text-muted); text-align: center; }
header span { font-size: 12px; }
header h2 { font-size: 25px; }
header p { font-size: 12px; }
.duty-list { padding: 16px; }
article { grid-template-columns: 50px minmax(0, 1fr) auto auto; gap: 15px; padding: 15px; }
.duty-avatar { width: 48px; height: 48px; font-size: 15px; }
.duty-copy strong { font-size: 15px; }
.duty-copy span, .duty-copy small { font-size: 11px; }
.duty-type button, .duty-toggle { min-height: 36px; padding: 8px 12px; font-size: 11px; }
</style>
