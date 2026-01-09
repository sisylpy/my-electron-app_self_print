import { createRouter, createWebHistory } from 'vue-router';

// 直接引入页面组件
import Home from '@/views/Home.vue';
import Bills from '@/views/Bills.vue';
// import Return from '@/views/Return.vue';
// import PreparePrint from '@/views/PreparePrint.vue';

const router = createRouter({
  mode: 'hash', 
  // 使用 history 模式
  history: createWebHistory(process.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: Home, // 首页组件
    },
    {
      path: '/bills',
      name: 'Bills',
      component: Bills, // Bills 页面
    },
    // {
    //   path: '/return',
    //   name: 'Return',
    //   component: Return, // Return 页面
    // },
    // {
    //   path: '/prepare-print',
    //   name: 'PreparePrint',
    //   component: PreparePrint, // PreparePrint 页面
    // },
    // 默认重定向到首页
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
});

// 捕获重复导航的错误
const originalPush = router.push;
router.push = function push(location) {
  return originalPush.call(this, location).catch((err) => err);
};

export default router;
