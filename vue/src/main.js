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
app.mount('#app');
