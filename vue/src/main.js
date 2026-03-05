import { createApp } from 'vue';
import App from './App.vue';
import { createRouter ,createWebHashHistory} from 'vue-router';
import Home from './views/Home.vue';
import Bills from './views/Bills.vue';
import Screen from './views/Screen.vue';
import TRyVue from './views/try.vue';
import store from './store'; // 引入 store
import jQuery from 'jquery'
import { BootstrapVue3 } from 'bootstrap-vue-3';

import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'

import 'admin-lte/dist/css/adminlte.min.css'
import 'admin-lte/dist/js/adminlte.min.js'

// 引入 vxe-table
import VXETable from 'vxe-table'
import 'vxe-table/lib/style.css'
const routes = [
  // {
  //   path: '/',
  //   name: 'TRyVue',
  //   component: TRyVue,
  
  // },
  {
    path: '/',
    name: 'Screen',
    component: Screen,
  },
  { path: '/home',  name: 'Home',component: Home },
  { path: '/bills', name: 'Bills', component: Bills },
];
window.$ = window.jQuery = jQuery
const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

const app = createApp(App);
app.use(router);
app.use(store)  // 使用 Vue Router
app.use(BootstrapVue3);
app.use(VXETable); // 使用 vxe-table

// 添加错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue 错误:', err);
  console.error('错误信息:', info);
  console.error('组件实例:', instance);
};

// 挂载应用
const mountElement = document.getElementById('app');
if (mountElement) {
  app.mount('#app');
  console.log('✅ Vue 应用已挂载到 #app');
} else {
  console.error('❌ 找不到 #app 元素！');
}
