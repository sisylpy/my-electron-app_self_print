<template>
  <Teleport to="body">
    <Transition name="wechat-import-modal">
      <div v-if="open" class="wechat-import-modal__mask">
        <section
          class="wechat-import-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wechat-import-modal-title"
        >
          <header class="wechat-import-modal__header">
            <div class="wechat-import-modal__brand" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z" />
                <path d="m9 11 2 2 4-4" />
              </svg>
            </div>
            <div class="wechat-import-modal__heading">
              <span v-if="!activeItem">微信订单工作台</span>
              <h2 id="wechat-import-modal-title">{{ modalTitle }}</h2>
              <p v-if="modalSubtitle">{{ modalSubtitle }}</p>
            </div>
            <div v-if="busy || !activeItem" class="wechat-import-modal__progress">
              <span>处理进度</span>
              <strong>{{ progressLabel }}</strong>
            </div>
            <button
              type="button"
              class="wechat-import-modal__later"
              :disabled="busy || selectedImportBusy || customerMatchBusy"
              @click="$emit('close')"
            >
              {{ closeLabel }}
            </button>
          </header>

          <div class="wechat-import-modal__body">
            <nav class="wechat-import-modal__queue" aria-label="微信订单任务队列">
              <div class="wechat-import-modal__queue-heading">
                <div>
                  <strong>{{ busy ? '正在扫描' : '订单任务' }}</strong>
                  <span>{{ busy ? '请稍候' : `共 ${items.length} 个` }}</span>
                </div>
                <em v-if="busy">{{ currentPosition }}/{{ items.length }}</em>
              </div>
              <div class="wechat-import-modal__queue-scroll">
                <ol>
                  <li
                    v-for="(item, index) in items"
                    :key="item.token"
                    :class="[`is-${itemState(item)}`, { 'is-selectable': itemState(item) !== 'completed' }]"
                    :tabindex="itemState(item) === 'completed' ? -1 : 0"
                    @click="selectItem(item)"
                    @keydown.enter.prevent="selectItem(item)"
                    @keydown.space.prevent="selectItem(item)"
                  >
                    <span class="wechat-import-modal__index">{{ index + 1 }}</span>
                    <div class="wechat-import-modal__conversation">
                      <strong>{{ item.conversationTitle || item.customerName }}</strong>
                      <span>{{ item.customerName }} · {{ item.messageCount }} 条消息</span>
                    </div>
                  </li>
                </ol>
              </div>
              <button
                v-if="showSelectedImportAction && (items.length || activeItem)"
                type="button"
                class="wechat-import-modal__selected-import"
                :disabled="busy || selectedImportBusy || customerMatchBusy"
                @click="$emit('import-selected')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z" />
                  <path d="M12 8v6m-3-3h6" />
                </svg>
                {{ selectedImportBusy ? '正在读取…' : '读取当前微信' }}
              </button>
            </nav>

            <main class="wechat-import-modal__workspace">
              <p v-if="workspaceWarning && !activeItem" class="wechat-import-modal__warning">{{ workspaceWarning }}</p>
              <div v-if="activeItem" class="wechat-import-modal__current">
                <div class="wechat-import-modal__current-summary">
                  <span class="wechat-import-modal__current-number">{{ currentPosition }}</span>
                  <div class="wechat-import-modal__current-copy">
                    <span>微信会话</span>
                    <strong>{{ activeItem.conversationTitle || activeItem.customerName }}</strong>
                  </div>
                  <p :title="activePolicyLabel">
                    <span>客户 {{ activeItem.customerName }}</span>
                    <span>{{ activeItem.messageCount }} 条消息</span>
                  </p>
                </div>
                <div class="wechat-import-modal__current-actions">
                  <button
                    type="button"
                    class="wechat-import-modal__remove-current"
                    title="仅从本轮订单任务中移除，不会删除微信消息或客户绑定"
                    @click="removeItem(activeItem)"
                  >移除任务</button>
                  <button
                    type="button"
                    class="wechat-import-modal__refresh"
                    :disabled="refreshing || selectedImportBusy"
                    @click="$emit('refresh')"
                  >{{ refreshing ? '正在获取…' : '获取新消息' }}</button>
                  <button
                    v-if="activeItem.lateMessageCount"
                    type="button"
                    class="wechat-import-modal__merge"
                    @click="$emit('merge-new')"
                  >合并 {{ activeItem.lateMessageCount }} 条</button>
                  <div
                    id="wechat-import-active-actions"
                    class="wechat-import-modal__external-actions"
                    aria-label="当前订单操作"
                  ></div>
                </div>
              </div>
              <p
                v-if="activeItem?.refreshNote || activeItem?.refreshError"
                :class="['wechat-import-modal__sync-note', { 'is-error': activeItem?.refreshError }]"
              >{{ activeItem.refreshError || activeItem.refreshNote }}</p>
              <div
                v-if="!activeItem && busy"
                :class="['wechat-import-modal__scan-state', `is-${scanStatus}`, { 'is-busy': busy }]"
                role="status"
                aria-live="polite"
                :aria-busy="busy"
              >
                <span class="wechat-import-modal__scan-icon" aria-hidden="true">
                  <i v-if="busy"></i>
                  <svg v-else-if="scanStatus === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="m9 9 6 6m0-6-6 6" />
                  </svg>
                  <svg v-else-if="scanStatus === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3 2.8 19h18.4L12 3Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
                <div>
                  <small>微信订单</small>
                  <h3>{{ scanStateTitle }}</h3>
                  <p>{{ scanMessage || '正在读取微信未读订单…' }}</p>
                  <em v-if="busy">读取期间请不要操作左侧微信，完成后将在这里显示订单。</em>
                </div>
              </div>
              <div v-else-if="!activeItem" class="wechat-import-modal__launcher">
                <div class="wechat-import-modal__launcher-copy">
                  <span class="wechat-import-modal__launcher-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z" />
                      <path d="m9 11 2 2 4-4" />
                    </svg>
                  </span>
                  <div>
                    <small>微信订单工作台</small>
                    <h3>请选择读取方式</h3>
                    <p>微信已保留在屏幕左侧。页面不会自动扫描，按当前业务选择下一步即可。</p>
                  </div>
                </div>
                <p
                  v-if="scanMessage"
                  :class="['wechat-import-modal__launcher-notice', `is-${scanStatus}`]"
                >{{ scanMessage }}</p>
                <div class="wechat-import-modal__launcher-actions">
                  <button
                    type="button"
                    class="is-unread"
                    :disabled="selectedImportBusy"
                    @click="$emit('scan-unread')"
                  >
                    <span>读取本次未读的已绑定客户</span>
                    <strong>读未读订单</strong>
                    <em>只检查微信里本次未读的已绑定会话</em>
                  </button>
                  <button
                    type="button"
                    class="is-selected"
                    :disabled="selectedImportBusy"
                    @click="$emit('import-selected')"
                  >
                    <span>按左侧当前会话处理</span>
                    <strong>{{ selectedImportBusy ? '正在查询…' : '查询现在选择的好友转订单' }}</strong>
                    <em>只读取目前正在查看的微信好友</em>
                  </button>
                  <button
                    type="button"
                    class="is-all"
                    :disabled="selectedImportBusy"
                    @click="$emit('scan-all')"
                  >
                    <span>逐个打开客户中心的关联会话</span>
                    <strong>巡查全部已关联微信</strong>
                    <em>不管是否未读，只生成尚未处理的订单</em>
                  </button>
                </div>
              </div>
              <div v-else class="wechat-import-modal__content">
                <slot />
              </div>
            </main>
          </div>

          <Transition name="wechat-scan-report">
            <div
              v-if="scanReportOpen"
              class="wechat-import-modal__automation-mask"
              role="status"
              aria-live="polite"
              :aria-busy="busy"
            >
              <section :class="['wechat-import-modal__automation-panel', `is-${scanStatus}`, { 'is-complete': !busy }]">
                <header class="wechat-import-modal__automation-header">
                  <div class="wechat-import-modal__automation-brand" aria-hidden="true">
                    <span></span><span></span><span></span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z" />
                      <path d="m9 11 2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <small>{{ busy ? '自动化正在执行' : '自动化巡查报告' }}</small>
                    <h3>{{ scanReportTitle }}</h3>
                    <p>{{ scanMessage || '正在连接微信并核对客户会话…' }}</p>
                  </div>
                  <span :class="['wechat-import-modal__automation-state', { 'is-running': busy }]">
                    <i v-if="busy"></i>
                    {{ busy ? '请勿操作微信' : '已完成' }}
                  </span>
                </header>

                <div class="wechat-import-modal__automation-progress">
                  <span :style="{ width: `${scanProgressPercent}%` }"></span>
                </div>

                <div class="wechat-import-modal__automation-content">
                  <section class="wechat-import-modal__automation-current">
                    <span :class="['wechat-import-modal__automation-orbit', { 'is-complete': !busy }]" aria-hidden="true">
                      <template v-if="busy">
                        <i></i><i></i><i></i>
                      </template>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m6.5 12.5 3.2 3.2 7.8-8" />
                      </svg>
                    </span>
                    <small>{{ busy ? '当前正在检查' : '本次巡查结果' }}</small>
                    <h4>{{ busy ? (scanProgress.title || '正在加载客户微信关联') : `${orderingCustomerCount} 家订货` }}</h4>
                    <p v-if="busy && scanProgress.customerName && scanProgress.customerName !== scanProgress.title">
                      对应客户：{{ scanProgress.customerName }}
                    </p>
                    <p v-else-if="!busy">已搜索 {{ finalizedScanResults.length }} 家关联微信</p>
                    <dl>
                      <div>
                        <dt>{{ busy ? '已完成' : '已搜索' }}</dt>
                        <dd>{{ finalizedScanResults.length }}</dd>
                      </div>
                      <div>
                        <dt>{{ busy ? '总会话' : '订货客户' }}</dt>
                        <dd>{{ busy ? (scanProgress.total || '—') : orderingCustomerCount }}</dd>
                      </div>
                      <div>
                        <dt>订单任务</dt>
                        <dd>{{ items.length }}</dd>
                      </div>
                    </dl>
                    <em v-if="busy">系统正在控制左侧微信，请等待当前会话完成后再操作。</em>
                    <em v-else>结果已经保留，可先检查异常项，再进入订单任务。</em>
                  </section>

                  <section class="wechat-import-modal__automation-results">
                    <header>
                      <div>
                        <small>实时查询结果</small>
                        <strong>{{ finalizedScanResults.length }} / {{ scanProgress.total || scanResults.length }}</strong>
                      </div>
                      <span v-if="busy">实时更新中</span>
                    </header>
                    <ol v-if="scanResults.length">
                      <li
                        v-for="item in scanResults"
                        :key="item.title"
                        :class="`is-${item.status || 'checking'}`"
                      >
                        <span class="wechat-import-modal__result-icon" aria-hidden="true">
                          <i v-if="item.status === 'checking'"></i>
                          <template v-else>{{ scanResultSymbol(item) }}</template>
                        </span>
                        <div class="wechat-import-modal__result-name">
                          <strong>{{ item.title }}</strong>
                          <small v-if="item.customerName && item.customerName !== item.title">{{ item.customerName }}</small>
                        </div>
                        <div class="wechat-import-modal__result-status">
                          <strong>{{ scanResultLabel(item) }}</strong>
                          <small>{{ item.message }}</small>
                        </div>
                      </li>
                    </ol>
                    <div v-else class="wechat-import-modal__automation-empty">
                      <i aria-hidden="true"></i>
                      <strong>正在准备客户列表</strong>
                      <span>查询结果会在这里逐条出现</span>
                    </div>
                  </section>
                </div>

                <footer v-if="!busy" class="wechat-import-modal__automation-footer">
                  <p>{{ scanMessage }}</p>
                  <button type="button" @click="$emit('dismiss-scan-report')">
                    {{ scanReportActionLabel }}
                  </button>
                </footer>
              </section>
            </div>
          </Transition>

          <Transition name="wechat-import-action">
            <div
              v-if="selectedImportBusy || actionMessage || unmatchedConversationTitle || customerMatchOpen || groupModeRequest"
              class="wechat-import-modal__action-mask"
              @click.self="groupModeRequest ? $emit('cancel-group-mode') : $emit('dismiss-action-message')"
            >
              <section
                v-if="groupModeRequest"
                class="wechat-import-modal__group-mode-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="wechat-group-mode-title"
              >
                <header>
                  <small>微信群转订单</small>
                  <h3 id="wechat-group-mode-title">选择群订单接收方式</h3>
                  <p>
                    已找到客户 <strong>{{ groupModeRequest.customerName }}</strong>
                    对应的微信群 <strong>“{{ groupModeRequest.title }}”</strong>。请选择哪些群消息可以作为订单。
                  </p>
                </header>
                <div class="wechat-import-modal__group-mode-options">
                  <button type="button" @click="$emit('select-group-mode', 'ALL_MEMBER_MESSAGES')">
                    <span aria-hidden="true">全</span>
                    <strong>专属客户群</strong>
                    <em>接收群内所有成员发送的文字和图片订单</em>
                  </button>
                  <button type="button" @click="$emit('select-group-mode', 'MENTION_SELF_ONLY')">
                    <span aria-hidden="true">@</span>
                    <strong>混合业务群</strong>
                    <em>仅接收明确 @ 当前微信账号的文字和图片订单</em>
                  </button>
                </div>
                <footer>
                  <button type="button" @click="$emit('cancel-group-mode')">取消</button>
                </footer>
              </section>
              <section
                v-else-if="customerMatchOpen"
                class="wechat-import-modal__match-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="wechat-customer-match-title"
              >
                <header>
                  <div>
                    <small>微信好友转订单</small>
                    <h3 id="wechat-customer-match-title">把微信好友关联到客户</h3>
                    <p>以后选择这个微信好友时，会直接进入对应客户的转订单页面。</p>
                  </div>
                  <button
                    type="button"
                    aria-label="返回"
                    :disabled="customerMatchBusy"
                    @click="$emit('cancel-customer-match')"
                  >×</button>
                </header>
                <div class="wechat-import-modal__detected-friend">
                  <span aria-hidden="true">微</span>
                  <div>
                    <small>当前识别到的微信好友</small>
                    <strong>{{ unmatchedConversationTitle }}</strong>
                  </div>
                </div>
                <label class="wechat-import-modal__customer-search">
                  <span aria-hidden="true">⌕</span>
                  <input
                    v-model.trim="customerMatchQuery"
                    type="search"
                    placeholder="搜索客户名称或代号"
                    :disabled="customerMatchBusy"
                  >
                </label>
                <div class="wechat-import-modal__customer-list" role="radiogroup" aria-label="选择关联客户">
                  <button
                    v-for="customer in filteredMatchCustomers"
                    :key="matchCustomerId(customer)"
                    type="button"
                    :class="{ 'is-selected': String(selectedMatchCustomerId) === String(matchCustomerId(customer)) }"
                    :disabled="customerMatchBusy"
                    @click="selectedMatchCustomerId = matchCustomerId(customer)"
                  >
                    <span class="wechat-import-modal__customer-avatar">{{ matchCustomerName(customer).slice(0, 1) }}</span>
                    <span class="wechat-import-modal__customer-copy">
                      <strong>{{ matchCustomerName(customer) }}</strong>
                      <em>{{ matchCustomerCode(customer) }}</em>
                    </span>
                    <span v-if="matchCustomerWechatName(customer)" class="wechat-import-modal__customer-binding">
                      当前关联：{{ matchCustomerWechatName(customer) }}
                    </span>
                    <i aria-hidden="true"></i>
                  </button>
                  <p v-if="!filteredMatchCustomers.length">没有找到符合条件的客户</p>
                </div>
                <p v-if="selectedMatchCustomerWarning" class="wechat-import-modal__replace-warning">
                  {{ selectedMatchCustomerWarning }}
                </p>
                <p v-if="customerMatchError" class="wechat-import-modal__match-error">{{ customerMatchError }}</p>
                <footer>
                  <button type="button" :disabled="customerMatchBusy" @click="$emit('cancel-customer-match')">取消</button>
                  <button
                    type="button"
                    class="is-primary"
                    :disabled="customerMatchBusy || !selectedMatchCustomerId"
                    @click="confirmCustomerMatch"
                  >{{ customerMatchBusy ? '正在关联并读取订单…' : '关联并继续转订单' }}</button>
                </footer>
              </section>
              <section
                v-else-if="unmatchedConversationTitle && !selectedImportBusy"
                class="wechat-import-modal__unmatched-dialog"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="wechat-unmatched-title"
              >
                <span class="wechat-import-modal__action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3 2.8 19h18.4L12 3Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                </span>
                <div>
                  <small>微信好友转订单</small>
                  <h3 id="wechat-unmatched-title">没有找到关联客户</h3>
                  <p>已经识别到当前微信好友，但客户资料里还没有对应关系。</p>
                  <div class="wechat-import-modal__unmatched-name">
                    <span>微信好友</span>
                    <strong>{{ unmatchedConversationTitle }}</strong>
                  </div>
                </div>
                <footer>
                  <button type="button" @click="$emit('dismiss-action-message')">稍后处理</button>
                  <button type="button" class="is-primary" @click="$emit('start-customer-match')">去跟客户匹配</button>
                </footer>
              </section>
              <section
                v-else
                :class="['wechat-import-modal__action-dialog', `is-${actionStatus}`, { 'is-busy': selectedImportBusy }]"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="wechat-import-action-title"
                aria-describedby="wechat-import-action-message"
              >
                <span class="wechat-import-modal__action-icon" aria-hidden="true">
                  <i v-if="selectedImportBusy"></i>
                  <svg v-else-if="actionStatus === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 3 2.8 19h18.4L12 3Z" />
                    <path d="M12 9v4M12 17h.01" />
                  </svg>
                </span>
                <div>
                  <small>微信好友转订单</small>
                  <h3 id="wechat-import-action-title">{{ selectedImportBusy ? '正在识别当前微信好友' : (actionStatus === 'success' ? '已加入转订单' : '无法转订单') }}</h3>
                  <p id="wechat-import-action-message">{{ selectedImportBusy ? '正在查找关联客户并读取订单消息…' : actionMessage }}</p>
                </div>
                <button v-if="!selectedImportBusy" type="button" @click="$emit('dismiss-action-message')">知道了</button>
              </section>
            </div>
          </Transition>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  activeItem: { type: Object, default: null },
  completedTokens: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  scanMessage: { type: String, default: '' },
  scanStatus: { type: String, default: 'info' },
  scanReportOpen: { type: Boolean, default: false },
  scanProgress: { type: Object, default: () => ({}) },
  scanResults: { type: Array, default: () => [] },
  refreshing: { type: Boolean, default: false },
  workspaceWarning: { type: String, default: '' },
  selectedImportBusy: { type: Boolean, default: false },
  showSelectedImportAction: { type: Boolean, default: true },
  actionMessage: { type: String, default: '' },
  actionStatus: { type: String, default: 'warning' },
  unmatchedConversationTitle: { type: String, default: '' },
  customerMatchOpen: { type: Boolean, default: false },
  customerMatchCustomers: { type: Array, default: () => [] },
  customerMatchBusy: { type: Boolean, default: false },
  customerMatchError: { type: String, default: '' },
  groupModeRequest: { type: Object, default: null },
});

const emit = defineEmits([
  'close',
  'refresh',
  'merge-new',
  'select-item',
  'remove-item',
  'scan-unread',
  'scan-all',
  'dismiss-scan-report',
  'import-selected',
  'start-customer-match',
  'cancel-customer-match',
  'confirm-customer-match',
  'select-group-mode',
  'cancel-group-mode',
  'dismiss-action-message',
]);

const customerMatchQuery = ref('');
const selectedMatchCustomerId = ref('');

const completedTokenSet = computed(() => new Set(props.completedTokens.map(String)));
const completedCount = computed(() => completedTokenSet.value.size);
const remainingCount = computed(() => Math.max(0, props.items.length - completedCount.value));
const finalizedScanResults = computed(() => props.scanResults.filter(item => item?.status !== 'checking'));
const orderingCustomerCount = computed(() => (
  finalizedScanResults.value.filter(item => item.status === 'found' && Number(item.itemCount) > 0).length
));
const scanProgressPercent = computed(() => {
  const total = Number(props.scanProgress?.total) || 0;
  if (!total) return props.busy ? 8 : 100;
  if (!props.busy) return 100;
  return Math.max(4, Math.min(100, Math.round((finalizedScanResults.value.length / total) * 100)));
});
const scanReportTitle = computed(() => {
  if (props.busy && props.scanProgress?.total) {
    return `正在巡查 ${props.scanProgress.current} / ${props.scanProgress.total}`;
  }
  if (props.busy) return '正在准备自动化巡查';
  if (props.scanStatus === 'error') return '巡查未能完成';
  if (props.scanStatus === 'warning') return '巡查完成，有项目需检查';
  return '巡查完成';
});
const scanReportActionLabel = computed(() => (
  props.items.length ? `查看 ${props.items.length} 个订单任务` : '返回微信订单工作台'
));
const modalTitle = computed(() => {
  if (props.busy) return '正在读取微信订单';
  if (props.activeItem) return '微信订单确认';
  return '微信订单工作台';
});
const modalSubtitle = computed(() => {
  if (props.busy) return '左侧微信正在逐个检查会话 · 读取结果将在右侧显示';
  if (props.activeItem) return '';
  return '左侧保留微信原窗口 · 选择后才开始读取订单';
});
const progressLabel = computed(() => {
  if (props.busy) return '读取中';
  if (!props.items.length) return '待选择';
  return `${currentPosition.value} / ${props.items.length}`;
});
const closeLabel = computed(() => {
  if (props.busy || props.selectedImportBusy || props.customerMatchBusy) return '处理中';
  if (!props.activeItem) return '关闭';
  return '稍后处理';
});
const scanStateTitle = computed(() => {
  if (props.busy) return '正在读取微信';
  if (props.scanStatus === 'error') return '读取失败';
  if (props.scanStatus === 'warning') return '读取完成，需要检查';
  return '读取完成';
});
const currentPosition = computed(() => {
  if (!props.items.length) return 0;
  const activeIndex = props.items.findIndex(item => item?.token === props.activeItem?.token);
  return activeIndex >= 0 ? activeIndex + 1 : Math.min(props.items.length, completedCount.value + 1);
});
const activePolicyLabel = computed(() => {
  if (props.activeItem?.binding?.conversationKind !== 'group') return '好友单聊';
  return props.activeItem?.binding?.groupMode === 'ALL_MEMBER_MESSAGES'
    ? '群聊：接收全部成员消息'
    : '群聊：仅接收 @ 当前账号';
});
const filteredMatchCustomers = computed(() => {
  const query = customerMatchQuery.value.toLocaleLowerCase();
  if (!query) return props.customerMatchCustomers;
  return props.customerMatchCustomers.filter((customer) => [
    matchCustomerName(customer),
    matchCustomerCode(customer),
    matchCustomerWechatName(customer),
  ].some(value => value.toLocaleLowerCase().includes(query)));
});
const selectedMatchCustomer = computed(() => props.customerMatchCustomers.find(customer => (
  String(matchCustomerId(customer)) === String(selectedMatchCustomerId.value)
)) || null);
const selectedMatchCustomerWarning = computed(() => {
  const current = matchCustomerWechatName(selectedMatchCustomer.value);
  if (!current || current === props.unmatchedConversationTitle) return '';
  return `该客户当前关联“${current}”，确认后将改为“${props.unmatchedConversationTitle}”。`;
});

watch(
  () => [props.customerMatchOpen, props.unmatchedConversationTitle],
  ([open]) => {
    if (!open) return;
    customerMatchQuery.value = '';
    selectedMatchCustomerId.value = '';
  }
);

function matchCustomerId(customer) {
  return customer?.nxDepartmentId ?? customer?.departmentId ?? '';
}

function matchCustomerName(customer) {
  return String(
    customer?.nxDepartmentAttrName
    || customer?.nxDepartmentName
    || customer?.departmentName
    || '未命名客户'
  ).trim();
}

function matchCustomerCode(customer) {
  const code = String(customer?.nxDepartmentEntityId || customer?.nxDepartmentCode || '').trim();
  return code ? `客户代号：${code}` : '暂无客户代号';
}

function matchCustomerWechatName(customer) {
  return String(customer?.nxDepartmentWechatDisplayName || '').trim();
}

function confirmCustomerMatch() {
  if (!selectedMatchCustomerId.value || props.customerMatchBusy) return;
  emit('confirm-customer-match', selectedMatchCustomerId.value);
}

function itemState(item) {
  if (completedTokenSet.value.has(String(item?.token))) return 'completed';
  if (item?.token === props.activeItem?.token) return 'active';
  return 'pending';
}

function scanResultLabel(item) {
  if (item?.status === 'found') return '发现订单';
  if (item?.status === 'empty') return '没有新订单';
  if (item?.status === 'not-found') return '微信未找到';
  if (item?.status === 'error') return '读取失败';
  return '正在检查';
}

function scanResultSymbol(item) {
  if (item?.status === 'found') return '✓';
  if (item?.status === 'empty') return '—';
  if (item?.status === 'not-found') return '?';
  if (item?.status === 'error') return '!';
  return '';
}

function selectItem(item) {
  if (itemState(item) === 'completed') return;
  emit('select-item', item?.token);
}

function removeItem(item) {
  if (itemState(item) === 'completed') return;
  emit('remove-item', item?.token);
}
</script>

<style scoped>
.wechat-import-modal__mask {
  position: fixed;
  z-index: 1450;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 0;
  background: rgba(18, 39, 30, .48);
  backdrop-filter: blur(4px);
}

.wechat-import-modal {
  position: relative;
  display: grid;
  width: 100vw;
  height: 100vh;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: #f6faf8;
  box-shadow: 0 30px 90px rgba(9, 35, 24, .34), 0 4px 16px rgba(9, 35, 24, .12);
}

.wechat-import-modal__header {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 14px;
  padding: 9px 16px;
  border-bottom: 1px solid #dcebe3;
  background: #fff;
}

.wechat-import-modal__brand {
  display: grid;
  width: 42px;
  height: 42px;
  flex: none;
  place-items: center;
  border-radius: 15px;
  color: #fff;
  background: linear-gradient(145deg, #10a762, #087749);
  box-shadow: 0 8px 18px rgba(11, 128, 75, .22);
}
.wechat-import-modal__brand svg { width: 23px; height: 23px; }
.wechat-import-modal__heading { min-width: 0; }
.wechat-import-modal__heading > span { color: #138454; font-size: 10px; font-weight: 900; letter-spacing: .12em; }
.wechat-import-modal__heading h2 { margin: 2px 0 0; color: #183c2d; font-size: 19px; line-height: 1.25; }
.wechat-import-modal__heading p { margin: 3px 0 0; color: #6b7d74; font-size: 11px; }

.wechat-import-modal__progress {
  display: inline-flex;
  min-width: 0;
  margin-left: auto;
  align-items: baseline;
  gap: 7px;
  padding: 6px 11px;
  border-radius: 12px;
  background: #eff8f3;
}
.wechat-import-modal__progress span { color: #6f8479; font-size: 9px; font-weight: 800; }
.wechat-import-modal__progress strong { color: #147a4e; font-size: 17px; }

.wechat-import-modal__later {
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid #cbdcd3;
  border-radius: 9px;
  color: #365848;
  background: #f8fbf9;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}
.wechat-import-modal__later:hover { border-color: #82b89c; background: #edf8f2; }
.wechat-import-modal__later:disabled { cursor: wait; opacity: .6; }

.wechat-import-modal__body {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
}

.wechat-import-modal__queue {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  border-bottom: 1px solid #dcebe3;
  background: #f2f8f5;
}
.wechat-import-modal__queue-heading { display: flex; flex: none; align-items: center; gap: 7px; }
.wechat-import-modal__queue-heading > div { display: grid; min-width: 66px; gap: 1px; }
.wechat-import-modal__queue-heading strong { color: #244638; font-size: 12px; }
.wechat-import-modal__queue-heading span { color: #7b8c84; font-size: 10px; }
.wechat-import-modal__queue-heading em { padding: 4px 8px; border-radius: 10px; color: #147a4e; background: #dff2e8; font-size: 10px; font-style: normal; font-weight: 900; }

.wechat-import-modal__queue-scroll { display: flex; min-width: 0; align-items: center; gap: 5px; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; scrollbar-color: #a9c8b8 transparent; }
.wechat-import-modal__queue ol { display: flex; width: max-content; margin: 0; padding: 0 0 2px; list-style: none; }
.wechat-import-modal__selected-import {
  display: inline-flex;
  min-height: 36px;
  flex: none;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  border: 1px solid #118755;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(145deg, #16a466, #0b7e4c);
  box-shadow: 0 5px 12px rgba(14, 126, 76, .18);
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
  cursor: pointer;
}
.wechat-import-modal__selected-import svg { width: 16px; height: 16px; }
.wechat-import-modal__selected-import:hover { background: linear-gradient(145deg, #0d965a, #086d42); }
.wechat-import-modal__selected-import:disabled { cursor: wait; opacity: .6; }
.wechat-import-modal__queue li {
  display: grid;
  width: 190px;
  flex: none;
  grid-template-columns: 25px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  margin-right: 7px;
  padding: 6px 7px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: rgba(255, 255, 255, .72);
  outline: none;
}
.wechat-import-modal__queue li.is-selectable { cursor: pointer; }
.wechat-import-modal__queue li.is-selectable:hover,
.wechat-import-modal__queue li.is-selectable:focus-visible { border-color: #9fd0b6; background: #fff; }
.wechat-import-modal__queue li.is-active { border-color: #70bd94; background: #fff; box-shadow: 0 5px 14px rgba(27, 99, 67, .09); }
.wechat-import-modal__queue li.is-completed { opacity: .7; background: #eaf4ee; }
.wechat-import-modal__index { display: grid; width: 25px; height: 25px; place-items: center; border-radius: 8px; color: #5f7469; background: #e6efea; font-size: 10px; font-weight: 900; }
.is-active .wechat-import-modal__index { color: #fff; background: #14945b; }
.is-completed .wechat-import-modal__index { color: #20744d; background: #cde9da; }
.wechat-import-modal__conversation { display: grid; min-width: 0; gap: 1px; }
.wechat-import-modal__conversation strong { overflow: hidden; color: #203d31; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__conversation span { overflow: hidden; color: #74877e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__queue-tip { margin: 0; color: #668076; font-size: 9px; white-space: nowrap; }

.wechat-import-modal__workspace {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  padding: 12px;
  background: #f8fbf9;
}
.wechat-import-modal__warning {
  grid-row: 1;
  margin: 0 4px 10px;
  padding: 8px 10px;
  border: 1px solid #efd39c;
  border-radius: 9px;
  color: #8a5b10;
  background: #fff8e9;
  font-size: 10px;
}
.wechat-import-modal__current {
  display: flex;
  min-width: 0;
  grid-row: 2;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 0;
  padding: 9px 11px;
  border: 1px solid #dcebe3;
  border-bottom-color: #e7f0eb;
  border-radius: 13px 13px 0 0;
  background: #fff;
  box-shadow: none;
}
.wechat-import-modal__current-summary { display: flex; min-width: 0; align-items: center; gap: 10px; }
.wechat-import-modal__current-number { display: grid; width: 34px; height: 34px; flex: none; place-items: center; border-radius: 11px; color: #fff; background: #15945b; font-size: 13px; font-weight: 900; }
.wechat-import-modal__current-copy { display: grid; min-width: 80px; gap: 1px; }
.wechat-import-modal__current-copy span { color: #7a8c83; font-size: 9px; font-weight: 700; }
.wechat-import-modal__current-copy strong { overflow: hidden; color: #183d2d; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__current p { display: flex; align-items: center; gap: 6px; margin: 0; }
.wechat-import-modal__current p span { padding: 4px 8px; border-radius: 9px; color: #40705a; background: #eef7f2; font-size: 9px; font-weight: 800; white-space: nowrap; }
.wechat-import-modal__current-actions { display: flex; min-width: 0; align-items: center; justify-content: flex-end; gap: 7px; }
.wechat-import-modal__external-actions { display: flex; align-items: center; gap: 7px; }
.wechat-import-modal__external-actions:empty { display: none; }
.wechat-import-modal__external-actions :deep(.wechat-import-external-actions) { display: flex; align-items: center; gap: 7px; }
.wechat-import-modal__external-actions :deep(.btn) {
  min-height: 32px;
  padding: 0 11px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}
.wechat-import-modal__remove-current,
.wechat-import-modal__refresh,
.wechat-import-modal__merge {
  min-height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
  white-space: nowrap;
}
.wechat-import-modal__remove-current { border: 1px solid #efd0d3; color: #a33f48; background: #fff7f7; }
.wechat-import-modal__remove-current:hover { border-color: #c94c55; color: #fff; background: #c94c55; }
.wechat-import-modal__refresh { border: 1px solid #afd3c0; color: #176a48; background: #f5fbf8; }
.wechat-import-modal__refresh:disabled { cursor: wait; opacity: .65; }
.wechat-import-modal__merge { border: 1px solid #e3a647; color: #fff; background: #d98b13; box-shadow: 0 4px 10px rgba(179, 107, 4, .18); }
.wechat-import-modal__sync-note { grid-row: 3; margin: -4px 4px 8px; color: #1b7d51; font-size: 9px; text-align: right; }
.wechat-import-modal__sync-note.is-error { color: #b23c45; }
.wechat-import-modal__content {
  min-width: 0;
  min-height: 0;
  grid-row: 4;
  overflow: hidden;
  border: 1px solid #dcebe3;
  border-top: 0;
  border-radius: 0 0 13px 13px;
  background: #fff;
}
.wechat-import-modal__content :deep(.upload-section > .row) { --bs-gutter-x: 0; --bs-gutter-y: 0; }
.wechat-import-modal__content :deep(.upload-section > .row > .col-md-3) { border-right: 1px solid #e3ece7; }
.wechat-import-modal__content :deep(.upload-section .card) {
  border: 0;
  border-radius: 0;
  background: #fff;
  box-shadow: none;
}
.wechat-import-modal__content :deep(.upload-section .paste-textarea) {
  border-color: #e1ebe6;
  border-radius: 10px;
  color: #203c30;
  background: #f8fbf9 !important;
  box-shadow: none;
  line-height: 1.55;
}
.wechat-import-modal__content :deep(.upload-section .order-items-section h6) {
  color: #1b3d2f;
  font-size: 15px;
  font-weight: 900;
}
.wechat-import-modal__content :deep(.upload-section .wechat-input-label) {
  padding: 4px 3px 7px;
  color: #315e48;
  font-size: 11px;
}

.wechat-import-modal__launcher {
  display: grid;
  width: min(1040px, calc(100% - 40px));
  grid-row: 2 / 5;
  align-self: center;
  justify-self: center;
  gap: 18px;
  padding: 28px;
  border: 1px solid #c6e0d3;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 22px 58px rgba(20, 73, 49, .11);
}
.wechat-import-modal__launcher-copy { display: flex; align-items: center; gap: 18px; }
.wechat-import-modal__launcher-copy > div { min-width: 0; }
.wechat-import-modal__launcher-icon {
  display: grid;
  width: 62px;
  height: 62px;
  flex: none;
  place-items: center;
  border-radius: 19px;
  color: #fff;
  background: linear-gradient(145deg, #13a665, #08784a);
  box-shadow: 0 10px 24px rgba(13, 126, 77, .2);
}
.wechat-import-modal__launcher-icon svg { width: 31px; height: 31px; }
.wechat-import-modal__launcher-copy small { color: #168255; font-size: 10px; font-weight: 900; letter-spacing: .1em; }
.wechat-import-modal__launcher-copy h3 { margin: 4px 0 7px; color: #193d2e; font-size: 23px; }
.wechat-import-modal__launcher-copy p { margin: 0; color: #63776d; font-size: 13px; line-height: 1.65; }
.wechat-import-modal__launcher-notice {
  margin: 0;
  padding: 10px 13px;
  border: 1px solid #bcdccc;
  border-radius: 10px;
  color: #176d4a;
  background: #f1faf5;
  font-size: 11px;
}
.wechat-import-modal__launcher-notice.is-warning { border-color: #ebd39f; color: #8a5b10; background: #fff9ec; }
.wechat-import-modal__launcher-notice.is-error { border-color: #efbaba; color: #a93636; background: #fff6f6; }
.wechat-import-modal__launcher-actions { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.wechat-import-modal__launcher-actions > button {
  display: grid;
  min-height: 128px;
  align-content: center;
  gap: 7px;
  padding: 20px;
  border: 1px solid #b9d8c9;
  border-radius: 16px;
  text-align: left;
  cursor: pointer;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.wechat-import-modal__launcher-actions > button:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(15, 93, 58, .12); }
.wechat-import-modal__launcher-actions > button:disabled { cursor: wait; opacity: .6; transform: none; box-shadow: none; }
.wechat-import-modal__launcher-actions > button span { font-size: 10px; font-weight: 800; opacity: .72; }
.wechat-import-modal__launcher-actions > button strong { font-size: 17px; }
.wechat-import-modal__launcher-actions > button em { font-size: 11px; font-style: normal; line-height: 1.5; opacity: .78; }
.wechat-import-modal__launcher-actions > button.is-unread { color: #176845; background: #f3fbf7; }
.wechat-import-modal__launcher-actions > button.is-selected { border-color: #178a58; color: #fff; background: linear-gradient(145deg, #16a466, #0b7e4c); }
.wechat-import-modal__launcher-actions > button.is-selected strong { font-size: 15px; }
.wechat-import-modal__launcher-actions > button.is-all { border-color: #91c8ae; color: #125f40; background: linear-gradient(145deg, #f6fcf9, #e6f6ee); }

.wechat-import-modal__automation-mask {
  position: absolute;
  z-index: 15;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 26px;
  background:
    radial-gradient(circle at 18% 18%, rgba(31, 168, 103, .2), transparent 34%),
    rgba(10, 28, 20, .62);
  backdrop-filter: blur(9px) saturate(.78);
}
.wechat-import-modal__automation-panel {
  display: grid;
  width: min(980px, calc(100vw - 52px));
  max-height: calc(100vh - 52px);
  grid-template-rows: auto 4px minmax(0, 1fr) auto;
  overflow: hidden;
  border: 1px solid rgba(165, 220, 190, .78);
  border-radius: 24px;
  color: #214637;
  background: rgba(249, 253, 251, .98);
  box-shadow: 0 30px 90px rgba(0, 18, 10, .38), 0 0 0 1px rgba(255, 255, 255, .66) inset;
}
.wechat-import-modal__automation-header {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 20px 22px 18px;
  background: linear-gradient(135deg, #fff, #f1faf5);
}
.wechat-import-modal__automation-brand {
  position: relative;
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 19px;
  color: #fff;
  background: linear-gradient(145deg, #16aa67, #08794a);
  box-shadow: 0 10px 24px rgba(11, 130, 77, .24);
}
.wechat-import-modal__automation-brand svg { position: relative; z-index: 2; width: 29px; height: 29px; }
.wechat-import-modal__automation-brand > span {
  position: absolute;
  inset: -5px;
  border: 1px solid rgba(24, 156, 94, .28);
  border-radius: 23px;
  opacity: 0;
  animation: wechat-automation-pulse 2.2s ease-out infinite;
}
.wechat-import-modal__automation-brand > span:nth-child(2) { animation-delay: .7s; }
.wechat-import-modal__automation-brand > span:nth-child(3) { animation-delay: 1.4s; }
.wechat-import-modal__automation-panel.is-complete .wechat-import-modal__automation-brand > span {
  opacity: 0;
  animation: none;
}
.wechat-import-modal__automation-header > div:nth-child(2) { min-width: 0; }
.wechat-import-modal__automation-header small { color: #158353; font-size: 10px; font-weight: 900; letter-spacing: .13em; }
.wechat-import-modal__automation-header h3 { margin: 3px 0 5px; color: #173c2c; font-size: 23px; line-height: 1.25; }
.wechat-import-modal__automation-header p { overflow: hidden; margin: 0; color: #60776c; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__automation-state {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border: 1px solid #b8dbc9;
  border-radius: 18px;
  color: #17744d;
  background: #eff9f4;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}
.wechat-import-modal__automation-state.is-running { color: #8a5a0c; border-color: #ead39e; background: #fff8e9; }
.wechat-import-modal__automation-state i,
.wechat-import-modal__result-icon i,
.wechat-import-modal__automation-empty i {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(188, 119, 17, .25);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: wechat-import-spin .8s linear infinite;
}
.wechat-import-modal__automation-progress { height: 4px; overflow: hidden; background: #dcece4; }
.wechat-import-modal__automation-progress > span {
  display: block;
  height: 100%;
  border-radius: 0 4px 4px 0;
  background: linear-gradient(90deg, #0f8f56, #43c987);
  box-shadow: 0 0 12px rgba(29, 176, 104, .42);
  transition: width .36s ease;
}
.wechat-import-modal__automation-panel.is-complete .wechat-import-modal__automation-progress > span { box-shadow: none; }
.wechat-import-modal__automation-content {
  display: grid;
  min-height: 0;
  grid-template-columns: minmax(260px, .78fr) minmax(390px, 1.22fr);
  background: #f6faf8;
}
.wechat-import-modal__automation-current {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  border-right: 1px solid #dceae3;
  text-align: center;
  background:
    radial-gradient(circle at 50% 37%, rgba(32, 180, 107, .11), transparent 30%),
    #fbfefc;
}
.wechat-import-modal__automation-orbit {
  position: relative;
  display: grid;
  width: 92px;
  height: 92px;
  margin-bottom: 18px;
  place-items: center;
  border: 1px solid #b8dfca;
  border-radius: 50%;
  background: rgba(235, 249, 242, .88);
  box-shadow: 0 0 0 12px rgba(229, 246, 237, .6);
}
.wechat-import-modal__automation-orbit::before {
  width: 31px;
  height: 31px;
  border-radius: 11px;
  background: linear-gradient(145deg, #18a967, #087d4c);
  box-shadow: 0 7px 18px rgba(12, 130, 77, .22);
  content: '';
  transition: width .26s ease, height .26s ease, border-radius .26s ease, box-shadow .26s ease;
}
.wechat-import-modal__automation-orbit > i {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #19a765;
  box-shadow: 0 0 0 4px rgba(25, 167, 101, .14);
  animation: wechat-automation-orbit 2.4s linear infinite;
}
.wechat-import-modal__automation-orbit > i:nth-child(2) { animation-delay: -.8s; }
.wechat-import-modal__automation-orbit > i:nth-child(3) { animation-delay: -1.6s; }
.wechat-import-modal__automation-orbit > svg {
  position: absolute;
  z-index: 1;
  width: 29px;
  height: 29px;
  color: #fff;
  animation: wechat-automation-finish-check .42s .12s cubic-bezier(.2, .9, .28, 1.25) both;
}
.wechat-import-modal__automation-orbit.is-complete {
  border-color: #8ed2ad;
  background: #e8f8ef;
  box-shadow: 0 0 0 12px rgba(224, 245, 234, .72);
  animation: wechat-automation-finish .58s cubic-bezier(.2, .9, .28, 1.15) both;
}
.wechat-import-modal__automation-orbit.is-complete::before {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  box-shadow: 0 9px 22px rgba(12, 130, 77, .2);
}
.wechat-import-modal__automation-current > small { color: #168353; font-size: 10px; font-weight: 900; letter-spacing: .1em; }
.wechat-import-modal__automation-current h4 {
  max-width: 100%;
  overflow: hidden;
  margin: 6px 0;
  color: #173b2c;
  font-size: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wechat-import-modal__automation-current > p { margin: 0; color: #74877e; font-size: 11px; }
.wechat-import-modal__automation-current dl { display: grid; width: 100%; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 24px 0 16px; }
.wechat-import-modal__automation-current dl > div { display: grid; gap: 3px; padding: 10px 6px; border: 1px solid #d8e9e0; border-radius: 12px; background: #fff; }
.wechat-import-modal__automation-current dt { color: #7b8e84; font-size: 9px; }
.wechat-import-modal__automation-current dd { margin: 0; color: #176d49; font-size: 17px; font-weight: 900; }
.wechat-import-modal__automation-current em { color: #7a8d83; font-size: 10px; font-style: normal; line-height: 1.65; }
.wechat-import-modal__automation-results { display: grid; min-width: 0; min-height: 0; grid-template-rows: auto minmax(0, 1fr); padding: 22px; }
.wechat-import-modal__automation-results > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.wechat-import-modal__automation-results > header > div { display: flex; align-items: baseline; gap: 8px; }
.wechat-import-modal__automation-results > header small { color: #637c70; font-size: 10px; font-weight: 900; letter-spacing: .08em; }
.wechat-import-modal__automation-results > header strong { color: #174e37; font-size: 14px; }
.wechat-import-modal__automation-results > header > span { padding: 4px 8px; border-radius: 10px; color: #13754c; background: #e5f5ed; font-size: 9px; font-weight: 900; }
.wechat-import-modal__automation-results ol { display: grid; min-height: 0; align-content: start; gap: 8px; margin: 0; padding: 0 4px 0 0; overflow-y: auto; list-style: none; }
.wechat-import-modal__automation-results li {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) minmax(150px, auto);
  align-items: center;
  gap: 10px;
  padding: 10px 11px;
  border: 1px solid #dbe8e1;
  border-radius: 12px;
  background: #fff;
  transition: border-color .18s ease, transform .18s ease, box-shadow .18s ease;
}
.wechat-import-modal__automation-results li.is-checking { border-color: #e6c98c; background: #fffaf0; box-shadow: 0 5px 16px rgba(152, 100, 13, .08); transform: translateY(-1px); }
.wechat-import-modal__automation-results li.is-found { border-color: #9ed0b6; background: #f5fcf8; }
.wechat-import-modal__automation-results li.is-not-found,
.wechat-import-modal__automation-results li.is-error { border-color: #e9b9bc; background: #fff7f7; }
.wechat-import-modal__result-icon { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 11px; color: #5d776a; background: #eaf2ee; font-size: 14px; font-weight: 900; }
.is-checking .wechat-import-modal__result-icon { color: #a06b13; background: #fff0d2; }
.is-found .wechat-import-modal__result-icon { color: #fff; background: #15935a; }
.is-not-found .wechat-import-modal__result-icon,
.is-error .wechat-import-modal__result-icon { color: #fff; background: #c55359; }
.wechat-import-modal__result-name,
.wechat-import-modal__result-status { display: grid; min-width: 0; gap: 2px; }
.wechat-import-modal__result-name strong { overflow: hidden; color: #223f32; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__result-name small { overflow: hidden; color: #7b8b83; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__result-status { justify-items: end; text-align: right; }
.wechat-import-modal__result-status strong { color: #557064; font-size: 10px; }
.is-found .wechat-import-modal__result-status strong { color: #137049; }
.is-not-found .wechat-import-modal__result-status strong,
.is-error .wechat-import-modal__result-status strong { color: #ad4148; }
.wechat-import-modal__result-status small { max-width: 220px; overflow: hidden; color: #85928c; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__automation-empty { display: grid; align-self: center; justify-items: center; gap: 6px; color: #799086; text-align: center; }
.wechat-import-modal__automation-empty i { width: 22px; height: 22px; margin-bottom: 4px; color: #16885a; border-color: rgba(22, 136, 90, .2); }
.wechat-import-modal__automation-empty strong { color: #3e6251; font-size: 13px; }
.wechat-import-modal__automation-empty span { font-size: 10px; }
.wechat-import-modal__automation-footer { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 15px 22px; border-top: 1px solid #dceae3; background: #fff; }
.wechat-import-modal__automation-footer p { margin: 0; color: #60776c; font-size: 11px; line-height: 1.55; }
.wechat-import-modal__automation-footer button {
  min-height: 40px;
  flex: none;
  padding: 0 18px;
  border: 0;
  border-radius: 11px;
  color: #fff;
  background: linear-gradient(145deg, #16a466, #0b7e4c);
  box-shadow: 0 7px 18px rgba(13, 126, 76, .2);
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}
.wechat-import-modal__automation-panel.is-error .wechat-import-modal__automation-progress > span { background: #c84f56; box-shadow: none; }

.wechat-import-modal__action-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(19, 43, 32, .36);
  backdrop-filter: blur(4px);
}
.wechat-import-modal__action-dialog {
  display: grid;
  width: min(480px, calc(100vw - 40px));
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 24px;
  border: 1px solid #edc06d;
  border-radius: 20px;
  color: #8a5b10;
  background: #fffcf4;
  box-shadow: 0 24px 70px rgba(18, 48, 34, .25);
}
.wechat-import-modal__action-dialog.is-success { border-color: #8ec9aa; color: #137047; background: #f7fffa; }
.wechat-import-modal__action-icon {
  display: grid;
  width: 58px;
  height: 58px;
  grid-row: 1 / 3;
  place-items: center;
  border-radius: 17px;
  color: #fff;
  background: #d18a1d;
}
.wechat-import-modal__action-dialog.is-success .wechat-import-modal__action-icon { background: #118555; }
.wechat-import-modal__action-icon svg { width: 30px; height: 30px; }
.wechat-import-modal__action-icon i {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255, 255, 255, .42);
  border-top-color: #fff;
  border-radius: 50%;
  animation: wechat-import-spin .8s linear infinite;
}
.wechat-import-modal__action-dialog > div { min-width: 0; }
.wechat-import-modal__action-dialog small { font-size: 10px; font-weight: 900; letter-spacing: .1em; opacity: .78; }
.wechat-import-modal__action-dialog h3 { margin: 3px 0 6px; color: #3c2d13; font-size: 21px; }
.wechat-import-modal__action-dialog.is-success h3 { color: #183e2e; }
.wechat-import-modal__action-dialog p { margin: 0; color: #71552a; font-size: 13px; line-height: 1.7; }
.wechat-import-modal__action-dialog.is-success p { color: #38644f; }
.wechat-import-modal__action-dialog > button {
  min-height: 36px;
  grid-column: 2;
  justify-self: start;
  padding: 0 18px;
  border: 0;
  border-radius: 9px;
  color: #fff;
  background: #b87512;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}
.wechat-import-modal__action-dialog.is-success > button { background: #118555; }

.wechat-import-modal__group-mode-dialog {
  width: min(620px, calc(100vw - 40px));
  padding: 25px;
  border: 1px solid #8bc8aa;
  border-radius: 22px;
  color: #244738;
  background: #fbfffc;
  box-shadow: 0 28px 80px rgba(18, 48, 34, .28);
}
.wechat-import-modal__group-mode-dialog header small { color: #188253; font-size: 10px; font-weight: 900; letter-spacing: .1em; }
.wechat-import-modal__group-mode-dialog header h3 { margin: 4px 0 8px; color: #173b2c; font-size: 22px; }
.wechat-import-modal__group-mode-dialog header p { margin: 0; color: #577164; font-size: 12px; line-height: 1.7; }
.wechat-import-modal__group-mode-dialog header p strong { color: #214c39; }
.wechat-import-modal__group-mode-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
.wechat-import-modal__group-mode-options > button {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  gap: 2px 11px;
  min-height: 96px;
  align-items: center;
  padding: 14px;
  border: 1px solid #c9ddd3;
  border-radius: 14px;
  color: #2b4b3d;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color .16s ease, background .16s ease, transform .16s ease;
}
.wechat-import-modal__group-mode-options > button:hover { border-color: #19905a; background: #f0faf5; transform: translateY(-1px); }
.wechat-import-modal__group-mode-options > button > span {
  display: grid;
  width: 38px;
  height: 38px;
  grid-row: 1 / 3;
  place-items: center;
  border-radius: 11px;
  color: #fff;
  background: #15915a;
  font-size: 14px;
  font-weight: 900;
}
.wechat-import-modal__group-mode-options strong { align-self: end; color: #183d2d; font-size: 14px; }
.wechat-import-modal__group-mode-options em { align-self: start; color: #6b8076; font-size: 10px; font-style: normal; line-height: 1.45; }
.wechat-import-modal__group-mode-dialog footer { display: flex; justify-content: flex-end; margin-top: 16px; }
.wechat-import-modal__group-mode-dialog footer button {
  min-height: 38px;
  padding: 0 17px;
  border: 1px solid #c7d8d0;
  border-radius: 10px;
  color: #527064;
  background: #fff;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}

.wechat-import-modal__unmatched-dialog,
.wechat-import-modal__match-dialog {
  width: min(620px, calc(100vw - 40px));
  border: 1px solid #dfbc77;
  border-radius: 22px;
  background: #fffdf8;
  box-shadow: 0 28px 80px rgba(18, 48, 34, .28);
}
.wechat-import-modal__unmatched-dialog {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 17px;
  padding: 26px;
  color: #85570f;
}
.wechat-import-modal__unmatched-dialog > div { min-width: 0; }
.wechat-import-modal__unmatched-dialog small,
.wechat-import-modal__match-dialog small { color: #a56c15; font-size: 10px; font-weight: 900; letter-spacing: .1em; }
.wechat-import-modal__unmatched-dialog h3,
.wechat-import-modal__match-dialog h3 { margin: 4px 0 7px; color: #382c18; font-size: 21px; }
.wechat-import-modal__unmatched-dialog p,
.wechat-import-modal__match-dialog header p { margin: 0; color: #735e3a; font-size: 12px; line-height: 1.65; }
.wechat-import-modal__unmatched-name {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #ead3a8;
  border-radius: 12px;
  background: #fff8e9;
}
.wechat-import-modal__unmatched-name span { color: #907044; font-size: 10px; font-weight: 800; }
.wechat-import-modal__unmatched-name strong { overflow: hidden; color: #3c2b0d; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__unmatched-dialog footer {
  display: flex;
  grid-column: 2;
  gap: 9px;
  margin-top: 2px;
}
.wechat-import-modal__unmatched-dialog footer button,
.wechat-import-modal__match-dialog footer button {
  min-height: 38px;
  padding: 0 17px;
  border: 1px solid #d8c8a9;
  border-radius: 10px;
  color: #705728;
  background: #fff;
  font-size: 11px;
  font-weight: 900;
  cursor: pointer;
}
.wechat-import-modal__unmatched-dialog footer button.is-primary,
.wechat-import-modal__match-dialog footer button.is-primary { border-color: #118555; color: #fff; background: #118555; }

.wechat-import-modal__match-dialog {
  display: grid;
  max-height: min(720px, calc(100vh - 40px));
  grid-template-rows: auto auto auto minmax(120px, 1fr) auto auto;
  gap: 13px;
  padding: 24px;
  overflow: hidden;
}
.wechat-import-modal__match-dialog > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.wechat-import-modal__match-dialog > header > div { min-width: 0; }
.wechat-import-modal__match-dialog > header > button {
  width: 34px;
  height: 34px;
  flex: none;
  border: 0;
  border-radius: 10px;
  color: #6f7e76;
  background: #edf3f0;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.wechat-import-modal__detected-friend {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 11px 13px;
  border: 1px solid #b9ddca;
  border-radius: 12px;
  background: #f1faf5;
}
.wechat-import-modal__detected-friend > span,
.wechat-import-modal__customer-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  color: #fff;
  background: #12935a;
  font-size: 13px;
  font-weight: 900;
}
.wechat-import-modal__detected-friend > div { display: grid; gap: 1px; min-width: 0; }
.wechat-import-modal__detected-friend small { color: #628072; font-size: 9px; letter-spacing: 0; }
.wechat-import-modal__detected-friend strong { overflow: hidden; color: #173c2c; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__customer-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid #cbdcd3;
  border-radius: 10px;
  color: #668076;
  background: #fff;
}
.wechat-import-modal__customer-search:focus-within { border-color: #4baa78; box-shadow: 0 0 0 3px rgba(29, 151, 91, .1); }
.wechat-import-modal__customer-search input { width: 100%; min-height: 40px; border: 0; outline: 0; color: #223d31; background: transparent; font-size: 12px; }
.wechat-import-modal__customer-list {
  display: grid;
  align-content: start;
  gap: 7px;
  min-height: 0;
  padding-right: 3px;
  overflow-y: auto;
}
.wechat-import-modal__customer-list > button {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) minmax(0, auto) 17px;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 11px;
  border: 1px solid #d9e5df;
  border-radius: 11px;
  color: #385247;
  background: #fff;
  text-align: left;
  cursor: pointer;
}
.wechat-import-modal__customer-list > button:hover { border-color: #8bc5a7; background: #f7fcf9; }
.wechat-import-modal__customer-list > button.is-selected { border-color: #15915a; background: #effaf4; box-shadow: 0 0 0 2px rgba(21, 145, 90, .1); }
.wechat-import-modal__customer-copy { display: grid; min-width: 0; gap: 2px; }
.wechat-import-modal__customer-copy strong { overflow: hidden; color: #213e31; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__customer-copy em { color: #7b8a83; font-size: 9px; font-style: normal; }
.wechat-import-modal__customer-binding { max-width: 190px; overflow: hidden; color: #8a661e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__customer-list > button > i { width: 15px; height: 15px; border: 1px solid #b9c9c1; border-radius: 50%; background: #fff; }
.wechat-import-modal__customer-list > button.is-selected > i { border: 4px solid #15915a; }
.wechat-import-modal__customer-list > p { margin: 24px 0; color: #7c8d85; font-size: 12px; text-align: center; }
.wechat-import-modal__replace-warning,
.wechat-import-modal__match-error { margin: 0; padding: 9px 11px; border-radius: 9px; font-size: 10px; line-height: 1.5; }
.wechat-import-modal__replace-warning { color: #805916; background: #fff5df; }
.wechat-import-modal__match-error { color: #a4383f; background: #fff0f1; }
.wechat-import-modal__match-dialog footer { display: flex; justify-content: flex-end; gap: 9px; }
.wechat-import-modal__match-dialog footer button:disabled,
.wechat-import-modal__unmatched-dialog footer button:disabled { cursor: wait; opacity: .55; }

@media (max-width: 720px) {
  .wechat-import-modal__group-mode-options { grid-template-columns: 1fr; }
}

.wechat-import-action-enter-active,
.wechat-import-action-leave-active { transition: opacity .16s ease; }
.wechat-import-action-enter-active .wechat-import-modal__action-dialog,
.wechat-import-action-leave-active .wechat-import-modal__action-dialog { transition: transform .16s ease, opacity .16s ease; }
.wechat-import-action-enter-from,
.wechat-import-action-leave-to { opacity: 0; }
.wechat-import-action-enter-from .wechat-import-modal__action-dialog,
.wechat-import-action-leave-to .wechat-import-modal__action-dialog { opacity: 0; transform: translateY(8px) scale(.98); }

.wechat-import-modal__scan-state {
  display: flex;
  width: min(520px, calc(100% - 32px));
  min-height: 176px;
  grid-row: 2 / 5;
  align-self: center;
  justify-self: center;
  align-items: center;
  gap: 20px;
  padding: 26px 30px;
  border: 1px solid #b9dacb;
  border-radius: 18px;
  color: #146844;
  background: #fff;
  box-shadow: 0 18px 45px rgba(20, 73, 49, .11);
}
.wechat-import-modal__scan-state.is-warning { border-color: #ead095; color: #94620b; background: #fffbf1; }
.wechat-import-modal__scan-state.is-error { border-color: #efbaba; color: #a93636; background: #fff8f8; }
.wechat-import-modal__scan-icon {
  display: grid;
  width: 58px;
  height: 58px;
  flex: none;
  place-items: center;
  border-radius: 18px;
  color: #fff;
  background: currentColor;
}
.wechat-import-modal__scan-icon svg { width: 30px; height: 30px; color: #fff; }
.wechat-import-modal__scan-icon i {
  width: 27px;
  height: 27px;
  border: 3px solid rgba(255, 255, 255, .4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: wechat-import-spin .8s linear infinite;
}
.wechat-import-modal__scan-state > div { min-width: 0; }
.wechat-import-modal__scan-state small { display: block; opacity: .72; font-size: 10px; font-weight: 900; letter-spacing: .1em; }
.wechat-import-modal__scan-state h3 { margin: 4px 0 7px; color: #1c3d2f; font-size: 20px; }
.wechat-import-modal__scan-state p { margin: 0; color: #536a5f; font-size: 13px; line-height: 1.7; }
.wechat-import-modal__scan-state em { display: block; margin-top: 9px; color: #7b8d84; font-size: 10px; font-style: normal; }
.wechat-import-modal__scan-state.is-warning h3,
.wechat-import-modal__scan-state.is-warning p { color: #76500d; }
.wechat-import-modal__scan-state.is-error h3,
.wechat-import-modal__scan-state.is-error p { color: #8e3535; }

@keyframes wechat-import-spin { to { transform: rotate(360deg); } }
@keyframes wechat-automation-pulse {
  0% { opacity: .7; transform: scale(.86); }
  100% { opacity: 0; transform: scale(1.34); }
}
@keyframes wechat-automation-orbit {
  from { transform: rotate(0deg) translateX(42px) rotate(0deg); }
  to { transform: rotate(360deg) translateX(42px) rotate(-360deg); }
}
@keyframes wechat-automation-finish {
  0% { transform: scale(.82); }
  55% { transform: scale(1.09); }
  100% { transform: scale(1); }
}
@keyframes wechat-automation-finish-check {
  from { opacity: 0; transform: scale(.45) rotate(-16deg); }
  to { opacity: 1; transform: scale(1) rotate(0deg); }
}

.wechat-scan-report-enter-active,
.wechat-scan-report-leave-active { transition: opacity .22s ease; }
.wechat-scan-report-enter-active .wechat-import-modal__automation-panel,
.wechat-scan-report-leave-active .wechat-import-modal__automation-panel { transition: transform .24s ease, opacity .2s ease; }
.wechat-scan-report-enter-from,
.wechat-scan-report-leave-to { opacity: 0; }
.wechat-scan-report-enter-from .wechat-import-modal__automation-panel,
.wechat-scan-report-leave-to .wechat-import-modal__automation-panel { opacity: 0; transform: translateY(12px) scale(.975); }

.wechat-import-modal-enter-active,
.wechat-import-modal-leave-active { transition: opacity .2s ease; }
.wechat-import-modal-enter-active .wechat-import-modal,
.wechat-import-modal-leave-active .wechat-import-modal { transition: transform .2s ease, opacity .2s ease; }
.wechat-import-modal-enter-from,
.wechat-import-modal-leave-to { opacity: 0; }
.wechat-import-modal-enter-from .wechat-import-modal,
.wechat-import-modal-leave-to .wechat-import-modal { opacity: 0; transform: translateY(12px) scale(.98); }

@media (max-width: 1280px) {
  .wechat-import-modal__heading p { display: none; }
  .wechat-import-modal__queue { grid-template-columns: auto minmax(0, 1fr) auto; }
  .wechat-import-modal__queue-tip { display: none; }
  .wechat-import-modal__queue li { width: 174px; }
  .wechat-import-modal__current-actions { flex-wrap: wrap; }
  .wechat-import-modal__content :deep(.upload-section > .row) { --bs-gutter-x: .6rem; --bs-gutter-y: .6rem; }
  .wechat-import-modal__content :deep(.upload-section > .row > .col-md-4) { width: 40%; }
  .wechat-import-modal__content :deep(.upload-section > .row > .col-md-8) { width: 60%; }
  .wechat-import-modal__content :deep(.upload-section .card.h-100.p-3) { padding: .65rem !important; }
  .wechat-import-modal__content :deep(.upload-section .d-flex.gap-2.mt-2.flex-wrap) { margin-bottom: 6px !important; }
  .wechat-import-modal__content :deep(.upload-section .d-flex.gap-2.w-100) { display: grid !important; grid-template-columns: 1fr; gap: 5px !important; }
  .wechat-import-modal__content :deep(.upload-section .d-flex.gap-2.w-100 > button) { min-height: 29px; font-size: 10px; white-space: nowrap; }
  .wechat-import-modal__launcher { width: min(940px, calc(100% - 28px)); padding: 22px; }
  .wechat-import-modal__launcher-actions > button { min-height: 112px; padding: 16px; }
  .wechat-import-modal__automation-mask { padding: 18px; }
  .wechat-import-modal__automation-panel { width: min(900px, calc(100vw - 36px)); max-height: calc(100vh - 36px); }
  .wechat-import-modal__automation-content { grid-template-columns: minmax(230px, .68fr) minmax(360px, 1.32fr); }
  .wechat-import-modal__automation-current { padding: 22px; }
  .wechat-import-modal__automation-orbit { width: 76px; height: 76px; }
  .wechat-import-modal__automation-orbit > i { animation-name: wechat-automation-orbit-compact; }
}

@keyframes wechat-automation-orbit-compact {
  from { transform: rotate(0deg) translateX(34px) rotate(0deg); }
  to { transform: rotate(360deg) translateX(34px) rotate(-360deg); }
}

@media (max-width: 760px) {
  .wechat-import-modal__automation-header { grid-template-columns: 48px minmax(0, 1fr); padding: 16px; }
  .wechat-import-modal__automation-brand { width: 48px; height: 48px; }
  .wechat-import-modal__automation-state { display: none; }
  .wechat-import-modal__automation-content { grid-template-columns: 1fr; }
  .wechat-import-modal__automation-current { display: none; }
  .wechat-import-modal__automation-results { padding: 16px; }
  .wechat-import-modal__automation-results li { grid-template-columns: 32px minmax(0, 1fr); }
  .wechat-import-modal__result-status { grid-column: 2; justify-items: start; text-align: left; }
  .wechat-import-modal__automation-footer { align-items: stretch; flex-direction: column; }
}
</style>
