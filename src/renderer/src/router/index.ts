import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
	{
		path: '/',
		name: 'view',
		component: () => import('../views/loginViews/Login.vue'),
	},
	{
		path: '/login',
		name: 'Login',
		component: () => import('../views/loginViews/Login.vue'),
	},
	{
		path: '/view-img',
		name: 'ViewIMG',
		component: () => import('../views/imgView/IMGView.vue'),
	},
	{
		path: '/register',
		name: 'Register',
		component: () => import('../views/registerViews/Register.vue'),
	},
	{
		path: '/registerResult/:userInfo',
		name: 'RegisterResult',
		component: () => import('../views/registerViews/RegisterResult.vue'),
		props: true,
	},
	{
		path: '/home',
		name: 'Home',
		component: () => import('../views/homeViews/Home.vue'),
		children: [
			{
				path: '',
				redirect: { name: 'chat' },
			},
			{
				path: 'chat', // 对应 /home/chat
				name: 'chat',
				component: () => import('../views/homeViews/chat/ChatView.vue'),
			},
			{
				path: 'user', // 对应 /home/user
				name: 'user',
				component: () =>
					import('../views/homeViews/friend/FriendList.vue'),
			},
			{
				path: 'setting', // 对应 /home/setting
				name: 'setting',
				component: () =>
					import('../views/homeViews/setting/SettingView.vue'),
			},
		],
	},
	{
		path: '/chat-standalone',
		name: 'ChatStandalone',
		component: () =>
			import('../views/homeViews/chat/ChatStandaloneView.vue'),
	},
]

const router = createRouter({
	history: createWebHashHistory(),
	routes,
})

export default router
