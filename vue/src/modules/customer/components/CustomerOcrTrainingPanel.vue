<template>
  <div class="ocr-training-panel">
    <header class="panel-heading">
      <div>
        <span>OCR TRAINING</span>
        <h3>OCR 任务与预训练</h3>
        <p>正式下单任务只读展示；预训练确认完成后，匹配记忆仅对所选订货部门生效。</p>
      </div>
      <button class="primary-button" type="button" @click="openCreate">＋ 新建预训练</button>
    </header>

    <div class="workspace-grid">
      <aside class="task-pane">
        <div class="task-filters">
          <button
            v-for="option in sceneOptions"
            :key="option.value"
            type="button"
            :class="{ active: sceneFilter === option.value }"
            @click="sceneFilter = option.value"
          >{{ option.label }}</button>
        </div>
        <div v-if="listLoading" class="state-box">正在加载任务…</div>
        <div v-else-if="listError" class="state-box error">
          {{ listError }}
          <button type="button" @click="loadTasks">重试</button>
        </div>
        <div v-else-if="!filteredTasks.length" class="state-box">暂无相关任务</div>
        <div v-else class="task-list">
          <button
            v-for="task in filteredTasks"
            :key="`${task.scene}-${task.taskId}`"
            type="button"
            :class="['task-card', { active: isSelected(task) }]"
            @click="selectTask(task)"
          >
            <span :class="['scene-badge', task.scene.toLowerCase()]">
              {{ task.scene === 'PRETRAINING' ? '预训练' : '正式单' }}
            </span>
            <strong>{{ sourceLabel(task.sourceType) }} · {{ departmentName(task.departmentId) }}</strong>
            <small>{{ task.sampleDate || task.createdAt || '日期未记录' }}</small>
            <span class="task-progress">
              {{ task.confirmedItems || 0 }}/{{ task.totalItems || 0 }} 已确认
              <i :class="statusClass(task.statusCode)">{{ statusLabel(task.statusCode) }}</i>
            </span>
          </button>
        </div>
      </aside>

      <section class="detail-pane">
        <div v-if="detailLoading" class="state-box large">正在加载任务详情…</div>
        <div v-else-if="detailError" class="state-box large error">{{ detailError }}</div>
        <div v-else-if="!detail" class="state-box large">
          <b>选择左侧任务查看详情</b>
          <span>也可以新建一条预训练任务，提前积累客户商品匹配数据。</span>
        </div>
        <template v-else>
          <header class="detail-heading">
            <div>
              <div class="detail-kicker">
                <span :class="['scene-badge', detail.scene.toLowerCase()]">
                  {{ detail.scene === 'PRETRAINING' ? '预训练' : '正式OCR任务' }}
                </span>
                <i :class="statusClass(detail.statusCode)">{{ statusLabel(detail.statusCode) }}</i>
              </div>
              <h4>{{ sourceLabel(detail.sourceType) }} · {{ departmentName(detail.departmentId) }}</h4>
              <p>
                <template v-if="detail.sampleDate">样本日期 {{ detail.sampleDate }} · </template>
                创建于 {{ detail.createdAt || '未知' }}
              </p>
            </div>
            <div class="progress-summary">
              <b>{{ detail.confirmedItems || 0 }}/{{ detail.totalItems || 0 }}</b>
              <span>已确认</span>
              <em v-if="detail.conflictItems">{{ detail.conflictItems }} 条冲突</em>
            </div>
          </header>

          <div v-if="detail.imageBase64" class="source-preview">
            <img :src="detail.imageBase64" alt="预训练原始订单图片" />
          </div>
          <details v-if="detail.sourceText" class="source-text">
            <summary>查看识别原文</summary>
            <pre>{{ detail.sourceText }}</pre>
          </details>

          <div class="items-toolbar">
            <div>
              <strong>训练明细</strong>
              <span v-if="detail.scene === 'PRETRAINING' && !detail.readOnly">
                每一条都需要选择商品并确认；冲突不会自动覆盖。
              </span>
              <span v-else>该任务仅供查看。</span>
            </div>
            <button
              v-if="detail.scene === 'PRETRAINING' && !detail.readOnly"
              class="complete-button"
              type="button"
              :disabled="completing || !canComplete"
              @click="completeTask"
            >{{ completing ? '正在完成…' : '完成训练' }}</button>
          </div>

          <div v-if="!detail.items?.length" class="state-box">任务中暂无明细</div>
          <div v-else class="items-list">
            <article
              v-for="(item, index) in detail.items"
              :key="item.itemId"
              :class="['training-item', String(item.statusCode).toLowerCase()]"
            >
              <header>
                <b>#{{ index + 1 }}</b>
                <span :class="statusClass(item.statusCode)">{{ itemStatusLabel(item.statusCode) }}</span>
                <small v-if="item.rawText">原文：{{ item.rawText }}</small>
              </header>

              <div class="item-fields">
                <label>商品原称<input v-model.trim="item.originalGoodsName" :disabled="detail.readOnly" /></label>
                <label>数量<input v-model.trim="item.quantity" :disabled="detail.readOnly" /></label>
                <label>规格<input v-model.trim="item.standard" :disabled="detail.readOnly" /></label>
                <label>备注<input v-model.trim="item.remark" :disabled="detail.readOnly" /></label>
              </div>

              <div v-if="detail.scene === 'PRETRAINING' && !detail.readOnly" class="match-area">
                <div v-if="item.suggestedDisGoodsId" class="suggestion">
                  <span>历史建议：<b>{{ item.suggestedGoodsName }}</b></span>
                  <button type="button" @click="useSuggestion(item)">采用建议</button>
                </div>
                <div class="goods-search">
                  <input
                    v-model.trim="searchKeywords[item.itemId]"
                    :placeholder="item.matchedGoodsName || '搜索配送商商品'"
                    @keyup.enter="searchGoods(item)"
                  />
                  <button type="button" :disabled="searchingItemId === item.itemId" @click="searchGoods(item)">
                    {{ searchingItemId === item.itemId ? '搜索中' : '搜索' }}
                  </button>
                </div>
                <div v-if="searchResults[item.itemId]?.length" class="search-results">
                  <button
                    v-for="goods in searchResults[item.itemId]"
                    :key="goods.nxDistributerGoodsId"
                    type="button"
                    @click="chooseGoods(item, goods)"
                  >
                    <b>{{ goods.nxDgGoodsName }}</b>
                    <span>{{ goods.nxDgGoodsStandardname || goods.nxDgGoodsDetail || '' }}</span>
                  </button>
                </div>
                <div v-if="item.matchedDisGoodsId" class="selected-goods">
                  已选择：<b>{{ item.matchedGoodsName }}</b>
                </div>

                <div v-if="item.statusCode === 'CONFLICT'" class="conflict-box">
                  <p>已有记忆为“{{ item.existingGoodsName }}”，本次选择“{{ item.matchedGoodsName }}”。请选择保留哪一个。</p>
                  <button type="button" @click="confirmItem(item, 'KEEP_EXISTING')">保留原记忆</button>
                  <button class="danger-soft" type="button" @click="confirmItem(item, 'REPLACE')">用本次结果替换</button>
                </div>
                <button
                  v-else
                  class="confirm-button"
                  type="button"
                  :disabled="savingItemId === item.itemId || !item.matchedDisGoodsId"
                  @click="confirmItem(item)"
                >{{ savingItemId === item.itemId ? '保存中…' : item.statusCode === 'CONFIRMED' ? '重新确认' : '确认此条' }}</button>
              </div>
              <div v-else-if="item.matchedGoodsName" class="readonly-match">
                匹配商品：<b>{{ item.matchedGoodsName }}</b>
              </div>
            </article>
          </div>
        </template>
      </section>
    </div>

    <div v-if="createOpen" class="modal-layer" @click.self="closeCreate">
      <section class="create-card">
        <header>
          <div><span>PRETRAINING</span><h3>新建 OCR 预训练</h3></div>
          <button type="button" @click="closeCreate">×</button>
        </header>
        <div class="create-grid">
          <label>
            <span>样本原始日期</span>
            <input v-model="form.sampleDate" type="date" :max="today" />
          </label>
          <label>
            <span>实际订货部门</span>
            <select v-model.number="form.departmentId">
              <option v-for="dep in departments" :key="dep.nxDepartmentId" :value="dep.nxDepartmentId">
                {{ departmentDisplayName(dep) }}
              </option>
            </select>
          </label>
        </div>
        <div class="source-tabs">
          <button
            v-for="source in sourceOptions"
            :key="source.value"
            type="button"
            :class="{ active: form.sourceType === source.value }"
            @click="form.sourceType = source.value"
          ><b>{{ source.label }}</b><small>{{ source.hint }}</small></button>
        </div>

        <div v-if="form.sourceType === 'PASTE'" class="source-editor">
          <textarea v-model="form.sourceText" placeholder="每行一条，例如：&#10;西红柿 10斤&#10;青椒 2箱"></textarea>
          <p>系统先拆成商品明细，之后仍需逐条确认匹配商品。</p>
        </div>
        <div v-else-if="form.sourceType === 'IMAGE'" class="source-editor image-picker">
          <input ref="imageInput" type="file" accept="image/jpeg,image/png,image/webp" @change="onImageSelected" />
          <button type="button" @click="$refs.imageInput.click()">选择 JPG / PNG / WebP 图片</button>
          <span>{{ form.sourceName || '尚未选择图片，最大 7.5MB' }}</span>
          <img v-if="imagePreview" :src="imagePreview" alt="待识别订单图片" />
        </div>
        <div v-else class="source-editor">
          <textarea v-model="form.sourceText" placeholder="从 Excel 复制后粘贴到这里。列顺序：商品名称、数量、规格、备注"></textarea>
          <p>以制表符识别列，每行一条；第一列必须是商品名称。</p>
          <div v-if="excelPreview.length" class="excel-preview">
            <span v-for="(row, index) in excelPreview.slice(0, 5)" :key="index">
              <b>{{ row.goodsName }}</b> {{ row.quantity }} {{ row.standard }} {{ row.remark }}
            </span>
            <small v-if="excelPreview.length > 5">另有 {{ excelPreview.length - 5 }} 条</small>
          </div>
        </div>
        <div v-if="createError" class="form-error">{{ createError }}</div>
        <footer>
          <button type="button" @click="closeCreate">取消</button>
          <button class="primary-button" type="button" :disabled="creating" @click="createTask">
            {{ creating ? (form.sourceType === 'IMAGE' ? '正在识别图片…' : '正在创建…') : '创建并进入确认' }}
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>

<script>
import customerApi from '../api/customerApi';

function todayText() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function leafDepartments(rows) {
  const leaves = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const children = row?.nxDepartmentEntities;
    if (Array.isArray(children) && children.length) leaves.push(...leafDepartments(children));
    else if (row?.nxDepartmentId) leaves.push(row);
  });
  return leaves;
}

export default {
  name: 'CustomerOcrTrainingPanel',
  props: {
    customer: { type: Object, required: true },
    distributerId: { type: [Number, String], required: true },
  },
  emits: ['notice'],
  data() {
    return {
      tasks: [],
      listLoading: false,
      listError: '',
      sceneFilter: 'ALL',
      selectedKey: '',
      detail: null,
      detailLoading: false,
      detailError: '',
      createOpen: false,
      creating: false,
      createError: '',
      imagePreview: '',
      today: todayText(),
      form: this.emptyForm(),
      searchKeywords: {},
      searchResults: {},
      searchingItemId: null,
      savingItemId: null,
      completing: false,
      sceneOptions: [
        { value: 'ALL', label: '全部' },
        { value: 'PRETRAINING', label: '预训练' },
        { value: 'FORMAL', label: '正式任务' },
      ],
      sourceOptions: [
        { value: 'PASTE', label: '复制粘贴', hint: '按行粘贴订单文字' },
        { value: 'IMAGE', label: '图片识别', hint: '上传订单截图或照片' },
        { value: 'EXCEL_PASTE', label: 'Excel 粘贴', hint: '从表格复制多列数据' },
      ],
    };
  },
  computed: {
    filteredTasks() {
      return this.sceneFilter === 'ALL' ? this.tasks : this.tasks.filter((task) => task.scene === this.sceneFilter);
    },
    departments() {
      const children = leafDepartments(this.customer?.nxDepartmentEntities);
      return children.length ? children : [this.customer];
    },
    excelPreview() {
      if (this.form.sourceType !== 'EXCEL_PASTE') return [];
      return String(this.form.sourceText || '').replace(/\r/g, '').split('\n')
        .map((line) => line.trim()).filter(Boolean).map((line) => {
          const cells = line.split('\t').map((cell) => cell.trim());
          return {
            rawText: line,
            goodsName: cells[0] || '',
            quantity: cells[1] || '',
            standard: cells[2] || '',
            remark: cells.slice(3).join(' ') || '',
          };
        });
    },
    canComplete() {
      if (!this.detail || this.detail.readOnly || !this.detail.totalItems) return false;
      return Number(this.detail.confirmedItems) === Number(this.detail.totalItems)
        && Number(this.detail.conflictItems || 0) === 0;
    },
  },
  watch: {
    'customer.nxDepartmentId': {
      immediate: true,
      handler() {
        this.resetForCustomer();
        this.loadTasks();
      },
    },
  },
  methods: {
    emptyForm() {
      return {
        sampleDate: todayText(),
        departmentId: null,
        sourceType: 'PASTE',
        sourceName: '',
        sourceText: '',
        imageBase64: '',
      };
    },
    resetForCustomer() {
      this.tasks = [];
      this.detail = null;
      this.selectedKey = '';
      this.form = this.emptyForm();
      this.form.departmentId = this.departments[0]?.nxDepartmentId || null;
    },
    async loadTasks(selectTask = null) {
      const customerId = this.customer?.nxDepartmentId;
      if (!customerId) return;
      this.listLoading = true;
      this.listError = '';
      try {
        const result = await customerApi.listCustomerOcrTasks(customerId);
        if (!result?.ok) throw new Error(result?.message || 'OCR任务加载失败');
        this.tasks = result.data?.tasks || [];
        const target = selectTask || this.tasks.find((task) => this.isSelected(task));
        if (target) await this.selectTask(target, true);
      } catch (error) {
        this.listError = error?.message || 'OCR任务加载失败';
      } finally {
        this.listLoading = false;
      }
    },
    async selectTask(task, force = false) {
      const key = `${task.scene}-${task.taskId}`;
      if (!force && this.selectedKey === key && this.detail) return;
      this.selectedKey = key;
      this.detailLoading = true;
      this.detailError = '';
      try {
        const result = await customerApi.getCustomerOcrTask(task.scene, task.taskId);
        if (!result?.ok) throw new Error(result?.message || '任务详情加载失败');
        this.detail = result.data;
        this.searchKeywords = {};
        this.searchResults = {};
      } catch (error) {
        this.detail = null;
        this.detailError = error?.message || '任务详情加载失败';
      } finally {
        this.detailLoading = false;
      }
    },
    openCreate() {
      this.form = this.emptyForm();
      this.form.departmentId = this.departments[0]?.nxDepartmentId || null;
      this.imagePreview = '';
      this.createError = '';
      this.createOpen = true;
    },
    closeCreate() {
      if (this.creating) return;
      this.createOpen = false;
      this.imagePreview = '';
    },
    onImageSelected(event) {
      const file = event.target.files?.[0];
      this.createError = '';
      if (!file) return;
      if (file.size > 7_500_000) {
        this.createError = '图片不能超过 7.5MB';
        event.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.form.imageBase64 = String(reader.result || '');
        this.form.sourceName = file.name;
        this.imagePreview = this.form.imageBase64;
      };
      reader.onerror = () => { this.createError = '图片读取失败'; };
      reader.readAsDataURL(file);
    },
    async createTask() {
      this.createError = '';
      if (!this.form.sampleDate || !this.form.departmentId) {
        this.createError = '请选择样本日期和实际订货部门';
        return;
      }
      if (this.form.sourceType === 'PASTE' && !this.form.sourceText.trim()) {
        this.createError = '请粘贴订单内容';
        return;
      }
      if (this.form.sourceType === 'IMAGE' && !this.form.imageBase64) {
        this.createError = '请选择订单图片';
        return;
      }
      if (this.form.sourceType === 'EXCEL_PASTE'
          && (!this.excelPreview.length || this.excelPreview.some((row) => !row.goodsName))) {
        this.createError = 'Excel粘贴内容至少需要一列商品名称';
        return;
      }
      this.creating = true;
      try {
        const payload = {
          customerId: this.customer.nxDepartmentId,
          departmentId: this.form.departmentId,
          sampleDate: this.form.sampleDate,
          sourceType: this.form.sourceType,
          sourceName: this.form.sourceName || undefined,
        };
        if (this.form.sourceType === 'IMAGE') payload.imageBase64 = this.form.imageBase64;
        else if (this.form.sourceType === 'EXCEL_PASTE') payload.items = this.excelPreview;
        else payload.sourceText = this.form.sourceText;
        const result = await customerApi.createCustomerOcrTraining(payload);
        if (!result?.ok) throw new Error(result?.message || '预训练任务创建失败');
        this.createOpen = false;
        this.detail = result.data;
        this.selectedKey = `PRETRAINING-${result.data.taskId}`;
        await this.loadTasks({ scene: 'PRETRAINING', taskId: result.data.taskId });
        this.$emit('notice', '预训练任务已创建，请逐条确认商品', 'success');
      } catch (error) {
        this.createError = error?.message || '预训练任务创建失败';
      } finally {
        this.creating = false;
      }
    },
    async searchGoods(item) {
      const keyword = this.searchKeywords[item.itemId] || item.originalGoodsName;
      if (!keyword) return;
      this.searchingItemId = item.itemId;
      try {
        const response = await customerApi.searchDistributerGoods(this.distributerId, keyword);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '商品搜索失败');
        this.searchResults[item.itemId] = response.data.data?.disArr || [];
      } catch (error) {
        this.$emit('notice', error?.message || '商品搜索失败', 'error');
      } finally {
        this.searchingItemId = null;
      }
    },
    chooseGoods(item, goods) {
      item.matchedDisGoodsId = goods.nxDistributerGoodsId;
      item.matchedGoodsName = goods.nxDgGoodsName;
      this.searchResults[item.itemId] = [];
    },
    useSuggestion(item) {
      item.matchedDisGoodsId = item.suggestedDisGoodsId;
      item.matchedGoodsName = item.suggestedGoodsName;
    },
    async confirmItem(item, conflictResolution = '') {
      if (!item.matchedDisGoodsId) return;
      this.savingItemId = item.itemId;
      try {
        const result = await customerApi.updateCustomerOcrTrainingItem(this.detail.taskId, item.itemId, {
          rawText: item.rawText || '',
          goodsName: item.originalGoodsName,
          quantity: item.quantity || '',
          standard: item.standard || '',
          remark: item.remark || '',
          matchedDisGoodsId: item.matchedDisGoodsId,
          conflictResolution,
        });
        if (!result?.ok) throw new Error(result?.message || '训练明细保存失败');
        this.detail = result.data;
        await this.refreshTaskSummary();
        const updated = result.data.items?.find((row) => String(row.itemId) === String(item.itemId));
        if (updated?.statusCode === 'CONFLICT') {
          this.$emit('notice', '检测到历史匹配冲突，请明确保留或替换', 'error');
        }
      } catch (error) {
        this.$emit('notice', error?.message || '训练明细保存失败', 'error');
      } finally {
        this.savingItemId = null;
      }
    },
    async refreshTaskSummary() {
      const result = await customerApi.listCustomerOcrTasks(this.customer.nxDepartmentId);
      if (result?.ok) this.tasks = result.data?.tasks || [];
    },
    async completeTask() {
      if (!this.canComplete) return;
      this.completing = true;
      try {
        const result = await customerApi.completeCustomerOcrTraining(this.detail.taskId);
        if (!result?.ok) throw new Error(result?.message || '完成训练失败');
        this.detail = result.data;
        await this.refreshTaskSummary();
        this.$emit('notice', '预训练已完成，确认的匹配已加入该订货部门记忆', 'success');
      } catch (error) {
        this.$emit('notice', error?.message || '完成训练失败', 'error');
      } finally {
        this.completing = false;
      }
    },
    isSelected(task) { return this.selectedKey === `${task.scene}-${task.taskId}`; },
    departmentName(id) {
      return this.departmentDisplayName(this.departments.find((dep) => String(dep.nxDepartmentId) === String(id)) || this.customer);
    },
    departmentDisplayName(dep) { return dep?.nxDepartmentAttrName || dep?.nxDepartmentName || '整店订货'; },
    sourceLabel(type) { return ({ PASTE: '复制粘贴', IMAGE: '图片识别', EXCEL_PASTE: 'Excel粘贴' })[type] || 'OCR任务'; },
    statusLabel(status) {
      return ({ REVIEWING: '待确认', PROCESSING: '处理中', COMPLETED: '已完成', ARCHIVED: '已结束', FAILED: '失败' })[status] || status;
    },
    itemStatusLabel(status) { return ({ PENDING: '待确认', CONFIRMED: '已确认', CONFLICT: '有冲突' })[status] || status; },
    statusClass(status) { return ['status-pill', String(status || '').toLowerCase()]; },
  },
};
</script>

<style scoped>
.ocr-training-panel { min-height: 100%; color: #24332c; }
.panel-heading, .detail-heading, .items-toolbar, .create-card > header, .create-card > footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.panel-heading { padding: 28px 32px 24px; border-bottom: 1px solid #dce8e1; }
.panel-heading span, .create-card > header span { color: #139f60; font-size: 12px; font-weight: 800; letter-spacing: 2px; }
.panel-heading h3, .create-card h3 { margin: 4px 0; font-size: 24px; }
.panel-heading p, .detail-heading p, .source-editor p { margin: 0; color: #77857e; font-size: 13px; }
button, input, select, textarea { font: inherit; }
button { cursor: pointer; }
.primary-button, .complete-button { border: 0; border-radius: 8px; background: #0da45c; color: white; padding: 11px 18px; font-weight: 700; }
.primary-button:disabled, .complete-button:disabled, .confirm-button:disabled { cursor: not-allowed; opacity: .45; }
.workspace-grid { display: grid; grid-template-columns: 290px minmax(0, 1fr); min-height: 650px; }
.task-pane { border-right: 1px solid #dce8e1; background: #f7fbf8; padding: 18px; }
.task-filters { display: flex; gap: 6px; margin-bottom: 14px; }
.task-filters button { flex: 1; border: 1px solid #d8e4dd; border-radius: 7px; padding: 7px 4px; background: white; color: #66756d; }
.task-filters button.active { border-color: #0da45c; color: #087943; background: #eaf8f0; }
.task-list { display: flex; flex-direction: column; gap: 10px; max-height: 720px; overflow: auto; }
.task-card { display: grid; grid-template-columns: auto 1fr; gap: 7px 9px; text-align: left; border: 1px solid #dce8e1; border-radius: 10px; background: white; padding: 13px; color: inherit; }
.task-card.active { border-color: #12a562; box-shadow: 0 0 0 2px rgba(13,164,92,.1); }
.task-card strong { align-self: center; font-size: 14px; }
.task-card small { grid-column: 1 / -1; color: #8a9690; }
.task-progress { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; color: #65726b; font-size: 12px; }
.scene-badge { display: inline-flex; align-items: center; border-radius: 5px; padding: 3px 6px; font-size: 11px; font-style: normal; font-weight: 700; background: #e5f6ed; color: #087943; }
.scene-badge.formal { background: #edf2fb; color: #416db2; }
.status-pill { display: inline-flex; width: max-content; border-radius: 12px; padding: 3px 8px; background: #fff4d9; color: #9a6500; font-size: 11px; font-style: normal; }
.status-pill.completed, .status-pill.confirmed { background: #e5f7ed; color: #087943; }
.status-pill.failed, .status-pill.conflict { background: #ffebea; color: #b43d36; }
.status-pill.archived { background: #eef1ef; color: #69756f; }
.detail-pane { padding: 24px 28px 36px; min-width: 0; }
.detail-heading { padding-bottom: 18px; border-bottom: 1px solid #e2ebe6; }
.detail-kicker { display: flex; gap: 8px; margin-bottom: 8px; }
.detail-heading h4 { margin: 0 0 5px; font-size: 20px; }
.progress-summary { min-width: 110px; display: grid; justify-items: end; }
.progress-summary b { font-size: 26px; color: #0b8d50; }
.progress-summary span { font-size: 12px; color: #78857e; }
.progress-summary em { margin-top: 4px; color: #b43d36; font-size: 12px; font-style: normal; }
.source-preview { margin: 18px 0; border: 1px solid #e0e9e4; border-radius: 10px; padding: 10px; background: #f8faf9; }
.source-preview img { display: block; max-width: 100%; max-height: 340px; margin: auto; object-fit: contain; }
.source-text { margin: 15px 0; color: #617069; }
.source-text summary { cursor: pointer; font-size: 13px; }
.source-text pre { max-height: 180px; overflow: auto; white-space: pre-wrap; background: #f6f8f7; padding: 12px; border-radius: 7px; }
.items-toolbar { padding: 18px 0 12px; }
.items-toolbar > div { display: grid; gap: 3px; }
.items-toolbar span { color: #7a8781; font-size: 12px; }
.items-list { display: flex; flex-direction: column; gap: 12px; }
.training-item { border: 1px solid #dce7e1; border-radius: 10px; padding: 14px; background: white; }
.training-item.confirmed { border-left: 4px solid #18a866; }
.training-item.conflict { border-left: 4px solid #e16b63; }
.training-item > header { display: flex; align-items: center; gap: 9px; margin-bottom: 11px; }
.training-item > header small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #89958f; }
.item-fields { display: grid; grid-template-columns: minmax(160px, 2fr) repeat(3, minmax(90px, 1fr)); gap: 8px; }
.item-fields label, .create-grid label { display: grid; gap: 5px; color: #708078; font-size: 12px; }
.item-fields input, .create-grid input, .create-grid select, .goods-search input { width: 100%; box-sizing: border-box; border: 1px solid #d5e1da; border-radius: 7px; padding: 8px 9px; background: white; color: #26362e; }
.item-fields input:disabled { background: #f7f8f7; }
.match-area { margin-top: 11px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.suggestion, .selected-goods { border-radius: 7px; padding: 8px 10px; background: #edf8f2; font-size: 12px; }
.suggestion button { border: 0; background: transparent; color: #078249; font-weight: 700; margin-left: 8px; }
.goods-search { display: flex; flex: 1; min-width: 260px; }
.goods-search input { border-radius: 7px 0 0 7px; }
.goods-search button { border: 0; border-radius: 0 7px 7px 0; padding: 0 13px; background: #63746b; color: white; }
.search-results { flex-basis: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; padding: 8px; background: #f5f8f6; border-radius: 8px; }
.search-results button { min-width: 0; display: grid; text-align: left; border: 1px solid #dce6e0; border-radius: 6px; padding: 7px; background: white; }
.search-results span { overflow: hidden; text-overflow: ellipsis; color: #849089; font-size: 11px; }
.confirm-button { margin-left: auto; border: 0; border-radius: 7px; padding: 8px 13px; background: #0c9152; color: white; }
.conflict-box { flex-basis: 100%; padding: 11px; border-radius: 8px; background: #fff2f1; color: #8d3934; }
.conflict-box p { margin: 0 0 9px; }
.conflict-box button { border: 1px solid #dfaaa6; border-radius: 6px; padding: 7px 11px; background: white; color: #8d3934; margin-right: 7px; }
.conflict-box .danger-soft { background: #c94e47; color: white; border-color: #c94e47; }
.readonly-match { margin-top: 9px; color: #5b6b63; font-size: 13px; }
.state-box { display: grid; gap: 8px; justify-items: center; padding: 36px 12px; color: #85918b; text-align: center; }
.state-box.large { min-height: 420px; place-content: center; }
.state-box.error, .form-error { color: #b94a44; }
.state-box button { border: 0; color: #0b8c50; background: transparent; }
.modal-layer { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; padding: 30px; background: rgba(20,34,27,.36); }
.create-card { width: min(820px, 94vw); max-height: 90vh; overflow: auto; border-radius: 14px; background: white; box-shadow: 0 24px 60px rgba(20,45,32,.22); }
.create-card > header { padding: 20px 24px; border-bottom: 1px solid #e0e8e3; }
.create-card > header button { border: 0; background: transparent; font-size: 25px; color: #68766f; }
.create-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; padding: 20px 24px 10px; }
.source-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; padding: 12px 24px; }
.source-tabs button { display: grid; gap: 3px; text-align: left; border: 1px solid #d8e4dd; border-radius: 9px; padding: 12px; background: white; color: #495a51; }
.source-tabs button.active { border-color: #0ca45b; background: #ebf9f1; color: #087943; }
.source-tabs small { color: #819087; }
.source-editor { padding: 8px 24px 22px; }
.source-editor textarea { box-sizing: border-box; width: 100%; min-height: 190px; resize: vertical; border: 1px solid #cfded6; border-radius: 9px; padding: 12px; line-height: 1.7; }
.image-picker { display: grid; justify-items: center; gap: 12px; min-height: 230px; align-content: center; border: 1px dashed #bed5c8; margin: 8px 24px 22px; padding: 22px; border-radius: 9px; background: #f8fbf9; }
.image-picker input { display: none; }
.image-picker button { border: 0; border-radius: 7px; padding: 10px 16px; background: #0c9755; color: white; }
.image-picker img { max-width: 100%; max-height: 280px; object-fit: contain; }
.excel-preview { display: grid; gap: 4px; margin-top: 9px; border-radius: 7px; padding: 9px; background: #f4f7f5; color: #68776f; font-size: 12px; }
.form-error { padding: 0 24px 12px; }
.create-card > footer { justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #e0e8e3; }
.create-card > footer > button:not(.primary-button) { border: 1px solid #d2ded7; border-radius: 7px; padding: 10px 17px; background: white; color: #596960; }
@media (max-width: 1050px) {
  .workspace-grid { grid-template-columns: 240px minmax(0, 1fr); }
  .item-fields { grid-template-columns: 1fr 1fr; }
  .search-results { grid-template-columns: 1fr 1fr; }
}
</style>
