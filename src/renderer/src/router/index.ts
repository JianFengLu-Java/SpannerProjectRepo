
import { c } from 'naive-ui';
import path from 'path';
import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'view',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Registers/Register.vue'),
  },
  {
    path: '/registerResult/:userInfo',
    name: 'RegisterResult',
    component: ()=> import('../views/Registers/RegisterResult.vue'),
    props:true

  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/Home/Home.vue'),
    children: [
      {
        path: '',  // 默认子路由
        name: 'home',
        component: () => import('../views/Home/homeViews/ChatView.vue')
      },
      {
        path: 'chat',  // 对应 /home/chat
        name: 'chat',
        component: () => import('../views/Home/homeViews/ChatView.vue')
      },
      {
        path: 'user',  // 对应 /home/user
        name: 'user',
        component: () => import('../views/Home/homeViews/UserView.vue')
      },
      {
        path: 'setting',  // 对应 /home/setting
        name: 'setting',
        component: () => import('../views/Home/homeViews/SettingView.vue')
      }
    
    ]
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;