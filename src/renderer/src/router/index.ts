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
		component: () => import('../views/IMGView/IMGView.vue'),
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
				path: 'moments', // 对应 /home/moments
				name: 'moments',
				component: () =>
					import('../views/homeViews/moments/DynamicsView.vue'),
			},
			{
				path: 'wallet', // 对应 /home/wallet
				name: 'wallet',
				component: () =>
					import('../views/homeViews/wallet/WalletView.vue'),
			},
			{
				path: 'setting', // 对应 /home/setting
				name: 'setting',
				component: () =>
					import('../views/homeViews/setting/SettingView.vue'),
			},
			{
				path: 'cloud-docs',
				name: 'cloudDocs',
				component: () =>
					import('../views/homeViews/cloudDocs/CloudDocsManageView.vue'),
			},
			{
				path: 'cloud-docs/:docId',
				name: 'cloudDocsEditor',
				component: () =>
					import('../views/homeViews/cloudDocs/CloudDocEditorView.vue'),
			},
		],
	},
	{
		path: '/chat-standalone',
		name: 'ChatStandalone',
		component: () =>
			import('../views/homeViews/chat/ChatStandaloneView.vue'),
	},
	{
		path: '/demo/membership-topup-notice',
		name: 'MembershipTopUpNoticeDemo',
		component: () => import('../views/demo/MembershipTopUpNoticeDemo.vue'),
	},
	{
		path: '/demo/friend-detail',
		name: 'FriendDetailDemo',
		component: () =>
			import('../views/homeViews/friend/FriendDetailPage.vue'),
	},
]

const router = createRouter({
	history: createWebHashHistory(),
	routes,
})

export default router
