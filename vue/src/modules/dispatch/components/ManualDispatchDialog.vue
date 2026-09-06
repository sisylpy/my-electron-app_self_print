<template>
  <div class="manual-backdrop" role="presentation" @mousedown.self="$emit('close')">
    <section class="manual-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-title">
      <header>
        <div>
          <span>人工调度</span>
          <h2 id="manual-title">选择司机并试算路线</h2>
          <p>和 Boss 小程序一致：选择后先进入路线编辑，不会立即写入正式路线。</p>
        </div>
        <button type="button" aria-label="关闭" :disabled="loading" @click="$emit('close')">×</button>
      </header>
      <div v-if="loading" class="manual-state">正在读取司机全景…</div>
      <div v-else-if="error" class="manual-state error">{{ error }}</div>
      <div v-else class="manual-list">
        <article v-for="driver in drivers" :key="driver.driverUserId">
          <div class="manual-avatar">司</div>
          <div class="manual-copy">
            <strong>{{ driver.driverName || `司机${driver.driverUserId}` }}</strong>
            <span>{{ driver.routeSummary || driver.currentTaskLine || '暂无在途客户' }}</span>
            <small v-if="driver.blockedReason">{{ driver.blockedReason }}</small>
            <small v-else-if="driver.riskHints?.length">{{ driver.riskHints.join('；') }}</small>
          </div>
          <button
            type="button"
            :disabled="driver.canSimulate === false || driver.primaryAction?.enabled === false"
            :title="driver.blockedReason || driver.primaryAction?.disabledReason || ''"
            @click="$emit('select-driver', driver)"
          >{{ driver.primaryAction?.label || '加入并调整路线' }}</button>
        </article>
        <p v-if="!drivers.length" class="manual-state">当前没有可试算的司机。</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  pageData: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
});
defineEmits(['close', 'select-driver']);
const drivers = computed(() => (Array.isArray(props.pageData?.drivers) ? props.pageData.drivers : []));
</script>

<style scoped>
.manual-backdrop { position: fixed; z-index: 1260; display: grid; inset: 0; place-items: center; padding: 24px; background: rgba(12, 28, 22, .6); backdrop-filter: blur(4px); }
.manual-dialog { display: flex; width: min(820px, 92vw); max-height: min(760px, 90vh); flex-direction: column; overflow: hidden; border-radius: 16px; background: #f6f9f7; box-shadow: 0 28px 90px rgba(6, 25, 18, .32); }
header { display: flex; align-items: flex-start; justify-content: space-between; padding: 18px 20px 15px; border-bottom: 1px solid #dfe8e3; background: #fff; }
header span, header h2, header p { margin: 0; }
header span { color: #14845d; font-size: 10px; font-weight: 800; }
header h2 { margin-top: 3px; color: #183128; font-size: 21px; }
header p { margin-top: 4px; color: #7c8b85; font-size: 10px; }
header > button { width: 34px; height: 34px; border: 1px solid #d5dfda; border-radius: 9px; color: #687972; background: #fff; font-size: 22px; }
.manual-list { overflow-y: auto; padding: 12px; }
article { display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 12px; align-items: center; margin-bottom: 8px; padding: 12px; border: 1px solid #dfe8e3; border-radius: 11px; background: #fff; }
.manual-avatar { display: grid; width: 40px; height: 40px; place-items: center; border-radius: 50%; color: #fff; background: #15956a; font-size: 13px; font-weight: 800; }
.manual-copy { display: flex; min-width: 0; flex-direction: column; }
.manual-copy strong { color: #20372f; font-size: 13px; }
.manual-copy span, .manual-copy small { margin-top: 3px; color: #7b8984; font-size: 9px; }
.manual-copy small { color: #a36d25; }
article > button { padding: 8px 12px; border: 1px solid #159467; border-radius: 8px; color: #fff; background: #159467; font-size: 9px; font-weight: 800; }
button:disabled { cursor: not-allowed; opacity: .45; }
.manual-state { padding: 40px 20px; color: #7b8984; text-align: center; }
.manual-state.error { color: #b95049; }
header span { font-size: 12px; }
header h2 { font-size: 25px; }
header p { font-size: 12px; }
.manual-list { padding: 16px; }
article { grid-template-columns: 50px minmax(0, 1fr) auto; gap: 15px; padding: 15px; }
.manual-avatar { width: 48px; height: 48px; font-size: 15px; }
.manual-copy strong { font-size: 15px; }
.manual-copy span, .manual-copy small { font-size: 11px; }
article > button { min-height: 38px; padding: 9px 14px; font-size: 11px; }
.manual-state { font-size: 13px; }
</style>
