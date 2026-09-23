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
        <div v-else class="task-table-wrap">
          <table class="task-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>名称</th>
                <th>类别</th>
                <th>进度</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="task in filteredTasks"
                :key="`${task.scene}-${task.taskId}`"
                :class="['task-row', { active: isSelected(task) }]"
                tabindex="0"
                role="button"
                @click="selectTask(task)"
                @keydown.enter.prevent="selectTask(task)"
                @keydown.space.prevent="selectTask(task)"
              >
                <td class="task-date">{{ task.sampleDate || task.createdAt || '日期未记录' }}</td>
                <td class="task-name">
                  <strong>{{ sourceLabel(task.sourceType) }} · {{ departmentName(task.departmentId) }}</strong>
                  <small v-if="task.sourceName">{{ task.sourceName }}</small>
                </td>
                <td class="task-category">
                  <span :class="['scene-badge', task.scene.toLowerCase()]">
                    {{ task.scene === 'PRETRAINING' ? '预训练' : '正式任务' }}
                  </span>
                  <small>{{ sourceLabel(task.sourceType) }}</small>
                </td>
                <td class="task-progress">{{ task.confirmedItems || 0 }}/{{ task.totalItems || 0 }} 已确认</td>
                <td><i :class="statusClass(task.statusCode)">{{ statusLabel(task.statusCode) }}</i></td>
              </tr>
            </tbody>
          </table>
        </div>
      </aside>
    </div>

    <Transition name="task-drawer">
      <div v-if="detailOpen" class="task-detail-layer" @click.self="closeTaskDetail">
        <section class="detail-pane" role="dialog" aria-modal="true" aria-label="OCR任务详情">
          <div class="drawer-topbar">
            <button class="drawer-back" type="button" @click="closeTaskDetail">← 返回任务列表</button>
            <span>OCR 任务操作</span>
            <button class="drawer-close" type="button" aria-label="关闭任务详情" @click="closeTaskDetail">×</button>
          </div>
          <div class="detail-body">
        <div v-if="detailLoading" class="state-box large">正在加载任务详情…</div>
        <div v-else-if="detailError" class="state-box large error">{{ detailError }}</div>
        <div v-else-if="!detail" class="state-box large">
          <b>任务详情暂不可用</b>
          <span>请关闭窗口后重新选择任务。</span>
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

          <div
            v-if="detail.sourceType === 'IMAGE' && detailImageUrl"
            class="formal-detail-workspace"
          >
            <div v-if="activeTrainingConflict" class="training-conflict-bar">
              <span>
                “{{ activeTrainingConflict.originalGoodsName }}”原记忆为
                <b>{{ activeTrainingConflict.existingGoodsName }}</b>，本次选择
                <b>{{ activeTrainingConflict.matchedGoodsName }}</b>。
              </span>
              <button type="button" @click="confirmItem(activeTrainingConflict, 'KEEP_EXISTING')">保留原记忆</button>
              <button class="danger-soft" type="button" @click="confirmItem(activeTrainingConflict, 'REPLACE')">用本次结果替换</button>
            </div>
            <ImageUpload
              :source="detail.readOnly ? 'taskOrder' : 'placeOrder'"
              :new-task-only="true"
              :dep-id="detail.departmentId"
              :task-type="1"
              :current-task="trainingCurrentTask"
              :has-cache="true"
              :has-running-task="false"
              :uploaded-image-file="trainingImageFile"
              :image-preview="detailImageUrl"
              :image-scale="trainingImageScale"
              :image-translate-x="trainingImageTranslateX"
              :image-translate-y="trainingImageTranslateY"
              :is-dragging="trainingImageDragging"
              :order-items="trainingOrderItems"
              :current-reading-text="trainingTtsState.currentText"
              :current-reading-index="trainingTtsState.currentIndex"
              :tts-playing="trainingTtsState.isTTSPlaying"
              :tts-loading="trainingTtsState.isTTSLoading"
              :tts-stopped-index="trainingTtsState.stoppedIndex"
              @reset-transform="resetTrainingImageTransform"
              @zoom-in="zoomTrainingImage(0.1)"
              @zoom-out="zoomTrainingImage(-0.1)"
              @start-drag="startTrainingImageDrag"
              @on-drag="dragTrainingImage"
              @end-drag="endTrainingImageDrag"
              @wheel="wheelTrainingImage"
              @re-upload="deleteTrainingTask"
              @show-fix-items="showTrainingAdjustmentNotice"
              @finish-task="completeTask"
              @read-order-list="readTrainingOrders"
              @pause-reading="pauseTrainingOrders"
              @restart-reading="restartTrainingOrders"
              @stop-reading="stopTrainingOrders"
              @continue-reading="continueTrainingOrders"
            >
              <template #order-list>
                <OrderEditor
                  ref="trainingOrderEditor"
                  :order-items="trainingOrderItems"
                  :dis-id="distributerId"
                  source-type="image"
                  :show-matched-goods="trainingShowMatchedGoods"
                  :order-arr-index="trainingOrderArrIndex"
                  :str-arr="trainingSearchResults"
                  :nx-arr="trainingNxSearchResults"
                  :is-valid-order-quantity-and-standard="isTrainingOrderValid"
                  empty-message="图片中没有识别到订单明细"
                  @tts-state="onTrainingTtsState"
                  @goods-name-input="searchTrainingGoodsFromEditor"
                  @goods-name-focus="focusTrainingOrder"
                  @quantity-input="updateTrainingOrderField($event, 'quantity')"
                  @standard-change="updateTrainingOrderField($event, 'standard')"
                  @remark-input="updateTrainingOrderRemark"
                  @update-order="editTrainingOrder"
                  @save-new-goods="searchTrainingGoodsFromEditor"
                  @delete-order="deleteTrainingItem"
                  @toggle-matched-goods="toggleTrainingMatchedGoods"
                  @close-all-matched-goods="closeTrainingGoodsMenus"
                  @select-matched-goods="selectTrainingMatchedGoods"
                  @close-str="closeTrainingGoodsSearch"
                  @select-search-result="selectTrainingSearchResult"
                  @add-new-order-before="showTrainingAddNotice"
                  @download-goods-nx="showTrainingAddNotice"
                />
              </template>
            </ImageUpload>
          </div>

          <template v-else>
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
        </template>
          </div>
        </section>
      </div>
    </Transition>

    <div v-if="createOpen" class="modal-layer" @click.self="closeCreate">
      <section :class="['create-card', { 'image-mode': form.sourceType === 'IMAGE' }]">
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
        <div v-else-if="form.sourceType === 'IMAGE'" class="formal-image-workspace">
          <ImageUpload
            source="placeOrder"
            :new-task-only="true"
            :dep-id="form.departmentId"
            :task-type="1"
            :current-task="null"
            :has-cache="false"
            :has-running-task="creating"
            :uploaded-image-file="null"
            :image-preview="null"
            :show-deep-seek-loading="creating"
            :order-items="[]"
            @image-upload="onImageSelected"
          >
            <template #order-list>
              <div class="formal-image-empty">
                <b>与正式下单完全相同的图片识别</b>
                <span>选择、拖入或粘贴图片后，可旋转、裁剪，并选择单列快速识别或多列复杂识别。</span>
                <small>识别结果只进入预训练确认，不会生成正式订单。</small>
              </div>
            </template>
          </ImageUpload>
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
        <footer v-if="form.sourceType !== 'IMAGE'">
          <button type="button" @click="closeCreate">取消</button>
          <button class="primary-button" type="button" :disabled="creating" @click="createTask">
            {{ creating ? '正在创建…' : '创建并进入确认' }}
          </button>
        </footer>
      </section>
    </div>

    <ImageCropperModal
      v-model="showImagePreviewModal"
      :src="previewImageDataUrl"
      :file-size="imageFileSize"
      title="图片预览与裁剪"
      @cancel="closeImagePreviewModal"
      @direct-recognize="(dataUrl) => createImageTask(dataUrl, 'FAST')"
      @direct-recognize-ai="(dataUrl) => createImageTask(dataUrl, 'COMPLEX')"
    />
  </div>
</template>

<script>
import customerApi from '../api/customerApi';
import ImageCropperModal from '@/components/ImageCropperModal.vue';
import ImageUpload from '@/components/upload/ImageUpload.vue';
import OrderEditor from '@/modules/order/components/OrderEditor.vue';
import orderApi from '@/modules/order/services/orderApi';

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
  components: { ImageCropperModal, ImageUpload, OrderEditor },
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
      detailOpen: false,
      detailLoading: false,
      detailError: '',
      createOpen: false,
      creating: false,
      createError: '',
      showImagePreviewModal: false,
      previewImageDataUrl: '',
      imageFileSize: 0,
      today: todayText(),
      form: this.emptyForm(),
      searchKeywords: {},
      searchResults: {},
      searchingItemId: null,
      savingItemId: null,
      completing: false,
      deletingTask: false,
      trainingOrderArrIndex: -1,
      trainingSearchResults: [],
      trainingNxSearchResults: [],
      trainingShowMatchedGoods: {},
      trainingTtsState: {
        isTTSPlaying: false,
        isTTSLoading: false,
        stoppedIndex: -1,
        currentText: '',
        currentIndex: -1,
      },
      trainingImageScale: 1,
      trainingImageTranslateX: 0,
      trainingImageTranslateY: 0,
      trainingImageDragging: false,
      trainingImageDragStart: null,
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
    activeTrainingConflict() {
      return this.detail?.items?.find((item) => item.statusCode === 'CONFLICT') || null;
    },
    trainingImageFile() {
      if (!this.detailImageUrl) return null;
      return { name: this.detail.sourceName || '训练订单图片', type: 'image/*', size: 0 };
    },
    detailImageUrl() {
      const source = this.detail?.imageBase64 || this.detail?.imagePath;
      if (!source) return '';
      if (/^(?:data:|https?:|blob:)/i.test(source)) return source;
      const base = customerApi.imageServerUrl();
      return `${String(base || '').replace(/\/$/, '')}/${String(source).replace(/^\//, '')}`;
    },
    trainingCurrentTask() {
      if (!this.detail) return null;
      const total = Number(this.detail.totalItems || 0);
      const confirmed = Number(this.detail.confirmedItems || 0);
      const pending = this.detail.readOnly || !this.canComplete ? Math.max(1, total - confirmed) : 0;
      return {
        nxOcrTaskId: this.detail.taskId,
        nxOcrTaskFileName: this.detail.sourceName || 'OCR预训练',
        nxOcrTaskStatus: 1,
        nxOcrTaskTotalOrders: total,
        nxOcrTaskCompletedOrders: confirmed,
        nxOcrTaskPendingOrders: pending,
      };
    },
    trainingOrderItems() {
      return (this.detail?.items || []).map((item) => {
        const editable = !this.detail.readOnly && (item.statusCode !== 'CONFIRMED' || item._editing);
        const matchedGoods = item.matchedDisGoodsId ? {
          nxDistributerGoodsId: item.matchedDisGoodsId,
          nxDgGoodsName: item.matchedGoodsName,
          nxDgGoodsStandardname: item.standard || '',
        } : null;
        const recommendedGoods = Array.isArray(item.nxDistributerGoodsEntityList)
          ? item.nxDistributerGoodsEntityList : [];
        return {
          ...item,
          _trainingItem: item,
          nxDoGoodsName: item.originalGoodsName || item.goodsName || item.matchedGoodsName || '',
          nxDoGoodsNameOriginal: item.originalGoodsName || item.goodsName || '',
          nxDoQuantity: item.quantity || '',
          nxDoStandard: item.standard || '',
          nxDoRemark: item.remark || '',
          nxDoAddRemark: Boolean(item.remark),
          nxDoStatus: editable ? -2 : 0,
          nxDoDisGoodsId: item.matchedDisGoodsId || null,
          nxDistributerGoodsEntity: matchedGoods,
          nxDistributerGoodsEntityList: editable ? recommendedGoods : [],
          nxGoodsEntities: editable && Array.isArray(item.nxGoodsEntities) ? item.nxGoodsEntities : [],
        };
      });
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
  mounted() {
    document.addEventListener('keydown', this.handleDetailEscape);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleDetailEscape);
    this.stopTrainingOrders();
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
      this.stopTrainingOrders();
      this.tasks = [];
      this.detail = null;
      this.detailOpen = false;
      this.selectedKey = '';
      this.resetTrainingWorkspaceState();
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
      this.detailOpen = true;
      if (!force && this.selectedKey === key && this.detail) return;
      this.stopTrainingOrders();
      this.resetTrainingWorkspaceState();
      this.selectedKey = key;
      this.detailLoading = true;
      this.detailError = '';
      try {
        const result = await customerApi.getCustomerOcrTask(task.scene, task.taskId);
        if (!result?.ok) throw new Error(result?.message || '任务详情加载失败');
        this.detail = this.mergeTrainingDetail(result.data);
        await this.ensureFormalTaskImage();
        this.searchKeywords = {};
        this.searchResults = {};
      } catch (error) {
        this.detail = null;
        this.detailError = error?.message || '任务详情加载失败';
      } finally {
        this.detailLoading = false;
      }
    },
    async ensureFormalTaskImage() {
      if (this.detail?.scene !== 'FORMAL' || this.detail?.sourceType !== 'IMAGE'
        || this.detail.imageBase64 || this.detail.imagePath) return;
      try {
        const response = await orderApi.getTaskOrders(this.detail.taskId, {
          page: 1,
          limit: 1,
          processStatus: true,
          showLoading: false,
        });
        const data = response?.data || {};
        const imagePath = data.imagePath || data.task?.nxOcrTaskImagePath;
        if (imagePath) this.detail = { ...this.detail, imagePath };
      } catch (error) {
        console.warn('[CustomerOcrTrainingPanel] 正式 OCR 原图加载失败', error);
      }
    },
    closeTaskDetail() {
      this.stopTrainingOrders();
      this.closeTrainingGoodsMenus();
      this.detailOpen = false;
    },
    handleDetailEscape(event) {
      if (event.key === 'Escape' && this.detailOpen && !this.createOpen && !this.showImagePreviewModal) {
        this.closeTaskDetail();
      }
    },
    openCreate() {
      this.form = this.emptyForm();
      this.form.departmentId = this.departments[0]?.nxDepartmentId || null;
      this.previewImageDataUrl = '';
      this.imageFileSize = 0;
      this.createError = '';
      this.createOpen = true;
    },
    closeCreate() {
      if (this.creating) return;
      this.createOpen = false;
      this.closeImagePreviewModal();
    },
    onImageSelected(event) {
      const file = event.target.files?.[0];
      this.createError = '';
      if (!file) return;
      if (!file.type?.startsWith('image/')) {
        this.createError = '请选择图片文件';
        event.target.value = '';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        this.createError = '图片不能超过 10MB';
        event.target.value = '';
        return;
      }
      if (!this.form.sampleDate || !this.form.departmentId) {
        this.createError = '请先选择样本日期和实际订货部门';
        event.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.form.imageBase64 = String(reader.result || '');
        this.form.sourceName = file.name;
        this.previewImageDataUrl = this.form.imageBase64;
        this.imageFileSize = file.size;
        this.showImagePreviewModal = true;
      };
      reader.onerror = () => { this.createError = '图片读取失败'; };
      reader.readAsDataURL(file);
    },
    closeImagePreviewModal() {
      this.showImagePreviewModal = false;
    },
    async createImageTask(imageDataUrl, recognitionMode) {
      this.form.imageBase64 = imageDataUrl;
      await this.createTask({ recognitionMode });
    },
    async createTask(options = {}) {
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
        if (this.form.sourceType === 'IMAGE') {
          payload.imageBase64 = this.form.imageBase64;
          payload.recognitionMode = options.recognitionMode || 'COMPLEX';
        }
        else if (this.form.sourceType === 'EXCEL_PASTE') payload.items = this.excelPreview;
        else payload.sourceText = this.form.sourceText;
        const result = await customerApi.createCustomerOcrTraining(payload);
        if (!result?.ok) throw new Error(result?.message || '预训练任务创建失败');
        this.createOpen = false;
        this.showImagePreviewModal = false;
        this.detail = this.mergeTrainingDetail(result.data);
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
        const response = await orderApi.queryDisGoodsByQuickSearchWithDepId({
          disId: this.distributerId,
          searchStr: keyword,
          depId: this.detail?.departmentId || this.form.departmentId,
        });
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
        this.detail = this.mergeTrainingDetail(result.data);
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
    resetTrainingWorkspaceState() {
      this.trainingOrderArrIndex = -1;
      this.trainingSearchResults = [];
      this.trainingNxSearchResults = [];
      this.trainingShowMatchedGoods = {};
      this.trainingTtsState = {
        isTTSPlaying: false,
        isTTSLoading: false,
        stoppedIndex: -1,
        currentText: '',
        currentIndex: -1,
      };
      this.resetTrainingImageTransform();
    },
    trainingItemFromPayload(payload) {
      return payload?.item?._trainingItem || payload?.item || null;
    },
    isTrainingOrderValid(item) {
      const quantity = item?.nxDoQuantity;
      const standard = item?.nxDoStandard;
      return quantity != null && quantity !== '' && !Number.isNaN(Number(quantity))
        && standard != null && String(standard).trim() !== '';
    },
    focusTrainingOrder({ orderIndex }) {
      this.trainingOrderArrIndex = orderIndex;
    },
    updateTrainingOrderField(payload, field) {
      const item = this.trainingItemFromPayload(payload);
      if (!item || this.detail?.readOnly) return;
      item[field] = payload.value == null ? '' : String(payload.value);
    },
    updateTrainingOrderRemark(payload) {
      const item = this.trainingItemFromPayload(payload);
      if (!item || this.detail?.readOnly) return;
      if (payload.field === 'nxDoRemark') item.remark = payload.value == null ? '' : String(payload.value);
    },
    async loadFormalOrderGoodsCandidates(item, keyword) {
      const response = await orderApi.queryDisGoodsByQuickSearchWithDepId({
        disId: this.distributerId,
        searchStr: keyword,
        depId: this.detail.departmentId,
      });
      if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '商品搜索失败');
      const disArr = Array.isArray(response.data.data?.disArr) ? response.data.data.disArr : [];
      const nxArr = Array.isArray(response.data.data?.nxArr) ? response.data.data.nxArr : [];

      // 与正式下单的 getSearchString 保持一致：搜索结果不只用于临时下拉框，
      // 还要回写到 OrderEditor 的正式推荐字段，再次展开时不会退回旧候选集。
      item.nxDistributerGoodsEntityList = disArr;
      item.nxGoodsEntities = nxArr;
      return { disArr, nxArr };
    },
    async searchTrainingGoodsFromEditor(payload) {
      const item = this.trainingItemFromPayload(payload);
      if (!item || this.detail?.readOnly) return;
      const keyword = String(payload?.value || payload?.goodsName || payload?.item?.nxDoGoodsName
        || item.originalGoodsName || '').trim();
      if (!keyword) return;
      item.originalGoodsName = keyword;
      this.trainingOrderArrIndex = payload.orderIndex;
      this.searchingItemId = item.itemId;
      try {
        const { disArr, nxArr } = await this.loadFormalOrderGoodsCandidates(item, keyword);
        this.trainingSearchResults = disArr;
        this.trainingNxSearchResults = nxArr;
        if (!this.trainingSearchResults.length && !this.trainingNxSearchResults.length) {
          this.$emit('notice', '没有找到配送商商品，请先在商品中心建立商品', 'error');
        }
      } catch (error) {
        this.trainingSearchResults = [];
        this.trainingNxSearchResults = [];
        this.$emit('notice', error?.message || '商品搜索失败', 'error');
      } finally {
        this.searchingItemId = null;
      }
    },
    async selectTrainingGoods(item, goods) {
      if (!item || !goods || this.detail?.readOnly) return;
      item.matchedDisGoodsId = goods.nxDistributerGoodsId;
      item.matchedGoodsName = goods.nxDgGoodsName;
      this.closeTrainingGoodsMenus();
      await this.confirmItem(item);
    },
    selectTrainingMatchedGoods({ item, goodsIndex }) {
      const trainingItem = this.trainingItemFromPayload({ item });
      const goods = item?.nxDistributerGoodsEntityList?.[goodsIndex];
      return this.selectTrainingGoods(trainingItem, goods);
    },
    selectTrainingSearchResult({ goods, orderIndex }) {
      const trainingItem = this.trainingOrderItems[orderIndex]?._trainingItem;
      return this.selectTrainingGoods(trainingItem, goods);
    },
    async toggleTrainingMatchedGoods(payload) {
      const orderIndex = typeof payload === 'object' ? payload.orderIndex : payload;
      const hasSearchResults = typeof payload === 'object'
        ? payload.hasSearchResults
        : (this.trainingOrderArrIndex === orderIndex
          && (this.trainingSearchResults.length + this.trainingNxSearchResults.length) > 0);
      const isExpanded = Boolean(this.trainingShowMatchedGoods[orderIndex]);
      if (isExpanded || hasSearchResults) {
        if (hasSearchResults) this.closeTrainingGoodsSearch();
        this.trainingShowMatchedGoods = { ...this.trainingShowMatchedGoods, [orderIndex]: false };
        return;
      }
      this.trainingSearchResults = [];
      this.trainingNxSearchResults = [];
      this.trainingOrderArrIndex = orderIndex;
      const trainingItem = this.trainingOrderItems[orderIndex]?._trainingItem;
      const keyword = String(trainingItem?.originalGoodsName || '').trim();
      if (trainingItem && keyword) {
        this.searchingItemId = trainingItem.itemId;
        try {
          await this.loadFormalOrderGoodsCandidates(trainingItem, keyword);
        } catch (error) {
          this.$emit('notice', error?.message || '商品搜索失败', 'error');
        } finally {
          this.searchingItemId = null;
        }
      }
      this.trainingShowMatchedGoods = { [orderIndex]: true };
    },
    closeTrainingGoodsSearch() {
      this.trainingSearchResults = [];
      this.trainingNxSearchResults = [];
      this.trainingOrderArrIndex = -1;
    },
    closeTrainingGoodsMenus() {
      this.trainingShowMatchedGoods = {};
      this.closeTrainingGoodsSearch();
    },
    editTrainingOrder(payload) {
      const item = this.trainingItemFromPayload(payload);
      if (!item || this.detail?.readOnly) return;
      item._editing = true;
      this.trainingOrderArrIndex = payload.orderIndex;
    },
    async deleteTrainingItem(payload) {
      const item = this.trainingItemFromPayload(payload);
      if (!item || this.detail?.readOnly) return;
      try {
        const result = await customerApi.deleteCustomerOcrTrainingItem(this.detail.taskId, item.itemId);
        if (!result?.ok) throw new Error(result?.message || '删除训练明细失败');
        this.detail = this.mergeTrainingDetail(result.data);
        this.closeTrainingGoodsMenus();
        await this.refreshTaskSummary();
        this.$emit('notice', '训练明细已删除', 'success');
      } catch (error) {
        this.$emit('notice', error?.message || '删除训练明细失败', 'error');
      }
    },
    async deleteTrainingTask() {
      if (!this.detail || this.detail.readOnly || this.deletingTask) return;
      if (!window.confirm('确定删除这条预训练任务吗？删除后无法恢复。')) return;
      this.deletingTask = true;
      try {
        const result = await customerApi.deleteCustomerOcrTraining(this.detail.taskId);
        if (!result?.ok) throw new Error(result?.message || '删除预训练任务失败');
        this.stopTrainingOrders();
        this.detail = null;
        this.detailOpen = false;
        this.selectedKey = '';
        await this.loadTasks();
        this.$emit('notice', '预训练任务已删除', 'success');
      } catch (error) {
        this.$emit('notice', error?.message || '删除预训练任务失败', 'error');
      } finally {
        this.deletingTask = false;
      }
    },
    showTrainingAdjustmentNotice() {
      this.$emit('notice', '训练任务请在列表中逐条修改并确认商品', 'error');
    },
    showTrainingAddNotice() {
      this.$emit('notice', '新增商品请先到商品中心建立，再回到训练任务中搜索确认', 'error');
    },
    onTrainingTtsState(payload) {
      const editor = this.$refs.trainingOrderEditor;
      this.trainingTtsState = {
        isTTSPlaying: Boolean(payload?.isTTSPlaying),
        isTTSLoading: Boolean(payload?.isTTSLoading),
        stoppedIndex: payload?.stoppedIndex ?? -1,
        currentText: editor?.currentReadingText || '',
        currentIndex: editor?.currentReadingIndex ?? -1,
      };
    },
    readTrainingOrders() {
      this.$refs.trainingOrderEditor?.readOrderList?.();
    },
    pauseTrainingOrders() {
      this.$refs.trainingOrderEditor?.pauseReading?.();
    },
    restartTrainingOrders() {
      this.closeTrainingGoodsMenus();
      this.$refs.trainingOrderEditor?.restartReading?.();
    },
    stopTrainingOrders() {
      this.$refs.trainingOrderEditor?.stopReading?.();
    },
    continueTrainingOrders() {
      this.$refs.trainingOrderEditor?.continueReading?.();
    },
    resetTrainingImageTransform() {
      this.trainingImageScale = 1;
      this.trainingImageTranslateX = 0;
      this.trainingImageTranslateY = 0;
      this.trainingImageDragging = false;
      this.trainingImageDragStart = null;
    },
    zoomTrainingImage(delta) {
      this.trainingImageScale = Math.min(3, Math.max(0.3, this.trainingImageScale + delta));
    },
    wheelTrainingImage(event) {
      this.zoomTrainingImage(event?.deltaY < 0 ? 0.1 : -0.1);
    },
    startTrainingImageDrag(event) {
      this.trainingImageDragging = true;
      this.trainingImageDragStart = {
        x: event.clientX,
        y: event.clientY,
        translateX: this.trainingImageTranslateX,
        translateY: this.trainingImageTranslateY,
      };
    },
    dragTrainingImage(event) {
      if (!this.trainingImageDragging || !this.trainingImageDragStart) return;
      this.trainingImageTranslateX = this.trainingImageDragStart.translateX
        + event.clientX - this.trainingImageDragStart.x;
      this.trainingImageTranslateY = this.trainingImageDragStart.translateY
        + event.clientY - this.trainingImageDragStart.y;
    },
    endTrainingImageDrag() {
      this.trainingImageDragging = false;
      this.trainingImageDragStart = null;
    },
    async refreshTaskSummary() {
      const result = await customerApi.listCustomerOcrTasks(this.customer.nxDepartmentId);
      if (result?.ok) this.tasks = result.data?.tasks || [];
    },
    mergeTrainingDetail(nextDetail) {
      if (String(nextDetail?.taskId || '') !== String(this.detail?.taskId || '')
        || !nextDetail?.items?.length || !this.detail?.items?.length) return nextDetail;
      const previousById = new Map(this.detail.items.map((item) => [String(item.itemId), item]));
      return {
        ...nextDetail,
        items: nextDetail.items.map((item) => {
          const previous = previousById.get(String(item.itemId));
          if (!previous) return item;
          return {
            ...item,
            nxDistributerGoodsEntityList: Array.isArray(item.nxDistributerGoodsEntityList)
              ? item.nxDistributerGoodsEntityList
              : previous.nxDistributerGoodsEntityList,
            nxGoodsEntities: Array.isArray(item.nxGoodsEntities)
              ? item.nxGoodsEntities
              : previous.nxGoodsEntities,
          };
        }),
      };
    },
    async completeTask() {
      if (!this.canComplete) return;
      this.completing = true;
      try {
        const result = await customerApi.completeCustomerOcrTraining(this.detail.taskId);
        if (!result?.ok) throw new Error(result?.message || '完成训练失败');
        this.stopTrainingOrders();
        this.closeTrainingGoodsMenus();
        this.detail = null;
        this.detailOpen = false;
        this.selectedKey = '';
        this.resetTrainingWorkspaceState();
        await this.loadTasks();
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
.workspace-grid { min-height: 650px; background: #f7fbf8; }
.task-pane { min-height: 650px; padding: 22px 26px 32px; }
.task-filters { display: flex; width: max-content; gap: 8px; margin-bottom: 18px; }
.task-filters button { min-width: 86px; border: 1px solid #d8e4dd; border-radius: 7px; padding: 8px 13px; background: white; color: #66756d; }
.task-filters button.active { border-color: #0da45c; color: #087943; background: #eaf8f0; }
.task-table-wrap { overflow: hidden; border: 1px solid #dce8e1; border-radius: 12px; background: white; box-shadow: 0 4px 14px rgba(30, 68, 47, .035); }
.task-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.task-table th { padding: 11px 16px; border-bottom: 1px solid #dce8e1; background: #f3f8f5; color: #66756d; font-size: 12px; font-weight: 700; text-align: left; }
.task-table th:nth-child(1) { width: 18%; }
.task-table th:nth-child(2) { width: 34%; }
.task-table th:nth-child(3) { width: 18%; }
.task-table th:nth-child(4) { width: 17%; }
.task-table th:nth-child(5) { width: 13%; }
.task-row { outline: none; transition: background .15s ease, box-shadow .15s ease; }
.task-row + .task-row { border-top: 1px solid #edf2ef; }
.task-row:hover, .task-row:focus-visible { background: #f2faf6; }
.task-row.active { background: #eaf8f0; box-shadow: inset 3px 0 #0da45c; }
.task-row td { padding: 14px 16px; color: #47564f; vertical-align: middle; cursor: pointer; }
.task-date { color: #718078 !important; font-size: 13px; }
.task-name, .task-category { min-width: 0; }
.task-name strong { display: block; overflow: hidden; color: #27372f; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.task-name small, .task-category small { display: block; overflow: hidden; margin-top: 4px; color: #8a9690; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.task-progress { color: #65726b !important; font-size: 12px; }
.scene-badge { display: inline-flex; align-items: center; border-radius: 5px; padding: 3px 6px; font-size: 11px; font-style: normal; font-weight: 700; background: #e5f6ed; color: #087943; }
.scene-badge.formal { background: #edf2fb; color: #416db2; }
.status-pill { display: inline-flex; width: max-content; border-radius: 12px; padding: 3px 8px; background: #fff4d9; color: #9a6500; font-size: 11px; font-style: normal; }
.status-pill.completed, .status-pill.confirmed { background: #e5f7ed; color: #087943; }
.status-pill.failed, .status-pill.conflict { background: #ffebea; color: #b43d36; }
.status-pill.archived { background: #eef1ef; color: #69756f; }
.task-detail-layer { position: fixed; z-index: 1080; top: 0; right: 0; bottom: 0; left: var(--product-sidebar-width, 104px); display: flex; justify-content: flex-end; padding: 12px; background: rgba(23, 39, 31, .3); backdrop-filter: blur(2px); }
.detail-pane { width: 100%; height: 100%; min-width: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #d8e4dd; border-radius: 14px; background: white; box-shadow: -18px 0 54px rgba(19, 48, 33, .2); }
.drawer-topbar { min-height: 52px; flex: 0 0 auto; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 16px; padding: 0 20px; border-bottom: 1px solid #dce8e1; background: #f8fbf9; }
.drawer-topbar > span { color: #415149; font-size: 14px; font-weight: 800; letter-spacing: .5px; }
.drawer-back, .drawer-close { border: 0; background: transparent; color: #537066; }
.drawer-back { width: max-content; padding: 8px 4px; font-weight: 700; }
.drawer-close { justify-self: end; width: 36px; height: 36px; border-radius: 8px; font-size: 27px; line-height: 1; }
.drawer-back:hover, .drawer-close:hover { background: #e9f5ee; color: #078249; }
.detail-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; padding: 18px 24px 24px; }
.detail-heading { padding-bottom: 18px; border-bottom: 1px solid #e2ebe6; }
.detail-kicker { display: flex; gap: 8px; margin-bottom: 8px; }
.detail-heading h4 { margin: 0 0 5px; font-size: 20px; }
.progress-summary { min-width: 110px; display: grid; justify-items: end; }
.progress-summary b { font-size: 26px; color: #0b8d50; }
.progress-summary span { font-size: 12px; color: #78857e; }
.progress-summary em { margin-top: 4px; color: #b43d36; font-size: 12px; font-style: normal; }
.formal-detail-workspace { flex: 1; min-height: 560px; padding-top: 14px; display: flex; flex-direction: column; }
.formal-detail-workspace :deep(.upload-section) { flex: 1; min-height: 0; }
.formal-detail-workspace :deep(.btn-outline-info),
.formal-detail-workspace :deep(button[title="之前添加订单"]) { display: none !important; }
.training-conflict-bar { flex-shrink: 0; display: flex; align-items: center; gap: 9px; margin-bottom: 10px; border: 1px solid #efb5b0; border-radius: 8px; padding: 9px 11px; background: #fff3f2; color: #8d3934; font-size: 12px; }
.training-conflict-bar span { flex: 1; }
.training-conflict-bar button { border: 1px solid #dfaaa6; border-radius: 6px; padding: 6px 10px; background: white; color: #8d3934; }
.training-conflict-bar .danger-soft { background: #c94e47; color: white; border-color: #c94e47; }
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
.create-card.image-mode { width: min(1500px, 96vw); height: 92vh; display: flex; flex-direction: column; overflow: hidden; }
.create-card > header { padding: 20px 24px; border-bottom: 1px solid #e0e8e3; }
.create-card > header button { border: 0; background: transparent; font-size: 25px; color: #68766f; }
.create-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 13px; padding: 20px 24px 10px; }
.source-tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; padding: 12px 24px; }
.source-tabs button { display: grid; gap: 3px; text-align: left; border: 1px solid #d8e4dd; border-radius: 9px; padding: 12px; background: white; color: #495a51; }
.source-tabs button.active { border-color: #0ca45b; background: #ebf9f1; color: #087943; }
.source-tabs small { color: #819087; }
.source-editor { padding: 8px 24px 22px; }
.source-editor textarea { box-sizing: border-box; width: 100%; min-height: 190px; resize: vertical; border: 1px solid #cfded6; border-radius: 9px; padding: 12px; line-height: 1.7; }
.formal-image-workspace { flex: 1; min-height: 0; display: flex; padding: 8px 18px 18px; overflow: hidden; }
.formal-image-workspace :deep(.upload-section) { width: 100%; min-height: 0; }
.formal-image-empty { height: 100%; display: grid; place-content: center; justify-items: center; gap: 8px; color: #7b8882; text-align: center; }
.formal-image-empty b { color: #34443c; font-size: 18px; }
.formal-image-empty small { color: #0b8b50; }
.excel-preview { display: grid; gap: 4px; margin-top: 9px; border-radius: 7px; padding: 9px; background: #f4f7f5; color: #68776f; font-size: 12px; }
.form-error { padding: 0 24px 12px; }
.create-card > footer { justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #e0e8e3; }
.create-card > footer > button:not(.primary-button) { border: 1px solid #d2ded7; border-radius: 7px; padding: 10px 17px; background: white; color: #596960; }
.task-drawer-enter-active, .task-drawer-leave-active { transition: opacity .18s ease; }
.task-drawer-enter-active .detail-pane, .task-drawer-leave-active .detail-pane { transition: transform .22s ease; }
.task-drawer-enter-from, .task-drawer-leave-to { opacity: 0; }
.task-drawer-enter-from .detail-pane, .task-drawer-leave-to .detail-pane { transform: translateX(42px); }
@media (max-width: 1050px) {
  .task-detail-layer { left: 0; padding: 8px; }
  .task-table th:nth-child(2) { width: 30%; }
  .task-table th:nth-child(3) { width: 20%; }
  .item-fields { grid-template-columns: 1fr 1fr; }
  .search-results { grid-template-columns: 1fr 1fr; }
}
</style>
