<template>
  <main class="return-workbench">
    <section class="return-toolbar">
      <div class="return-tabs" aria-label="打印任务状态">
        <button
          v-for="option in statusOptions"
          :key="option.value"
          type="button"
          :class="{ active: statusFilter === option.value }"
          @click="changeStatus(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <div class="return-toolbar__actions">
        <span>每 30 秒自动刷新</span>
        <button type="button" :disabled="loading" @click="loadJobs">{{ loading ? '刷新中…' : '立即刷新' }}</button>
      </div>
    </section>

    <section v-if="message.text" class="return-message" :class="message.type">
      {{ message.text }}
    </section>

    <section class="return-summary">
      <article><strong>{{ jobs.length }}</strong><span>当前任务</span></article>
      <article><strong>{{ pendingCount }}</strong><span>待打印</span></article>
      <article><strong>{{ failedCount }}</strong><span>需处理</span></article>
      <article><strong>{{ succeededCount }}</strong><span>已完成</span></article>
    </section>

    <section class="return-list">
      <div v-if="loading && !jobs.length" class="return-empty">正在读取退货打印队列…</div>
      <div v-else-if="!jobs.length" class="return-empty">当前没有符合条件的退货打印任务</div>
      <article v-for="job in jobs" :key="job.nxDrpjId" class="return-job">
        <div class="return-job__type" :class="documentClass(job)">
          <span>{{ documentShortLabel(job) }}</span>
          <small>{{ documentLabel(job) }}</small>
        </div>
        <div class="return-job__body">
          <header>
            <div>
              <h2>{{ job.customerName || '未命名客户' }}</h2>
              <p>{{ job.returnNo || `退货任务 #${job.nxDrpjReturnId}` }}</p>
            </div>
            <span class="return-status" :class="statusClass(job.nxDrpjStatus)">{{ statusLabel(job.nxDrpjStatus) }}</span>
          </header>
          <dl>
            <div><dt>路线日期</dt><dd>{{ job.routeDate || '未安排' }}</dd></div>
            <div><dt>业务进度</dt><dd>{{ businessLabel(job.businessStatus) }}</dd></div>
            <div><dt>尝试次数</dt><dd>{{ job.nxDrpjAttemptCount || 0 }}</dd></div>
            <div><dt>最近打印</dt><dd>{{ formatDate(job.nxDrpjPrintedAt) }}</dd></div>
          </dl>
          <p v-if="job.nxDrpjErrorMessage" class="return-job__error">{{ job.nxDrpjErrorMessage }}</p>
        </div>
        <div class="return-job__actions">
          <button type="button" class="secondary" :disabled="isBusy(job)" @click="preview(job)">预览</button>
          <button
            v-if="job.nxDrpjStatus === 'PENDING'"
            type="button"
            class="primary"
            :disabled="isBusy(job)"
            @click="printJob(job)"
          >{{ isBusy(job) ? '打印中…' : '打印' }}</button>
          <button
            v-else-if="job.nxDrpjStatus === 'FAILED'"
            type="button"
            class="danger"
            :disabled="isBusy(job)"
            @click="retry(job)"
          >重新入队</button>
          <button
            v-else-if="job.nxDrpjStatus === 'SUCCEEDED'"
            type="button"
            class="secondary"
            :disabled="isBusy(job)"
            @click="reprint(job)"
          >审核重打</button>
          <button
            v-else-if="job.nxDrpjStatus === 'PRINTING'"
            type="button"
            class="secondary"
            :disabled="isBusy(job)"
            @click="retry(job)"
          >恢复超时任务</button>
          <button v-else type="button" disabled>打印处理中</button>
        </div>
      </article>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useStore } from 'vuex';
import returnApi from '../api/returnApi';
import { buildReturnDocumentHtml } from '../services/returnDocumentTemplate';

const store = useStore();
const jobs = ref([]);
const loading = ref(false);
const statusFilter = ref('');
const busyJobId = ref(null);
const message = reactive({ type: 'info', text: '' });
let refreshTimer = null;

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'PENDING', label: '待打印' },
  { value: 'FAILED', label: '失败' },
  { value: 'SUCCEEDED', label: '已打印' },
];

const disUser = computed(() => store.state.disUser || {});
const distributerId = computed(() => Number(
  disUser.value.nxDiuDistributerId || disUser.value.nxDistributerId || 0
));
const operatorUserId = computed(() => Number(
  disUser.value.nxDistributerUserId || disUser.value.nxDepartmentUserId || disUser.value.nxDiuUserId || 0
));
const distributerName = computed(() => (
  disUser.value.nxDistributerEntity?.nxDistributerName
  || disUser.value.nxDiuWxNickName
  || '农心乐配送'
));
const pendingCount = computed(() => jobs.value.filter((job) => job.nxDrpjStatus === 'PENDING').length);
const failedCount = computed(() => jobs.value.filter((job) => job.nxDrpjStatus === 'FAILED').length);
const succeededCount = computed(() => jobs.value.filter((job) => job.nxDrpjStatus === 'SUCCEEDED').length);

function unwrap(response) {
  const body = response?.data || {};
  if (body.code !== undefined && Number(body.code) !== 0) {
    throw new Error(body.msg || '退货打印服务返回失败');
  }
  return body.data;
}

function scope() {
  if (!distributerId.value || !operatorUserId.value) {
    throw new Error('当前桌面登录信息不完整，请重新登录');
  }
  return {
    distributerId: distributerId.value,
    operatorUserId: operatorUserId.value,
  };
}

function showMessage(text, type = 'info') {
  message.text = text;
  message.type = type;
}

async function loadJobs() {
  loading.value = true;
  try {
    const params = { ...scope(), limit: 100 };
    if (statusFilter.value) params.status = statusFilter.value;
    jobs.value = unwrap(await returnApi.listPrintJobs(params)) || [];
  } catch (error) {
    showMessage(error?.message || '读取退货打印队列失败', 'error');
  } finally {
    loading.value = false;
  }
}

function changeStatus(value) {
  statusFilter.value = value;
  loadJobs();
}

async function payloadFor(job) {
  return unwrap(await returnApi.getPrintPayload(job.nxDrpjId, scope()));
}

function openPreview(html) {
  const previewWindow = window.open('', '_blank', 'width=1000,height=760');
  if (!previewWindow) throw new Error('预览窗口被浏览器拦截，请允许弹出窗口');
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  previewWindow.focus();
  return previewWindow;
}

async function preview(job) {
  busyJobId.value = job.nxDrpjId;
  try {
    const payload = await payloadFor(job);
    const html = buildReturnDocumentHtml(payload, distributerName.value);
    if (window.electronAPI?.previewReturnDocument) {
      const result = await window.electronAPI.previewReturnDocument(html);
      if (!result?.success) throw new Error(result?.error || '桌面端未能打开预览窗口');
    } else {
      openPreview(html);
    }
  } catch (error) {
    showMessage(error?.message || '预览退货单失败', 'error');
  } finally {
    busyJobId.value = null;
  }
}

async function desktopPrint(html) {
  if (window.electronAPI?.printReturnDocument) {
    return window.electronAPI.printReturnDocument(html);
  }
  const previewWindow = openPreview(html);
  previewWindow.print();
  return { success: true, printerName: '浏览器打印' };
}

async function printJob(job) {
  if (busyJobId.value) return;
  busyJobId.value = job.nxDrpjId;
  let started = false;
  let deliveredToPrinter = false;
  let finishWriteFailed = false;
  try {
    const payload = await payloadFor(job);
    const defaultPrinter = await window.electronAPI?.getDefaultPrinter?.();
    const printerName = defaultPrinter?.printerName || defaultPrinter?.displayName || '系统默认打印机';
    unwrap(await returnApi.startPrint(job.nxDrpjId, { ...scope(), printerName }));
    started = true;

    const result = await desktopPrint(buildReturnDocumentHtml(payload, distributerName.value));
    if (!result?.success) throw new Error(result?.error || '打印机未接受任务');
    deliveredToPrinter = true;
    unwrap(await returnApi.finishPrint(job.nxDrpjId, { ...scope(), success: true, errorMessage: '' }));
    showMessage(`${job.returnNo || '退货单'}已提交到 ${result.printerName || printerName}`, 'success');
  } catch (error) {
    const reason = error?.message || String(error || '打印失败');
    if (started && !deliveredToPrinter) {
      try {
        unwrap(await returnApi.finishPrint(job.nxDrpjId, { ...scope(), success: false, errorMessage: reason }));
      } catch (finishError) {
        finishWriteFailed = true;
        showMessage(`${reason}；打印状态回写也失败：${finishError?.message || '请刷新核对'}`, 'error');
      }
    }
    if (deliveredToPrinter) {
      showMessage('单据已送达打印机，但服务端回写失败。请先核对纸质单，避免重复打印。', 'error');
    } else if (!finishWriteFailed) {
      showMessage(reason, 'error');
    }
  } finally {
    busyJobId.value = null;
    await loadJobs();
  }
}

async function retry(job) {
  busyJobId.value = job.nxDrpjId;
  try {
    unwrap(await returnApi.retryPrint(job.nxDrpjId, scope()));
    showMessage(`${job.returnNo || '退货单'}已重新进入待打印队列`, 'success');
  } catch (error) {
    showMessage(error?.message || '重新入队失败', 'error');
  } finally {
    busyJobId.value = null;
    await loadJobs();
  }
}

async function reprint(job) {
  busyJobId.value = job.nxDrpjId;
  try {
    unwrap(await returnApi.retryPrint(job.nxDrpjId, scope()));
  } catch (error) {
    busyJobId.value = null;
    showMessage(error?.message || '申请重打失败', 'error');
    return;
  }
  busyJobId.value = null;
  await printJob({ ...job, nxDrpjStatus: 'PENDING' });
}

function isBusy(job) { return busyJobId.value === job.nxDrpjId; }
function documentLabel(job) { return job.nxDrpjDocumentType === 'WAREHOUSE_RECEIPT' ? '仓库退货收货单' : '客户退货交接单'; }
function documentShortLabel(job) { return job.nxDrpjDocumentType === 'WAREHOUSE_RECEIPT' ? '收' : '交'; }
function documentClass(job) { return job.nxDrpjDocumentType === 'WAREHOUSE_RECEIPT' ? 'receipt' : 'handover'; }
function statusClass(status) { return String(status || '').toLowerCase(); }
function statusLabel(status) { return ({ PENDING: '待打印', PRINTING: '打印中', SUCCEEDED: '已打印', FAILED: '打印失败' })[status] || status || '未知'; }
function businessLabel(status) { return ({ SUBMITTED: '待审批', APPROVED: '已审批', PROCESSING: '处理中', WAIT_CONFIRM: '待客户确认', COMPLETED: '已完成', REJECTED: '已驳回' })[status] || status || '-'; }
function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}

onMounted(() => {
  loadJobs();
  refreshTimer = window.setInterval(() => {
    if (!busyJobId.value && !loading.value) loadJobs();
  }, 30000);
});

onBeforeUnmount(() => {
  if (refreshTimer) window.clearInterval(refreshTimer);
});
</script>

<style scoped>
.return-workbench{height:100%;padding:18px 22px 28px;overflow:auto;background:#f5f7f5}.return-toolbar{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:1px solid #dfe7e2;border-radius:8px;background:#fff}.return-tabs{display:flex;gap:6px}.return-tabs button,.return-toolbar__actions button,.return-job__actions button{padding:7px 13px;border:1px solid #d6e0da;border-radius:6px;color:#405149;background:#fff;font-size:12px;font-weight:700;cursor:pointer}.return-tabs button.active{border-color:#287a58;color:#fff;background:#287a58}.return-toolbar__actions{display:flex;align-items:center;gap:10px;color:#7a8881;font-size:11px}.return-message{margin-top:12px;padding:10px 13px;border-radius:6px;font-size:12px}.return-message.info{color:#315d77;background:#eaf4fa}.return-message.success{color:#226849;background:#e7f5ed}.return-message.error{color:#9b3a32;background:#fcebea}.return-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.return-summary article{display:flex;align-items:baseline;gap:9px;padding:11px 14px;border:1px solid #e0e7e3;border-radius:7px;background:#fff}.return-summary strong{color:#203e31;font-size:22px}.return-summary span{color:#79857f;font-size:11px}.return-list{display:grid;gap:9px}.return-job{display:grid;grid-template-columns:96px minmax(0,1fr) 126px;min-height:146px;border:1px solid #dfe7e2;border-radius:8px;overflow:hidden;background:#fff}.return-job__type{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#286a50;background:#edf7f2}.return-job__type.receipt{color:#875d21;background:#fbf4e8}.return-job__type>span{display:grid;width:42px;height:42px;place-items:center;border:2px solid currentColor;border-radius:50%;font-size:20px;font-weight:900}.return-job__type small{font-weight:700}.return-job__body{padding:15px 18px}.return-job__body header{display:flex;align-items:flex-start;justify-content:space-between}.return-job h2,.return-job p{margin:0}.return-job h2{color:#263b32;font-size:17px}.return-job header p{margin-top:4px;color:#7d8883;font-size:11px}.return-status{padding:4px 8px;border-radius:12px;color:#5f6d66;background:#edf1ef;font-size:10px;font-weight:800}.return-status.pending{color:#9a6421;background:#fff1d9}.return-status.succeeded{color:#24704f;background:#e6f6ed}.return-status.failed{color:#a13d35;background:#fce9e7}.return-status.printing{color:#315f84;background:#e7f2fb}.return-job dl{display:grid;grid-template-columns:repeat(4,minmax(90px,1fr));gap:8px;margin:15px 0 0}.return-job dl div{min-width:0}.return-job dt{color:#8b9691;font-size:10px}.return-job dd{overflow:hidden;margin:3px 0 0;color:#3f4e47;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.return-job__error{margin-top:9px!important;color:#b13b32;font-size:11px}.return-job__actions{display:flex;flex-direction:column;justify-content:center;gap:8px;padding:14px;border-left:1px solid #edf1ef}.return-job__actions button.primary{border-color:#287a58;color:#fff;background:#287a58}.return-job__actions button.danger{border-color:#c7544a;color:#a83e36;background:#fff6f5}.return-job__actions button:disabled,.return-toolbar button:disabled{opacity:.5;cursor:not-allowed}.return-empty{padding:60px;border:1px dashed #cdd8d1;border-radius:8px;color:#7c8982;background:#fff;text-align:center}@media(max-width:1300px){.return-job{grid-template-columns:82px minmax(0,1fr) 112px}.return-job dl{grid-template-columns:repeat(2,1fr)}}
</style>
