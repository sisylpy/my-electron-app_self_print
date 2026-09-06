<template>
  <div class="time-backdrop" role="presentation" @mousedown.self="$emit('close')">
    <form class="time-dialog" @submit.prevent="submit">
      <header>
        <div>
          <span>当日送达时间</span>
          <h2>{{ payload?.customerName || '所选客户' }}</h2>
          <p v-if="payload?.customerWindowLabel">客户原时间：{{ payload.customerWindowLabel }}</p>
        </div>
        <button type="button" aria-label="关闭" :disabled="submitting" @click="$emit('close')">×</button>
      </header>
      <div class="time-form">
        <label><span>最早送达</span><input v-model="form.earliestTime" type="time"></label>
        <label><span>最晚送达 *</span><input v-model="form.latestTime" type="time" required></label>
        <label class="reason"><span>调整原因</span><textarea v-model.trim="form.reason" rows="3" placeholder="可选"></textarea></label>
      </div>
      <p v-if="error" class="time-error">{{ error }}</p>
      <footer>
        <button type="button" :disabled="submitting" @click="$emit('close')">取消</button>
        <button type="submit" class="primary" :disabled="submitting">{{ submitting ? '保存中…' : '保存送达时间' }}</button>
      </footer>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { secondsToTimeValue } from '../services/writeContract';

const props = defineProps({
  payload: { type: Object, default: null },
  submitting: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'confirm']);
const form = reactive({ earliestTime: '', latestTime: '', reason: '' });
const error = ref('');

watch(() => props.payload, (payload) => {
  form.earliestTime = secondsToTimeValue(payload?.earliestDeliveryTimeS);
  form.latestTime = secondsToTimeValue(payload?.latestDeliveryTimeS);
  form.reason = '';
  error.value = '';
}, { immediate: true });

function submit() {
  if (!form.latestTime) {
    error.value = '请选择最晚送达时间';
    return;
  }
  error.value = '';
  emit('confirm', { ...form });
}
</script>

<style scoped>
.time-backdrop { position: fixed; z-index: 1300; display: grid; inset: 0; place-items: center; padding: 24px; background: rgba(12, 28, 22, .62); backdrop-filter: blur(4px); }
.time-dialog { width: min(460px, 90vw); overflow: hidden; border-radius: 15px; background: #fff; box-shadow: 0 26px 80px rgba(6, 25, 18, .3); }
header { display: flex; justify-content: space-between; padding: 18px 20px 14px; border-bottom: 1px solid #e3ebe7; }
header span, header h2, header p { margin: 0; }
header span { color: #14845d; font-size: 10px; font-weight: 800; }
header h2 { margin-top: 3px; color: #19322a; font-size: 20px; }
header p { margin-top: 4px; color: #7c8a85; font-size: 9px; }
header button { width: 32px; height: 32px; border: 1px solid #d6e0db; border-radius: 8px; background: #fff; font-size: 20px; }
.time-form { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 18px 20px 8px; }
label { display: flex; flex-direction: column; gap: 6px; color: #52665f; font-size: 10px; font-weight: 700; }
input, textarea { box-sizing: border-box; width: 100%; padding: 10px; border: 1px solid #cad8d2; border-radius: 8px; outline: 0; font: inherit; }
.reason { grid-column: 1 / -1; }
.time-error { margin: 0; padding: 0 20px 8px; color: #b64f48; font-size: 10px; }
footer { display: flex; justify-content: flex-end; gap: 8px; padding: 13px 20px 18px; }
footer button { padding: 9px 14px; border: 1px solid #c9d6d0; border-radius: 8px; color: #4d635a; background: #fff; font-weight: 800; }
footer .primary { border-color: #139464; color: #fff; background: #139464; }
button:disabled { cursor: not-allowed; opacity: .5; }
header span { font-size: 12px; }
header h2 { font-size: 24px; }
header p { font-size: 12px; }
.time-form { gap: 15px; padding: 22px 24px 10px; }
label { font-size: 12px; }
input, textarea { padding: 12px; font-size: 14px; }
.time-error { padding: 0 24px 9px; font-size: 12px; }
footer { padding: 15px 24px 21px; }
footer button { padding: 10px 17px; font-size: 12px; }
</style>
