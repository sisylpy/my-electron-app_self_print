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
              <h2 id="wechat-import-modal-title">确认微信消息并转换为订单</h2>
              <p>左侧微信原窗口 · 中间会话队列 · 右侧订单，共 {{ items.length }} 个会话</p>
            </div>
            <div class="wechat-import-modal__progress">
              <span>处理进度</span>
              <strong>{{ completedCount }} / {{ items.length }}</strong>
            </div>
            <button type="button" class="wechat-import-modal__later" @click="$emit('close')">
              稍后处理
            </button>
          </header>

          <div class="wechat-import-modal__body">
            <aside class="wechat-import-modal__queue" aria-label="微信会话处理队列">
              <div class="wechat-import-modal__queue-heading">
                <div>
                  <strong>微信会话</strong>
                  <span>剩余 {{ remainingCount }} 个</span>
                </div>
                <em>{{ currentPosition }}/{{ items.length }}</em>
              </div>
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
                    <span>门店：{{ item.customerName }}</span>
                    <small>{{ item.messageCount }} 条新消息</small>
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
              <p class="wechat-import-modal__queue-tip">
                请在屏幕左侧微信中核对原消息；保存当前订单后会自动进入下一条会话。
              </p>
            </aside>

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
                  </p>
                  <button
                    type="button"
                    class="wechat-import-modal__refresh"
                    :disabled="refreshing"
                    @click="$emit('refresh')"
                  >{{ refreshing ? '同步中…' : '同步当前会话' }}</button>
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
              <div class="wechat-import-modal__content">
                <slot />
              </div>
            </main>
          </div>
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
  refreshing: { type: Boolean, default: false },
  workspaceWarning: { type: String, default: '' },
});

const emit = defineEmits(['close', 'refresh', 'merge-new', 'select-item', 'remove-item']);

const completedTokenSet = computed(() => new Set(props.completedTokens.map(String)));
const completedCount = computed(() => completedTokenSet.value.size);
const remainingCount = computed(() => Math.max(0, props.items.length - completedCount.value));
const totalMessages = computed(() => props.items.reduce(
  (sum, item) => sum + (Number(item?.messageCount) || 0),
  0
));
const currentPosition = computed(() => {
  if (!props.items.length) return 0;
  const activeIndex = props.items.findIndex(item => item?.token === props.activeItem?.token);
  return activeIndex >= 0 ? activeIndex + 1 : Math.min(props.items.length, completedCount.value + 1);
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
  padding: 16px;
  background: rgba(18, 39, 30, .48);
  backdrop-filter: blur(4px);
}

.wechat-import-modal {
  display: grid;
  width: min(1480px, calc(100vw - 32px));
  height: min(900px, calc(100vh - 32px));
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid rgba(166, 207, 187, .9);
  border-radius: 16px;
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

.wechat-import-modal__body {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-columns: 230px minmax(0, 1fr);
}

.wechat-import-modal__queue {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: 12px 10px 10px;
  border-right: 1px solid #dcebe3;
  background: #f2f8f5;
}
.wechat-import-modal__queue-heading { display: flex; align-items: center; justify-content: space-between; padding: 0 5px 12px; }
.wechat-import-modal__queue-heading > div { display: grid; gap: 2px; }
.wechat-import-modal__queue-heading strong { color: #244638; font-size: 14px; }
.wechat-import-modal__queue-heading span { color: #7b8c84; font-size: 10px; }
.wechat-import-modal__queue-heading em { padding: 4px 8px; border-radius: 10px; color: #147a4e; background: #dff2e8; font-size: 10px; font-style: normal; font-weight: 900; }

.wechat-import-modal__queue ol { min-height: 0; overflow: auto; margin: 0; padding: 0; list-style: none; }
.wechat-import-modal__queue li {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  margin-bottom: 8px;
  padding: 11px 9px;
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
.wechat-import-modal__index { display: grid; width: 27px; height: 27px; place-items: center; border-radius: 9px; color: #5f7469; background: #e6efea; font-size: 11px; font-weight: 900; }
.is-active .wechat-import-modal__index { color: #fff; background: #14945b; }
.is-completed .wechat-import-modal__index { color: #20744d; background: #cde9da; }
.wechat-import-modal__conversation { display: grid; min-width: 0; gap: 2px; }
.wechat-import-modal__conversation strong { overflow: hidden; color: #203d31; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__conversation span,
.wechat-import-modal__conversation small { overflow: hidden; color: #74877e; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__state { padding: 3px 6px; border-radius: 8px; color: #6e7d76; background: #edf1ef; font-size: 9px; font-weight: 800; white-space: nowrap; }
.is-active .wechat-import-modal__state { color: #0d7848; background: #dff5e9; }
.is-completed .wechat-import-modal__state { color: #3d7459; background: #d8eadf; }
.wechat-import-modal__item-actions { display: grid; justify-items: end; gap: 5px; }
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
.wechat-import-modal__queue-tip { margin: 10px 2px 0; padding: 10px; border-radius: 9px; color: #668076; background: #e5f2eb; font-size: 10px; line-height: 1.5; }

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

.wechat-import-modal-enter-active,
.wechat-import-modal-leave-active { transition: opacity .2s ease; }
.wechat-import-modal-enter-active .wechat-import-modal,
.wechat-import-modal-leave-active .wechat-import-modal { transition: transform .2s ease, opacity .2s ease; }
.wechat-import-modal-enter-from,
.wechat-import-modal-leave-to { opacity: 0; }
.wechat-import-modal-enter-from .wechat-import-modal,
.wechat-import-modal-leave-to .wechat-import-modal { opacity: 0; transform: translateY(12px) scale(.98); }

@media (max-width: 1280px) {
  .wechat-import-modal__body { grid-template-columns: 205px minmax(0, 1fr); }
  .wechat-import-modal__heading p { display: none; }
  .wechat-import-modal__queue-tip { padding: 8px; font-size: 9px; }
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
