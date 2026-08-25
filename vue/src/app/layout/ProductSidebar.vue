<template>
  <aside class="product-sidebar" aria-label="产品导航">
    <div class="product-sidebar__brand">
      <span>{{ distributerInitial }}</span>
      <div>
        <strong :title="distributerName">{{ distributerName }}</strong>
        <small>农心乐 · {{ roleLabel }}工作台</small>
      </div>
    </div>

    <nav class="product-sidebar__navigation">
      <section v-for="group in navigation" :key="group.label">
        <p>{{ group.label }}</p>
        <RouterLink
          v-for="item in group.items"
          :key="item.key"
          :to="{ name: item.routeName }"
          :class="{ active: activeKey === item.key }"
        >
          <span>{{ item.icon }}</span>
          <div>
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </div>
        </RouterLink>
      </section>
    </nav>

    <div class="product-sidebar__bottom">
      <button type="button" class="product-sidebar__logout" @click="logoutDialogVisible = true">
        <span>退</span>
        <strong>退出登录</strong>
      </button>

      <div class="product-sidebar__footer">
        <span :class="{ online: networkOnline }"></span>
        <div>
          <strong>{{ networkOnline ? '桌面服务在线' : '网络连接中断' }}</strong>
          <small>农心乐配送商系统</small>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="logoutDialogVisible"
        class="logout-dialog-backdrop"
        role="presentation"
        @mousedown.self="closeLogoutDialog"
      >
        <section class="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-dialog-title">
          <span>退出当前账号</span>
          <h2 id="logout-dialog-title">确定退出 {{ distributerName }}？</h2>
          <p>将清除当前用户、自动登录和未完成识别缓存；打印机与设备设置会保留。</p>
          <small v-if="logoutError">{{ logoutError }}</small>
          <div>
            <button type="button" :disabled="loggingOut" @click="closeLogoutDialog">取消</button>
            <button type="button" class="danger" :disabled="loggingOut" @click="confirmLogout">
              {{ loggingOut ? '正在退出…' : '确认退出' }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
import PRODUCT_NAVIGATION from '../navigation/productNavigation';
import { canAccessModule, roleLabelForUser } from '@/utils/disUserRole';

defineProps({
  networkOnline: {
    type: Boolean,
    default: true,
  },
});

const route = useRoute();
const router = useRouter();
const store = useStore();
const logoutDialogVisible = ref(false);
const loggingOut = ref(false);
const logoutError = ref('');
const navigation = computed(() => PRODUCT_NAVIGATION.map((group) => ({
  ...group,
  items: group.items.filter((item) => canAccessModule(item.module, store.state.disUser)),
})).filter((group) => group.items.length > 0));
const roleLabel = computed(() => roleLabelForUser(store.state.disUser));
const distributerName = computed(() => (
  store.state.disUser?.nxDistributerEntity?.nxDistributerName
  || store.state.disUser?.nxDiuWxNickName
  || '当前配送商'
));
const distributerInitial = computed(() => distributerName.value.trim().charAt(0) || '农');
const activeKey = computed(() => route.meta?.navKey || '');

function closeLogoutDialog() {
  if (loggingOut.value) return;
  logoutDialogVisible.value = false;
  logoutError.value = '';
}

async function confirmLogout() {
  loggingOut.value = true;
  logoutError.value = '';
  try {
    const result = await store.dispatch('logoutUserSession');
    if (result?.ok === false) {
      console.warn('[logout] 桌面缓存部分清理失败:', result.message);
    }
    logoutDialogVisible.value = false;
    await router.replace({ name: 'Home' });
  } catch (error) {
    logoutError.value = error?.message || '退出失败，请重试';
  } finally {
    loggingOut.value = false;
  }
}
</script>

<style scoped>
.product-sidebar {
  box-sizing: border-box;
  display: flex;
  width: var(--product-sidebar-width);
  min-height: 0;
  flex-direction: column;
  padding: 16px 8px 14px;
  border-right: 1px solid var(--product-border);
  color: var(--product-text);
  background: #fff;
}

.product-sidebar__brand {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 2px 5px 16px;
  border-bottom: 1px solid #edf1ef;
}

.product-sidebar__brand > span {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border: 1px solid var(--product-primary);
  border-radius: 5px;
  color: #fff;
  background: var(--product-primary);
  font-size: 15px;
  font-weight: 900;
}

.product-sidebar__brand div,
.product-sidebar__footer div,
.product-sidebar__navigation a div {
  min-width: 0;
}

.product-sidebar__brand strong,
.product-sidebar__brand small,
.product-sidebar__footer strong,
.product-sidebar__footer small {
  display: block;
}

.product-sidebar__brand strong {
  overflow: hidden;
  max-width: 72px;
  color: var(--product-text);
  font-size: 11px;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-sidebar__brand small {
  display: none;
}

.product-sidebar__navigation {
  flex: 1;
  min-height: 0;
  padding: 12px 0;
  overflow-y: auto;
}

.product-sidebar__navigation section + section {
  margin-top: 4px;
}

.product-sidebar__navigation p {
  display: none;
}

.product-sidebar__navigation a {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  margin: 2px 0;
  padding: 8px 7px;
  border: 1px solid transparent;
  border-radius: 5px;
  color: #53625a;
  text-decoration: none;
  transition: background .16s ease, border-color .16s ease, color .16s ease;
}

.product-sidebar__navigation a:hover {
  color: var(--product-text);
  background: #f5f8f6;
}

.product-sidebar__navigation a.active {
  border-color: #dfeae4;
  color: var(--product-primary-strong);
  background: #f7faf8;
  box-shadow: inset 2px 0 0 var(--product-primary);
}

.product-sidebar__navigation a > span {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 4px;
  color: #718078;
  background: transparent;
  font-size: 9px;
  font-weight: 900;
}

.product-sidebar__navigation a.active > span {
  color: var(--product-primary-strong);
  background: transparent;
}

.product-sidebar__navigation strong,
.product-sidebar__navigation small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-sidebar__navigation strong {
  font-size: 12px;
}

.product-sidebar__navigation small {
  display: none;
}

.product-sidebar__navigation a.active small {
  color: #668579;
}

.product-sidebar__footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 5px 0;
  border-top: 1px solid #edf1ef;
}

.product-sidebar__bottom {
  flex: none;
}

.product-sidebar__logout {
  display: grid;
  width: 100%;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding: 8px 7px;
  border: 1px solid transparent;
  border-radius: 5px;
  color: #7d514c;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.product-sidebar__logout:hover {
  border-color: #eedbd8;
  color: #a13e35;
  background: #fff8f7;
}

.product-sidebar__logout span {
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 4px;
  background: #f8eeec;
  font-size: 9px;
  font-weight: 900;
}

.product-sidebar__logout strong {
  font-size: 11px;
}

.product-sidebar__footer > span {
  width: 8px;
  height: 8px;
  flex: none;
  border-radius: 50%;
  background: #c36a62;
  box-shadow: 0 0 0 4px rgba(195, 106, 98, .08);
}

.product-sidebar__footer > span.online {
  background: var(--product-primary);
  box-shadow: 0 0 0 4px rgba(17, 155, 93, .09);
}

.product-sidebar__footer strong {
  color: var(--product-text-secondary);
  font-size: 9px;
}

.product-sidebar__footer small {
  display: none;
}

.logout-dialog-backdrop {
  position: fixed;
  z-index: 1500;
  display: grid;
  inset: 0;
  place-items: center;
  padding: 24px;
  background: rgba(19, 35, 29, .46);
  backdrop-filter: blur(3px);
}

.logout-dialog {
  width: min(410px, calc(100vw - 48px));
  padding: 22px;
  border: 1px solid #e7edea;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 20px 60px rgba(14, 34, 26, .22);
}

.logout-dialog > span {
  color: #aa443a;
  font-size: 11px;
  font-weight: 800;
}

.logout-dialog h2 {
  margin: 6px 0 8px;
  color: #1d3029;
  font-size: 20px;
}

.logout-dialog p {
  margin: 0;
  color: #6f7e78;
  font-size: 13px;
  line-height: 1.65;
}

.logout-dialog > small {
  display: block;
  margin-top: 9px;
  color: #b4473d;
}

.logout-dialog div {
  display: flex;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 18px;
}

.logout-dialog button {
  min-width: 86px;
  padding: 9px 14px;
  border: 1px solid #dce5e0;
  border-radius: 7px;
  color: #54675f;
  background: #fff;
  font-weight: 700;
  cursor: pointer;
}

.logout-dialog button.danger {
  border-color: #b6483e;
  color: #fff;
  background: #b6483e;
}

.logout-dialog button:disabled {
  cursor: wait;
  opacity: .58;
}
</style>
