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
.drawer-layer{position:fixed;inset:0;z-index:1120;background:rgba(15,31,24,.23);display:flex;justify-content:flex-end}.users-drawer{width:min(560px,92vw);height:100%;background:#f7faf8;display:flex;flex-direction:column;box-shadow:-18px 0 45px rgba(17,52,37,.18);animation:slide-in .22s ease}.users-drawer>header{padding:23px 25px;background:#fff;border-bottom:1px solid #e0e9e4;display:flex;justify-content:space-between}.users-drawer header span{font-size:10px;letter-spacing:.13em;color:#119c5d;font-weight:900}.users-drawer h3{margin:3px 0;font-size:23px}.users-drawer header p{margin:0;color:#7d8983}.users-drawer header button{border:0;background:#edf3f0;border-radius:10px;width:40px;height:40px;font-size:27px}.drawer-body{flex:1;overflow:auto;padding:20px}.drawer-state{padding:55px 20px;text-align:center;border:1px dashed #d4dfd9;border-radius:13px;background:#fff;color:#84908b}.drawer-state b,.drawer-state p{display:block}.drawer-state p{margin:7px 0}.drawer-state.error{color:#bd414b}.drawer-state button{display:block;margin:10px auto 0}.user-list{display:grid;gap:10px}.user-list article{display:grid;grid-template-columns:42px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:14px;background:#fff;border:1px solid #dfe8e3;border-radius:13px}.avatar{width:42px;height:42px;border-radius:12px;background:#e6f5ed;display:grid;place-items:center;color:#087d49;font-weight:900}.user-list article>div{min-width:0}.user-list strong,.user-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.user-list small{margin-top:3px;color:#88948e;font-size:11px}.user-list label{font-size:12px;color:#596760;white-space:nowrap}.delete{border:0;background:#fff0f1;color:#bd3e48;border-radius:8px;padding:7px 9px;font-weight:800}.users-drawer>footer{padding:15px 20px;border-top:1px solid #dfe8e3;background:#fff;text-align:right}.users-drawer>footer button{border:0;background:#109d5d;color:#fff;border-radius:9px;padding:9px 17px;font-weight:800}@keyframes slide-in{from{opacity:.4;transform:translateX(36px)}to{opacity:1;transform:none}}@media(max-width:620px){.user-list article{grid-template-columns:42px minmax(0,1fr)}.user-list label,.delete{grid-column:2}}
</style>
