<template>
  <div class="drawer-layer" @click.self="$emit('close')">
    <aside class="users-drawer">
      <header>
        <div><span>MINI APP USERS</span><h3>小程序用户</h3><p>{{ customerName }}</p></div>
        <button type="button" @click="$emit('close')">×</button>
      </header>
      <div class="drawer-body">
        <div v-if="loading" class="drawer-state">正在加载小程序用户…</div>
        <div v-else-if="errorText" class="drawer-state error">{{ errorText }}<button @click="load">重新加载</button></div>
        <div v-else-if="!users.length" class="drawer-state"><b>暂时没有绑定用户</b><p>客户需要先从小程序完成登录和绑定。</p></div>
        <div v-else class="user-list">
          <article v-for="user in users" :key="user.nxDepartmentUserId">
            <span class="avatar">{{ userName(user).charAt(0) || '用' }}</span>
            <div><strong>{{ userName(user) }}</strong><small>{{ user.nxDuWxPhone || user.nxDuPhone || '未填写手机号' }}</small></div>
            <label><input type="checkbox" :checked="Number(user.nxDuAdmin) === 1" @change="toggleAdmin(user)" /> 管理员</label>
            <button class="delete" type="button" @click="removeUser(user)">移除</button>
          </article>
        </div>
      </div>
      <footer><button type="button" @click="$emit('close')">完成</button></footer>
    </aside>
  </div>
</template>

<script>
import customerApi from '../api/customerApi';

export default {
  name: 'CustomerUsersDrawer',
  props: {
    customerId: { type: [Number, String], required: true },
    customerName: { type: String, default: '' },
  },
  emits: ['close', 'notice'],
  data() { return { users: [], loading: false, errorText: '' }; },
  mounted() { this.load(); },
  methods: {
    userName(user) { return user.nxDuWxNickName || user.nxDuUserName || user.nxDuName || '小程序用户'; },
    async load() {
      this.loading = true; this.errorText = '';
      try {
        const response = await customerApi.getCustomerUsers(this.customerId);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '用户加载失败');
        this.users = response.data.data || [];
      } catch (error) { this.errorText = error?.message || '用户加载失败'; }
      finally { this.loading = false; }
    },
    async toggleAdmin(user) {
      const next = { ...user, nxDuAdmin: Number(user.nxDuAdmin) === 1 ? 0 : 1 };
      try {
        const response = await customerApi.updateCustomerUser(next);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '权限修改失败');
        this.$emit('notice', `${this.userName(user)}的权限已更新`);
        await this.load();
      } catch (error) { this.$emit('notice', error?.message || '权限修改失败', 'error'); await this.load(); }
    },
    async removeUser(user) {
      if (!window.confirm(`确认移除小程序用户“${this.userName(user)}”？`)) return;
      try {
        const response = await customerApi.deleteCustomerUser(user.nxDepartmentUserId);
        if (response?.data?.code !== 0) throw new Error(response?.data?.msg || '移除失败');
        this.$emit('notice', '小程序用户已移除');
        await this.load();
      } catch (error) { this.$emit('notice', error?.message || '移除失败', 'error'); }
    },
  },
};
</script>

<style scoped>
.drawer-layer{position:fixed;inset:0;z-index:1120;background:rgba(var(--product-text-rgb), 0.23);display:flex;justify-content:flex-end}.users-drawer{width:min(560px,92vw);height:100%;background:var(--product-primary-soft);display:flex;flex-direction:column;box-shadow:-18px 0 45px rgba(var(--product-text-rgb), 0.18);animation:slide-in .22s ease}.users-drawer>header{padding:23px 25px;background:var(--product-surface);border-bottom:1px solid var(--product-tint);display:flex;justify-content:space-between}.users-drawer header span{font-size:10px;letter-spacing:.13em;color:var(--product-primary-strong);font-weight:900}.users-drawer h3{margin:3px 0;font-size:23px}.users-drawer header p{margin:0;color:var(--product-text-muted)}.users-drawer header button{border:0;background:var(--product-tint);border-radius:10px;width:40px;height:40px;font-size:27px}.drawer-body{flex:1;overflow:auto;padding:20px}.drawer-state{padding:55px 20px;text-align:center;border:1px dashed var(--product-primary-soft);border-radius:13px;background:var(--product-surface);color:var(--product-text-muted)}.drawer-state b,.drawer-state p{display:block}.drawer-state p{margin:7px 0}.drawer-state.error{color:var(--product-danger)}.drawer-state button{display:block;margin:10px auto 0}.user-list{display:grid;gap:10px}.user-list article{display:grid;grid-template-columns:42px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:14px;background:var(--product-surface);border:1px solid var(--product-tint);border-radius:13px}.avatar{width:42px;height:42px;border-radius:12px;background:var(--product-primary-soft);display:grid;place-items:center;color:var(--product-primary-strong);font-weight:900}.user-list article>div{min-width:0}.user-list strong,.user-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.user-list small{margin-top:3px;color:var(--product-text-muted);font-size:11px}.user-list label{font-size:12px;color:var(--product-text-secondary);white-space:nowrap}.delete{border:0;background:var(--product-danger-soft);color:var(--product-danger);border-radius:8px;padding:7px 9px;font-weight:800}.users-drawer>footer{padding:15px 20px;border-top:1px solid var(--product-tint);background:var(--product-surface);text-align:right}.users-drawer>footer button{border:0;background:var(--product-primary-strong);color:#fff;border-radius:9px;padding:9px 17px;font-weight:800}@keyframes slide-in{from{opacity:.4;transform:translateX(36px)}to{opacity:1;transform:none}}@media(max-width:620px){.user-list article{grid-template-columns:42px minmax(0,1fr)}.user-list label,.delete{grid-column:2}}
</style>
