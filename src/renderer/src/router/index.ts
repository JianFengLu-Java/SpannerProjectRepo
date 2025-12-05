
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
    component: () => import('../views/Home/Home.vue')
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;