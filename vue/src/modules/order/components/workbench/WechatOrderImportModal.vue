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
              <span>微信订单工作台</span>
              <h2 id="wechat-import-modal-title">{{ modalTitle }}</h2>
              <p>{{ modalSubtitle }}</p>
            </div>
            <div class="wechat-import-modal__progress">
              <span>处理进度</span>
              <strong>{{ progressLabel }}</strong>
            </div>
            <button
              type="button"
              class="wechat-import-modal__later"
              :disabled="busy || selectedImportBusy"
              @click="$emit('close')"
            >
              {{ closeLabel }}
            </button>
          </header>

          <div class="wechat-import-modal__body">
            <nav class="wechat-import-modal__queue" aria-label="微信会话处理队列">
              <div class="wechat-import-modal__queue-heading">
                <div>
                  <strong>{{ busy ? '正在扫描微信' : '微信会话' }}</strong>
                  <span>{{ busy ? '请在左侧查看读取过程' : `剩余 ${remainingCount} 个` }}</span>
                </div>
                <em>{{ currentPosition }}/{{ items.length }}</em>
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
                      <span>{{ item.customerName }} · {{ item.messageCount }} 条</span>
                    </div>
                    <div class="wechat-import-modal__item-actions">
                      <span class="wechat-import-modal__state">{{ itemStateLabel(item) }}</span>
                      <button
                        v-if="itemState(item) !== 'completed'"
                        type="button"
                        title="仅从本轮待处理列表移除，不会删除微信消息或客户绑定"
                        @click.stop="removeItem(item)"
                      >移除</button>
                    </div>
                  </li>
                </ol>
              </div>
              <button
                type="button"
                class="wechat-import-modal__selected-import"
                :disabled="busy || selectedImportBusy"
                @click="$emit('import-selected')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z" />
                  <path d="M12 8v6m-3-3h6" />
                </svg>
                {{ selectedImportBusy ? '正在转订单…' : '转所选微信好友订单' }}
              </button>
              <p class="wechat-import-modal__queue-tip">
                {{ items.length ? '点击切换会话，保存后自动进入下一条' : (busy ? '正在读取未读会话' : '本轮没有待处理会话') }}
              </p>
            </nav>

            <main class="wechat-import-modal__workspace">
              <p v-if="workspaceWarning" class="wechat-import-modal__warning">{{ workspaceWarning }}</p>
              <div v-if="activeItem" class="wechat-import-modal__current">
                <div>
                  <span>当前微信会话</span>
                  <strong>{{ activeItem.conversationTitle || activeItem.customerName }}</strong>
                </div>
                <div class="wechat-import-modal__current-actions">
                  <p>
                    对应门店 <strong>{{ activeItem.customerName }}</strong>
                    <span>{{ activeItem.messageCount }} 条新消息</span>
                    <span class="wechat-import-modal__policy">{{ activePolicyLabel }}</span>
                  </p>
                  <button
                    type="button"
                    class="wechat-import-modal__refresh"
                    :disabled="refreshing || selectedImportBusy"
                    @click="$emit('refresh')"
                  >{{ refreshing ? '正在获取最新消息…' : '手动获取最新消息' }}</button>
                  <button
                    v-if="activeItem.lateMessageCount"
                    type="button"
                    class="wechat-import-modal__merge"
                    @click="$emit('merge-new')"
                  >合并 {{ activeItem.lateMessageCount }} 条新消息并重新解析</button>
                </div>
              </div>
              <p
                v-if="activeItem?.refreshNote || activeItem?.refreshError"
                :class="['wechat-import-modal__sync-note', { 'is-error': activeItem?.refreshError }]"
              >{{ activeItem.refreshError || activeItem.refreshNote }}</p>
              <div
                v-if="!activeItem"
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
                  <p>{{ scanMessage || '准备读取微信未读订单…' }}</p>
                  <em v-if="busy">读取期间请不要操作左侧微信，完成后将在这里显示订单。</em>
                </div>
              </div>
              <div v-else class="wechat-import-modal__content">
                <slot />
              </div>
            </main>
          </div>

          <Transition name="wechat-import-action">
            <div
              v-if="selectedImportBusy || actionMessage"
              class="wechat-import-modal__action-mask"
              @click.self="$emit('dismiss-action-message')"
            >
              <section
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
import { computed } from 'vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  items: { type: Array, default: () => [] },
  activeItem: { type: Object, default: null },
  completedTokens: { type: Array, default: () => [] },
  busy: { type: Boolean, default: false },
  scanMessage: { type: String, default: '' },
  scanStatus: { type: String, default: 'info' },
  refreshing: { type: Boolean, default: false },
  workspaceWarning: { type: String, default: '' },
  selectedImportBusy: { type: Boolean, default: false },
  actionMessage: { type: String, default: '' },
  actionStatus: { type: String, default: 'warning' },
});

const emit = defineEmits([
  'close',
  'refresh',
  'merge-new',
  'select-item',
  'remove-item',
  'import-selected',
  'dismiss-action-message',
]);

const completedTokenSet = computed(() => new Set(props.completedTokens.map(String)));
const completedCount = computed(() => completedTokenSet.value.size);
const remainingCount = computed(() => Math.max(0, props.items.length - completedCount.value));
const modalTitle = computed(() => {
  if (props.busy) return '正在读取微信订单';
  if (props.activeItem) return '确认微信消息并转换为订单';
  return '微信订单读取结果';
});
const modalSubtitle = computed(() => {
  if (props.busy) return '左侧微信正在逐个检查未读会话 · 读取结果将在右侧显示';
  if (props.activeItem) return `左侧微信原窗口 · 顶部会话切换 · 下方订单，共 ${props.items.length} 个会话`;
  return '左侧保留微信原窗口 · 右侧显示本轮读取结果';
});
const progressLabel = computed(() => {
  if (props.busy) return '读取中';
  if (!props.items.length) return props.scanStatus === 'error' ? '失败' : '完成';
  return `${currentPosition.value} / ${props.items.length}`;
});
const closeLabel = computed(() => {
  if (props.busy || props.selectedImportBusy) return '处理中';
  if (!props.activeItem) return '完成';
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

function itemState(item) {
  if (completedTokenSet.value.has(String(item?.token))) return 'completed';
  if (item?.token === props.activeItem?.token) return 'active';
  return 'pending';
}

function itemStateLabel(item) {
  const state = itemState(item);
  if (state === 'completed') return '已保存';
  if (state === 'active') return '处理中';
  return '待处理';
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
  min-height: 68px;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
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
.wechat-import-modal__heading h2 { margin: 2px 0 0; color: #183c2d; font-size: 17px; line-height: 1.3; }
.wechat-import-modal__heading p { margin: 3px 0 0; color: #6b7d74; font-size: 11px; }

.wechat-import-modal__progress {
  display: grid;
  min-width: 88px;
  margin-left: auto;
  text-align: right;
}
.wechat-import-modal__progress span { color: #7b8a83; font-size: 10px; }
.wechat-import-modal__progress strong { color: #147a4e; font-size: 20px; }

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
  grid-template-columns: auto minmax(0, 1fr) auto auto;
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
  padding: 0 13px;
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
  grid-template-columns: 25px minmax(0, 1fr) auto;
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
.wechat-import-modal__state { padding: 3px 6px; border-radius: 8px; color: #6e7d76; background: #edf1ef; font-size: 9px; font-weight: 800; white-space: nowrap; }
.is-active .wechat-import-modal__state { color: #0d7848; background: #dff5e9; }
.is-completed .wechat-import-modal__state { color: #3d7459; background: #d8eadf; }
.wechat-import-modal__item-actions { display: grid; justify-items: end; gap: 3px; }
.wechat-import-modal__item-actions > button {
  padding: 2px 6px;
  border: 0;
  border-radius: 7px;
  color: #a13f46;
  background: #fff0f1;
  font-size: 9px;
  font-weight: 800;
  cursor: pointer;
}
.wechat-import-modal__item-actions > button:hover { color: #fff; background: #c44750; }
.wechat-import-modal__queue-tip { margin: 0; color: #668076; font-size: 9px; white-space: nowrap; }

.wechat-import-modal__workspace {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  padding: 10px;
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
.wechat-import-modal__current { display: flex; min-width: 0; grid-row: 2; align-items: center; justify-content: space-between; gap: 12px; padding: 0 4px 8px; }
.wechat-import-modal__current > div { display: grid; min-width: 0; gap: 2px; }
.wechat-import-modal__current span { color: #778980; font-size: 10px; }
.wechat-import-modal__current > div strong { overflow: hidden; color: #183d2d; font-size: 17px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__current p { display: flex; align-items: center; gap: 7px; margin: 0; color: #668076; font-size: 11px; }
.wechat-import-modal__current p strong { color: #246044; }
.wechat-import-modal__current p span { padding: 4px 8px; border-radius: 10px; color: #0d7a49; background: #e1f5ea; font-weight: 800; }
.wechat-import-modal__current p span.wechat-import-modal__policy { color: #7b560e; background: #fff3d8; }
.wechat-import-modal__current-actions { display: flex; min-width: 0; align-items: center; justify-content: flex-end; gap: 7px; }
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
.wechat-import-modal__refresh { border: 1px solid #b9d5c7; color: #176a48; background: #fff; }
.wechat-import-modal__refresh:disabled { cursor: wait; opacity: .65; }
.wechat-import-modal__merge { border: 1px solid #e3a647; color: #fff; background: #d98b13; box-shadow: 0 4px 10px rgba(179, 107, 4, .18); }
.wechat-import-modal__sync-note { grid-row: 3; margin: -5px 4px 9px; color: #1b7d51; font-size: 10px; text-align: right; }
.wechat-import-modal__sync-note.is-error { color: #b23c45; }
.wechat-import-modal__content { min-width: 0; min-height: 0; grid-row: 4; overflow: hidden; }

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
  .wechat-import-modal__current p { display: none; }
  .wechat-import-modal__current-actions { flex-wrap: wrap; }
  .wechat-import-modal__content :deep(.upload-section > .row) { --bs-gutter-x: .6rem; --bs-gutter-y: .6rem; }
  .wechat-import-modal__content :deep(.upload-section > .row > .col-md-4) { width: 40%; }
  .wechat-import-modal__content :deep(.upload-section > .row > .col-md-8) { width: 60%; }
  .wechat-import-modal__content :deep(.upload-section .card.h-100.p-3) { padding: .65rem !important; }
  .wechat-import-modal__content :deep(.upload-section .d-flex.gap-2.mt-2.flex-wrap) { margin-bottom: 6px !important; }
  .wechat-import-modal__content :deep(.upload-section .d-flex.gap-2.w-100) { display: grid !important; grid-template-columns: 1fr; gap: 5px !important; }
  .wechat-import-modal__content :deep(.upload-section .d-flex.gap-2.w-100 > button) { min-height: 29px; font-size: 10px; white-space: nowrap; }
}
</style>
