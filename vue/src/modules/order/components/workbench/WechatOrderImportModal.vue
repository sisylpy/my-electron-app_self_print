<template>
  <Teleport to="body">
    <Transition name="wechat-import-modal">
      <div v-if="open" class="wechat-import-modal__mask">
        <section
          :class="['wechat-import-modal', { 'is-launcher-view': isLauncher }]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wechat-import-modal-title"
        >
          <header class="wechat-import-modal__header">
            <div class="wechat-import-modal__brand" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15.5 5.2a6.8 6.8 0 0 0-11.8 4.6c0 1.4.5 2.8 1.4 3.9L4.3 17l3-1.5c.9.5 2 .8 3.2.8.6 0 1.2-.1 1.8-.2" />
                <path d="M20.7 14.1a5.2 5.2 0 0 1-5.4 5.1c-.9 0-1.8-.2-2.5-.6l-2.3 1.1.6-2.5a5 5 0 0 1-1.2-3.2 5.2 5.2 0 0 1 5.4-5.1 5.2 5.2 0 0 1 5.4 5.2Z" />
                <path d="M7.7 9.2h.01m4.2 0h.01m1.8 4.8h.01m3.4 0h.01" />
              </svg>
            </div>
            <div class="wechat-import-modal__heading">
              <span v-if="busy">自动读取微信订单</span>
              <span v-else-if="activeItem">微信订单</span>
              <h2 id="wechat-import-modal-title">{{ modalTitle }}</h2>
              <p v-if="modalSubtitle">{{ modalSubtitle }}</p>
            </div>
            <div v-if="busy || items.length" class="wechat-import-modal__progress">
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

          <div
            :class="['wechat-import-modal__body', { 'is-launcher': isLauncher }]"
          >
            <nav
              v-if="busy || items.length || activeItem"
              class="wechat-import-modal__queue"
              aria-label="微信订单任务队列"
            >
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
                    <span
                      :class="['wechat-import-modal__index', { 'has-avatar': item.conversationAvatar }]"
                    >
                      <b>{{ index + 1 }}</b>
                      <img
                        v-if="item.conversationAvatar"
                        :src="item.conversationAvatar"
                        alt=""
                        @error="hideBrokenAvatar"
                      />
                    </span>
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
                :class="{ 'has-conversation': launcherCurrentTitle }"
                :disabled="busy || selectedImportBusy || customerMatchBusy"
                @click="$emit('import-selected')"
              >
                <img
                  v-if="launcherCurrentAvatar"
                  :src="launcherCurrentAvatar"
                  alt=""
                  class="wechat-import-modal__selected-avatar"
                />
                <span v-else class="wechat-import-modal__selected-avatar is-fallback" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z" />
                    <path d="M12 8v6m-3-3h6" />
                  </svg>
                </span>
                <span class="wechat-import-modal__selected-copy">
                  <strong>{{ launcherCurrentTitle || '当前微信' }}</strong>
                  <small>{{ selectedImportBusy ? '正在读取订单…' : '读取当前微信订单' }}</small>
                </span>
              </button>
            </nav>

            <main class="wechat-import-modal__workspace">
              <p v-if="workspaceWarning && !activeItem" class="wechat-import-modal__warning">{{ workspaceWarning }}</p>
              <div v-if="activeItem" class="wechat-import-modal__current">
                <div class="wechat-import-modal__current-summary">
                  <span
                    :class="['wechat-import-modal__current-number', { 'has-avatar': activeItem.conversationAvatar }]"
                  >
                    <b>{{ currentPosition }}</b>
                    <img
                      v-if="activeItem.conversationAvatar"
                      :src="activeItem.conversationAvatar"
                      alt=""
                      @error="hideBrokenAvatar"
                    />
                  </span>
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
                    type="button"
                    class="wechat-import-modal__rescan-all"
                    title="重新逐个检查全部已关联微信，并生成新一轮订单任务"
                    :disabled="busy || refreshing || selectedImportBusy"
                    @click="$emit('scan-all')"
                  >重新检查全部</button>
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
                    <span class="wechat-import-modal__choice-heading">
                      <b class="wechat-import-modal__choice-number">1</b>
                      <span>
                        <strong>读取未读订单</strong>
                        <em>只同步微信里显示未读的新订单消息</em>
                      </span>
                    </span>
                    <span class="wechat-import-modal__choice-visual" aria-hidden="true">
                      <svg viewBox="0 0 300 170" fill="none">
                        <defs>
                          <linearGradient id="wechatUnreadCard" x1="56" y1="29" x2="226" y2="151" gradientUnits="userSpaceOnUse">
                            <stop stop-color="#FFFFFF"/><stop offset="1" stop-color="#DDF8E9"/>
                          </linearGradient>
                          <linearGradient id="wechatUnreadApp" x1="72" y1="31" x2="154" y2="110" gradientUnits="userSpaceOnUse">
                            <stop stop-color="#2EC57D"/><stop offset="1" stop-color="#079154"/>
                          </linearGradient>
                        </defs>
                        <circle cx="150" cy="84" r="76" fill="#E9FBF1"/>
                        <rect x="70" y="34" width="112" height="76" rx="22" transform="rotate(-8 70 34)" fill="url(#wechatUnreadApp)"/>
                        <path d="M110 64c0-12 12-22 28-22s28 10 28 22-12 22-28 22c-4 0-8-.7-12-2l-13 6 4-12c-4-4-7-9-7-14Z" fill="white" fill-opacity=".94"/>
                        <circle cx="130" cy="63" r="2.5" fill="#14A765"/><circle cx="146" cy="63" r="2.5" fill="#14A765"/>
                        <g>
                          <rect x="55" y="82" width="190" height="72" rx="18" transform="rotate(5 55 82)" fill="url(#wechatUnreadCard)" stroke="#B5E7CA"/>
                          <circle cx="85" cy="111" r="8" fill="#25BB72"/>
                          <rect x="102" y="104" width="82" height="8" rx="4" fill="#B8D8C7"/>
                          <rect x="102" y="120" width="112" height="7" rx="3.5" fill="#D3E7DC"/>
                          <circle cx="225" cy="87" r="24" fill="#FF654D"/>
                          <text x="225" y="94" fill="white" font-size="20" font-weight="800" text-anchor="middle">12</text>
                        </g>
                        <circle cx="250" cy="121" r="13" fill="#52CB88"/><path d="m244 121 4 4 8-9" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <span class="wechat-import-modal__choice-benefits">
                      <span><i>✓</i>只读取未读消息</span>
                      <span><i>✓</i>不会重复导入</span>
                      <span><i>✓</i>速度快，适合日常使用</span>
                    </span>
                    <span class="wechat-import-modal__choice-cta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a7 7 0 0 1-7 7H8l-4 3 1.2-4.2A7 7 0 1 1 20 11Z"/><circle cx="18" cy="6" r="3" fill="currentColor" stroke="none"/></svg>
                      <b>{{ selectedImportBusy ? '正在读取…' : '开始读取未读订单' }}</b>
                      <span>›</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="is-selected"
                    :disabled="selectedImportBusy"
                    @click="$emit('import-selected')"
                  >
                    <span class="wechat-import-modal__choice-heading">
                      <b class="wechat-import-modal__choice-number">2</b>
                      <span>
                        <strong>{{ launcherCurrentTitleText }}</strong>
                        <em>{{ launcherCurrentDescription }}</em>
                      </span>
                    </span>
                    <span class="wechat-import-modal__choice-visual" aria-hidden="true">
                      <svg viewBox="0 0 300 170" fill="none">
                        <defs>
                          <linearGradient id="wechatCurrentPhone" x1="71" y1="23" x2="221" y2="158" gradientUnits="userSpaceOnUse"><stop stop-color="#E7F3FF"/><stop offset="1" stop-color="#BDD9FF"/></linearGradient>
                          <linearGradient id="wechatCurrentFrame" x1="70" y1="27" x2="221" y2="151" gradientUnits="userSpaceOnUse"><stop stop-color="#4C9BFF"/><stop offset="1" stop-color="#146BE8"/></linearGradient>
                        </defs>
                        <circle cx="150" cy="84" r="76" fill="#ECF5FF"/>
                        <rect x="71" y="27" width="158" height="126" rx="28" transform="rotate(-5 71 27)" fill="url(#wechatCurrentFrame)"/>
                        <rect x="80" y="37" width="140" height="111" rx="22" transform="rotate(-5 80 37)" fill="url(#wechatCurrentPhone)"/>
                        <circle cx="112" cy="70" r="17" fill="#FFE0B7"/><circle cx="112" cy="64" r="7" fill="#3D72B7"/><path d="M98 80c4-8 24-8 28 0" fill="#2B7FE8"/>
                        <rect x="139" y="58" width="60" height="8" rx="4" fill="#8CB7ED"/><rect x="139" y="74" width="45" height="7" rx="3.5" fill="#ABC9ED"/>
                        <rect x="98" y="99" width="50" height="37" rx="9" fill="#FFFFFF"/><path d="M104 128c8-17 18-20 36-19v20h-36Z" fill="#65AF4D"/><circle cx="118" cy="110" r="6" fill="#F5C35A"/>
                        <rect x="155" y="94" width="50" height="37" rx="9" fill="#FFFFFF"/><path d="M161 124c10-14 23-17 37-13v13h-37Z" fill="#2FA965"/>
                        <path d="m221 106 26 16-14 4 8 15-8 4-8-15-10 10 6-34Z" fill="#123E73" stroke="white" stroke-width="3" stroke-linejoin="round"/>
                        <path d="M49 71h14m-7-7v14M235 60l12-8m-8 17 14-2" stroke="#358AF3" stroke-width="5" stroke-linecap="round"/>
                      </svg>
                    </span>
                    <span class="wechat-import-modal__choice-benefits">
                      <span><i>✓</i>仅读取当前聊天窗口</span>
                      <span><i>✓</i>适合单个客户或群聊</span>
                      <span><i>✓</i>随时补单、单独刷新</span>
                    </span>
                    <span class="wechat-import-modal__choice-cta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3"/><circle cx="12" cy="12" r="3"/></svg>
                      <b>{{ launcherCurrentActionText }}</b>
                      <span>›</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="is-all"
                    :disabled="selectedImportBusy"
                    @click="$emit('scan-all')"
                  >
                    <span class="wechat-import-modal__choice-heading">
                      <b class="wechat-import-modal__choice-number">3</b>
                      <span>
                        <strong>检查已关联微信</strong>
                        <em>逐个检查全部已关联微信，不受未读状态限制</em>
                      </span>
                    </span>
                    <span class="wechat-import-modal__choice-visual" aria-hidden="true">
                      <svg viewBox="0 0 300 170" fill="none">
                        <defs><linearGradient id="wechatAllWindow" x1="56" y1="51" x2="221" y2="143" gradientUnits="userSpaceOnUse"><stop stop-color="#FFF"/><stop offset="1" stop-color="#FFF0D9"/></linearGradient></defs>
                        <circle cx="150" cy="84" r="76" fill="#FFF4E5"/>
                        <rect x="58" y="50" width="175" height="93" rx="18" fill="url(#wechatAllWindow)" stroke="#FFD096"/>
                        <path d="M58 68h175" stroke="#FFD096"/><circle cx="71" cy="59" r="3" fill="#FF9C36"/><circle cx="82" cy="59" r="3" fill="#FFD07A"/>
                        <circle cx="91" cy="91" r="15" fill="#F7D2B5"/><path d="M78 103c4-9 22-9 26 0" fill="#73AE60"/>
                        <circle cx="137" cy="91" r="15" fill="#E8C7AE"/><path d="M124 103c4-9 22-9 26 0" fill="#4B8BD1"/>
                        <circle cx="183" cy="91" r="15" fill="#FFD2B1"/><path d="M170 103c4-9 22-9 26 0" fill="#E88B55"/>
                        <rect x="78" y="116" width="125" height="10" rx="5" fill="#F3CFA4"/>
                        <rect x="30" y="37" width="48" height="48" rx="15" fill="#18AA66"/>
                        <path d="M43 58c0-7 7-12 15-12s15 5 15 12-7 12-15 12c-2 0-4-.4-6-1l-7 3 2-6c-3-2-4-5-4-8Z" fill="white"/>
                        <circle cx="54" cy="57" r="1.5" fill="#18AA66"/><circle cx="62" cy="57" r="1.5" fill="#18AA66"/>
                        <rect x="210" y="105" width="56" height="56" rx="15" fill="#F4FFF8" stroke="#A8DCBF"/>
                        <path d="M224 118h21l8 8v22h-29v-30Z" fill="#DDF6E8"/><path d="m229 137 6 6 12-14" stroke="#20A766" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M207 29c24 4 39 14 48 31m-3-1-2-14m2 14-13-5M48 122c11 16 24 25 43 29m-1 0-8-11m8 11-13 3" stroke="#FF8C1A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                    <span class="wechat-import-modal__choice-benefits">
                      <span><i>✓</i>检查所有已关联微信</span>
                      <span><i>✓</i>不受未读状态限制</span>
                      <span><i>✓</i>收单结束前全面复查</span>
                    </span>
                    <span class="wechat-import-modal__choice-cta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="12" cy="20" r="2"/><path d="m6.7 8.1 3.2 2.5m7.4-2.5-3.2 2.5m-2.1 4v3.3"/></svg>
                      <b>{{ selectedImportBusy ? '正在检查…' : '开始全面检查' }}</b>
                      <span>›</span>
                    </span>
                  </button>
                </div>
                <aside class="wechat-import-modal__launcher-tips" aria-label="使用建议">
                  <span class="wechat-import-modal__tip-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6m-5 3h4m4-11a6 6 0 1 0-10.5 4c.9.9 1.5 1.7 1.5 3h6c0-1.3.6-2.1 1.5-3A6 6 0 0 0 18 10Z"/><path d="M12 2V1m8 3-1 1M4 4l1 1"/></svg>
                  </span>
                  <strong>温馨提示</strong>
                  <ol>
                    <li><b>1.</b> 日常收单优先使用“读取未读订单”，速度最快。</li>
                    <li><b>2.</b> 只想同步一个客户时，先在左侧打开聊天，再读取当前微信。</li>
                    <li><b>3.</b> 收单结束前使用“检查已关联微信”，可避免遗漏。</li>
                  </ol>
                </aside>
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
                        <span
                          :class="['wechat-import-modal__result-icon', { 'has-avatar': item.conversationAvatar }]"
                          aria-hidden="true"
                        >
                          <img
                            v-if="item.conversationAvatar"
                            :src="item.conversationAvatar"
                            alt=""
                            @error="hideBrokenAvatar"
                          />
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
                  <h3 id="wechat-import-action-title">{{ selectedImportBusy ? selectedImportBusyTitle : (actionStatus === 'success' ? '已加入转订单' : '无法转订单') }}</h3>
                  <p id="wechat-import-action-message">{{ selectedImportBusy ? selectedImportBusyMessage : actionMessage }}</p>
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
  launcherCurrentTitle: { type: String, default: '' },
  launcherCurrentAvatar: { type: String, default: '' },
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
const isLauncher = computed(() => !props.busy && !props.activeItem && !props.items.length);
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
  return '读取微信订单';
});
const modalSubtitle = computed(() => {
  if (props.busy) return '左侧微信正在逐个检查会话 · 读取结果将在右侧显示';
  if (isLauncher.value) return '选择一种方式，把微信里的订货内容同步到农心乐配送商系统';
  return '';
});
const progressLabel = computed(() => {
  if (props.busy) return '读取中';
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
const launcherCurrentTitleText = computed(() => {
  if (props.selectedImportBusy && props.launcherCurrentTitle) return `正在读取“${props.launcherCurrentTitle}”…`;
  if (props.selectedImportBusy) return '正在读取当前微信…';
  if (!props.launcherCurrentTitle) return '读取当前微信';
  return `读取“${props.launcherCurrentTitle}”`;
});
const launcherCurrentDescription = computed(() => (
  props.launcherCurrentTitle
    ? '只读取左侧当前打开的这一个好友或群聊'
    : '只读取左侧微信当前打开的好友或群聊'
));
const launcherCurrentActionText = computed(() => (
  props.selectedImportBusy ? '正在读取…' : '读取当前聊天订单'
));
const selectedImportBusyTitle = computed(() => (
  props.launcherCurrentTitle
    ? `正在识别“${props.launcherCurrentTitle}”`
    : '正在识别当前微信'
));
const selectedImportBusyMessage = computed(() => (
  props.launcherCurrentTitle
    ? `正在查找“${props.launcherCurrentTitle}”关联的客户并读取订单消息…`
    : '正在获取微信名称并查找关联客户…'
));
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

function hideBrokenAvatar(event) {
  if (event?.currentTarget) event.currentTarget.hidden = true;
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
.wechat-import-modal__heading { min-width: 0; flex: 1; }
.wechat-import-modal__heading > span { color: #138454; font-size: 10px; font-weight: 900; letter-spacing: .12em; }
.wechat-import-modal__heading h2 { margin: 2px 0 0; color: #183c2d; font-size: 19px; line-height: 1.25; }
.wechat-import-modal__heading p { margin: 3px 0 0; color: #6b7d74; font-size: 11px; }
.wechat-import-modal.is-launcher-view .wechat-import-modal__header {
  min-height: 78px;
  gap: 18px;
  padding: 12px clamp(20px, 3vw, 38px);
}
.wechat-import-modal.is-launcher-view .wechat-import-modal__brand {
  width: 50px;
  height: 50px;
  border-radius: 16px;
}
.wechat-import-modal.is-launcher-view .wechat-import-modal__brand svg { width: 28px; height: 28px; }
.wechat-import-modal.is-launcher-view .wechat-import-modal__heading h2 { font-size: 24px; }
.wechat-import-modal.is-launcher-view .wechat-import-modal__heading p { color: #5e7469; font-size: 12px; }

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
.wechat-import-modal__body.is-launcher { grid-template-rows: minmax(0, 1fr); }
.wechat-import-modal__body.is-launcher .wechat-import-modal__workspace {
  grid-template-rows: minmax(0, 1fr);
  padding: clamp(18px, 2.4vw, 34px);
  overflow-y: auto;
  background:
    radial-gradient(circle at 8% 92%, rgba(255, 198, 88, .12), transparent 27%),
    radial-gradient(circle at 94% 5%, rgba(37, 190, 113, .13), transparent 25%),
    linear-gradient(180deg, #f9fcfa, #f3f9f6);
}
.wechat-import-modal__body.is-launcher .wechat-import-modal__launcher { grid-row: 1; }

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
  display: grid;
  min-width: 142px;
  min-height: 44px;
  flex: none;
  grid-template-columns: 32px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 5px 12px 5px 6px;
  border: 1px solid #118755;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(145deg, #16a466, #0b7e4c);
  box-shadow: 0 5px 12px rgba(14, 126, 76, .18);
  text-align: left;
  cursor: pointer;
}
.wechat-import-modal__selected-avatar {
  display: block;
  width: 32px;
  height: 32px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, .55);
  border-radius: 9px;
  background: rgba(255, 255, 255, .18);
  object-fit: cover;
}
.wechat-import-modal__selected-avatar.is-fallback { display: grid; place-items: center; }
.wechat-import-modal__selected-avatar svg { width: 18px; height: 18px; }
.wechat-import-modal__selected-copy { display: grid; min-width: 0; gap: 1px; }
.wechat-import-modal__selected-copy strong,
.wechat-import-modal__selected-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__selected-copy strong { max-width: 132px; color: #fff; font-size: 11px; line-height: 1.25; }
.wechat-import-modal__selected-copy small { color: rgba(255, 255, 255, .78); font-size: 8px; font-weight: 700; }
.wechat-import-modal__selected-import:hover { background: linear-gradient(145deg, #0d965a, #086d42); }
.wechat-import-modal__selected-import:disabled { cursor: wait; opacity: .6; }
.wechat-import-modal__queue li {
  display: grid;
  width: 190px;
  flex: none;
  grid-template-columns: 32px minmax(0, 1fr);
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
.wechat-import-modal__index { position: relative; display: grid; width: 32px; height: 32px; overflow: hidden; place-items: center; border-radius: 9px; color: #5f7469; background: #e6efea; font-size: 11px; font-weight: 900; }
.wechat-import-modal__index b,
.wechat-import-modal__current-number b { font: inherit; }
.wechat-import-modal__index img,
.wechat-import-modal__current-number img { position: absolute; width: 100%; height: 100%; inset: 0; object-fit: cover; }
.wechat-import-modal__index img[hidden],
.wechat-import-modal__current-number img[hidden] { display: none; }
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
  grid-row: 2 / 5;
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
.wechat-import-modal__current-number { position: relative; display: grid; width: 34px; height: 34px; flex: none; overflow: hidden; place-items: center; border-radius: 11px; color: #fff; background: #15945b; font-size: 13px; font-weight: 900; }
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
.wechat-import-modal__rescan-all,
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
.wechat-import-modal__rescan-all { border: 1px solid #a9cabb; color: #315f4b; background: #edf7f2; }
.wechat-import-modal__rescan-all:hover { border-color: #23895c; color: #fff; background: #23895c; }
.wechat-import-modal__refresh:disabled,
.wechat-import-modal__rescan-all:disabled { cursor: wait; opacity: .65; }
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
  position: relative;
  display: grid;
  width: min(1180px, 100%);
  min-height: min(710px, 100%);
  grid-row: 1;
  align-self: center;
  justify-self: center;
  gap: 16px;
  padding: 8px;
}
.wechat-import-modal__launcher::before {
  position: absolute;
  z-index: 0;
  top: -40px;
  right: -30px;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  content: '';
  background: radial-gradient(circle at 35% 35%, rgba(46, 194, 121, .16), rgba(46, 194, 121, .02) 68%, transparent 70%);
  pointer-events: none;
}
.wechat-import-modal__launcher-notice {
  position: relative;
  z-index: 2;
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
.wechat-import-modal__launcher-actions {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 0;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(13px, 1.6vw, 20px);
}
.wechat-import-modal__launcher-actions > button {
  --choice-accent: #12a45f;
  --choice-accent-dark: #087f49;
  --choice-soft: #effbf4;
  --choice-border: #9eddbb;
  --choice-tint: #dff6e9;
  --choice-panel: #edf9f2;
  --choice-shadow: rgba(18, 164, 95, .2);
  display: grid;
  min-width: 0;
  min-height: 510px;
  grid-template-rows: auto minmax(140px, 1fr) auto auto;
  gap: 12px;
  padding: clamp(17px, 2vw, 24px) clamp(16px, 1.8vw, 22px) 18px;
  overflow: hidden;
  border: 1px solid var(--choice-border);
  border-radius: 22px;
  outline: none;
  color: #173c2d;
  background: linear-gradient(160deg, rgba(255, 255, 255, .98), var(--choice-soft));
  box-shadow: 0 14px 34px rgba(28, 81, 57, .08), 0 1px 0 rgba(255, 255, 255, .9) inset;
  text-align: left;
  cursor: pointer;
  animation: wechat-launcher-rise .34s both;
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.wechat-import-modal__launcher-actions > button:nth-child(2) { animation-delay: .06s; }
.wechat-import-modal__launcher-actions > button:nth-child(3) { animation-delay: .12s; }
.wechat-import-modal__launcher-actions > button:hover { transform: translateY(-4px); box-shadow: 0 22px 44px var(--choice-shadow); }
.wechat-import-modal__launcher-actions > button:focus-visible { box-shadow: 0 0 0 4px var(--choice-shadow), 0 20px 38px var(--choice-shadow); }
.wechat-import-modal__launcher-actions > button:disabled { cursor: wait; opacity: .6; transform: none; box-shadow: none; }
.wechat-import-modal__launcher-actions > button.is-selected {
  --choice-accent: #247df2;
  --choice-accent-dark: #0f5ed5;
  --choice-soft: #f1f7ff;
  --choice-border: #9bc8ff;
  --choice-tint: #dcecff;
  --choice-panel: #eaf4ff;
  --choice-shadow: rgba(36, 125, 242, .2);
}
.wechat-import-modal__launcher-actions > button.is-all {
  --choice-accent: #ff8b1b;
  --choice-accent-dark: #ee6810;
  --choice-soft: #fff7ec;
  --choice-border: #ffc77d;
  --choice-tint: #ffead0;
  --choice-panel: #fff2e2;
  --choice-shadow: rgba(255, 139, 27, .2);
}
.wechat-import-modal__choice-heading { display: grid; grid-template-columns: 46px minmax(0, 1fr); align-items: start; gap: 13px; }
.wechat-import-modal__choice-number {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 13px;
  color: var(--choice-accent-dark);
  background: var(--choice-tint);
  font-size: 24px;
  line-height: 1;
}
.wechat-import-modal__choice-heading > span { display: grid; min-width: 0; gap: 7px; }
.wechat-import-modal__choice-heading strong { overflow: hidden; color: #183a2d; font-size: clamp(17px, 1.8vw, 22px); line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__choice-heading em { color: #63776e; font-size: 11px; font-style: normal; line-height: 1.55; }
.wechat-import-modal__choice-visual { display: grid; min-height: 0; place-items: center; }
.wechat-import-modal__choice-visual svg { display: block; width: min(100%, 300px); height: auto; max-height: 178px; overflow: visible; }
.wechat-import-modal__choice-benefits {
  display: grid;
  gap: 8px;
  padding: 14px 15px;
  border-radius: 15px;
  color: #426052;
  background: var(--choice-panel);
  font-size: 11px;
  line-height: 1.35;
}
.wechat-import-modal__choice-benefits > span { display: flex; align-items: center; gap: 8px; }
.wechat-import-modal__choice-benefits i {
  display: grid;
  width: 17px;
  height: 17px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  color: #fff;
  background: var(--choice-accent);
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}
.wechat-import-modal__choice-cta {
  display: grid;
  min-height: 48px;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 0 15px;
  border-radius: 14px;
  color: #fff;
  background: linear-gradient(135deg, var(--choice-accent), var(--choice-accent-dark));
  box-shadow: 0 9px 20px var(--choice-shadow);
  text-align: center;
}
.wechat-import-modal__choice-cta svg { width: 22px; height: 22px; }
.wechat-import-modal__choice-cta b { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.wechat-import-modal__choice-cta > span { font-size: 23px; line-height: 1; }
.wechat-import-modal__launcher-tips {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 42px auto minmax(0, 1fr);
  align-items: center;
  gap: 13px;
  padding: 13px 18px;
  border: 1px solid #e4e9e5;
  border-radius: 18px;
  background: rgba(255, 255, 255, .88);
  box-shadow: 0 8px 24px rgba(34, 72, 53, .05);
}
.wechat-import-modal__tip-icon { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 50%; color: #ef9b13; background: #fff5d9; }
.wechat-import-modal__tip-icon svg { width: 23px; height: 23px; }
.wechat-import-modal__launcher-tips > strong { color: #8b6823; font-size: 13px; white-space: nowrap; }
.wechat-import-modal__launcher-tips ol { display: grid; gap: 3px; margin: 0; padding: 0; color: #6c7c74; font-size: 10px; line-height: 1.45; list-style: none; }
.wechat-import-modal__launcher-tips li { display: flex; gap: 8px; }
.wechat-import-modal__launcher-tips li b { color: #99a69f; }

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
.wechat-import-modal__result-icon { position: relative; display: grid; width: 34px; height: 34px; overflow: hidden; place-items: center; border-radius: 11px; color: #5d776a; background: #eaf2ee; font-size: 14px; font-weight: 900; }
.wechat-import-modal__result-icon img { position: absolute; z-index: 1; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.wechat-import-modal__result-icon img[hidden] { display: none; }
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
@keyframes wechat-launcher-rise {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
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
  .wechat-import-modal:not(.is-launcher-view) .wechat-import-modal__heading p { display: none; }
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
  .wechat-import-modal__launcher { width: min(1000px, 100%); min-height: min(650px, 100%); }
  .wechat-import-modal__launcher-actions > button { min-height: 470px; padding: 16px; }
  .wechat-import-modal__choice-heading { grid-template-columns: 40px minmax(0, 1fr); gap: 10px; }
  .wechat-import-modal__choice-number { width: 40px; height: 40px; font-size: 20px; }
  .wechat-import-modal__choice-heading strong { font-size: 17px; }
  .wechat-import-modal__choice-visual svg { max-height: 150px; }
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
  .wechat-import-modal.is-launcher-view .wechat-import-modal__header { min-height: 70px; padding: 10px 14px; }
  .wechat-import-modal.is-launcher-view .wechat-import-modal__brand { width: 44px; height: 44px; }
  .wechat-import-modal.is-launcher-view .wechat-import-modal__heading h2 { font-size: 20px; }
  .wechat-import-modal.is-launcher-view .wechat-import-modal__heading p { display: none; }
  .wechat-import-modal__body.is-launcher .wechat-import-modal__workspace { padding: 16px; overflow-y: auto; }
  .wechat-import-modal__launcher { width: 100%; min-height: 0; align-self: start; gap: 14px; padding: 0; }
  .wechat-import-modal__launcher-actions { grid-template-columns: 1fr; }
  .wechat-import-modal__launcher-actions > button { min-height: 480px; }
  .wechat-import-modal__launcher-tips { grid-template-columns: 38px minmax(0, 1fr); }
  .wechat-import-modal__launcher-tips ol { grid-column: 1 / -1; }
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

@media (prefers-reduced-motion: reduce) {
  .wechat-import-modal__launcher-actions > button { animation: none; }
}
</style>
