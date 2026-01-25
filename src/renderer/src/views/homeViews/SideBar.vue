<template>
	<div
		class="main-sidebar gap-3 h-full flex flex-col items-center justify-between rounded-[14px] transition-all duration-300 ease-in-out relative"
		:style="{ width: isExpanded ? width + 'px' : '76px' }"
	>
		<div
			class="h-full fixed top-0 drag -z-10"
			:style="{ width: isExpanded ? width + 'px' : '76px' }"
			@mousedown="handleDragMouseDown"
		></div>

		<div
			class="flex flex-col no-drag w-full"
			:class="[platfrom === 'darwin' ? 'mt-10' : 'mt-2']"
		>
			<div class="flex items-center w-full relative h-12">
				<div class="flex items-center shrink-0 pl-[18px]">
					<n-dropdown
						trigger="click"
						placement="right-start"
						style="border: 1px solid #ccc; border-radius: 10px"
						:options="userMenuOptions"
					>
						<n-avatar
							round
							:size="40"
							:src="user.avatarUrl"
							class="cursor-pointer shrink-0 avatar-layer"
						/>
					</n-dropdown>
				</div>

				<Transition name="fade-slide">
					<div
						v-if="isExpanded"
						class="flex flex-col flex-1 overflow-hidden ml-3"
					>
						<span
							class="text-sm font-bold whitespace-nowrap truncate text-text-main"
						>
							{{ user.userName }}
						</span>
						<span
							class="text-[10px] text-gray-500 whitespace-nowrap"
							>在线</span
						>
					</div>
				</Transition>

				<Transition name="fade-scale">
					<div v-if="isExpanded" class="shrink-0 pr-4">
						<n-dropdown
							trigger="click"
							placement="right-start"
							style="
								width: 140px;
								border: 1px solid #ccc;
								border-radius: 10px;
							"
							:options="addMenuOptions"
						>
							<n-icon
								size="20"
								class="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
							>
								<Add16Filled />
							</n-icon>
						</n-dropdown>
					</div>
				</Transition>
			</div>
		</div>

		<div class="no-drag w-full px-2 flex justify-center mt-2">
			<div
				class="text-zinc-800 flex items-center cursor-pointer overflow-hidden transition-custom hover:bg-sidebar-unselect-item/30"
				:class="
					isExpanded
						? 'is-expanded  bg-card-bg'
						: 'is-collapsed bg-card-bg hover:bg-sidebar-unselect-item/30'
				"
				@click="showSearchModal = true"
			>
				<n-icon size="20" color="#666" class="shrink-0">
					<Search />
				</n-icon>

				<Transition name="fade">
					<span
						v-if="isExpanded"
						class="text-[12px] text-zinc-500 whitespace-nowrap ml-2"
					>
						搜索内容(⌘+K)
					</span>
				</Transition>
			</div>
		</div>

		<div
			v-if="!isExpanded"
			class="no-drag w-full px-4 flex justify-center transition-all"
		>
			<n-dropdown
				trigger="click"
				placement="right-start"
				style="
					width: 140px;
					border: 1px solid #ccc;
					border-radius: 10px;
				"
				:options="addMenuOptions"
			>
				<div
					class="w-9 h-9 bg-card-bg rounded-full flex items-center justify-center hover:bg-sidebar-unselect-item/30 cursor-pointer transition-all"
				>
					<n-icon size="20">
						<Add />
					</n-icon>
				</div>
			</n-dropdown>
		</div>

		<div
			class="flex-1 w-full flex flex-col items-center gap-1 rounded-md pt-0 p-2 overflow-y-auto"
		>
			<div
				v-for="item in menus"
				:key="item.key"
				:class="[
					'flex items-center cursor-pointer transition-all no-drag',
					isExpanded
						? 'w-full px-3 h-9 gap-3 rounded-lg'
						: 'w-12 h-12 flex-col justify-center gap-1 rounded-xl',
					route.name === item.name
						? ' bg-sidebar-select-bg text-primary-600'
						: ' hover:bg-sidebar-select-bg/35 ',
				]"
				@click="go(item)"
			>
				<n-badge :dot="item.hasMessage">
					<div class="flex justify-center items-center">
						<n-icon
							size="18"
							:class="[
								route.name === item.name
									? ' text-sidebar-select-item'
									: ' text-sidebar-unselect-item',
							]"
						>
							<component :is="iconMap[item.icon]" />
						</n-icon>
					</div>
				</n-badge>

				<span
					v-if="isExpanded"
					class="text-xs whitespace-nowrap overflow-hidden"
					:class="[
						route.name === item.name
							? ' text-sidebar-select-item'
							: ' text-sidebar-unselect-item',
					]"
				>
					{{ item.label }}
				</span>
				<span
					v-else
					class="text-[10px] leading-none"
					:class="[
						route.name === item.name
							? ' text-sidebar-select-item'
							: ' text-sidebar-unselect-item',
					]"
				>
					{{ item.label }}
				</span>
			</div>
		</div>

		<div
			:class="[
				'mb-4 no-drag w-full flex  border-gray-200/50 pt-4',
				isExpanded ? 'justify-end px-4' : 'justify-center',
			]"
		>
			<div
				class="text-zinc-400 w-8 h-8 flex justify-center items-center rounded-full hover:bg-zinc-200 cursor-pointer transition-all"
				@click="$emit('toggle')"
			>
				<n-icon size="20">
					<component
						:is="isExpanded ? ChevronBack : ChevronForward"
					/>
				</n-icon>
			</div>
		</div>
		<n-modal
			v-model:show="showSearchModal"
			preset="dialog"
			title="全局搜索"
			:show-icon="false"
			transform-origin="center"
			style="width: 600px; border-radius: 20px; padding: 12px"
		>
			<div class="flex flex-col gap-4 mt-4">
				<n-input
					type="text"
					placeholder="搜索联系人、群组、聊天记录..."
					size="large"
					clearable
				>
					<template #prefix>
						<n-icon><SearchOutline /></n-icon>
					</template>
				</n-input>

				<div class="search-content min-h-[200px]">
					<div class="grid grid-cols-3 gap-3">
						<div
							v-for="item in ['联系人', '群组', '文件']"
							:key="item"
							class="flex flex-col items-center p-4 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
						>
							<div
								class="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-2"
							></div>
							<span class="text-xs text-gray-500">{{
								item
							}}</span>
						</div>
					</div>
				</div>
			</div>
		</n-modal>

		<n-modal
			v-model:show="showAddFriendModal"
			preset="card"
			title="添加好友"
			transform-origin="center"
			:segmented="{ content: true, footer: true }"
			:bordered="false"
			style="max-width: 420px; width: 95%; border-radius: 20px"
		>
			<div class="flex flex-col gap-5">
				<n-input-group>
					<n-input
						placeholder="输入 UID / 账号"
						size="large"
						:style="{ flex: 1 }"
					/>
					<n-button type="primary" size="large" ghost>
						查找
					</n-button>
				</n-input-group>

				<div
					class="bg-gray-50/80 p-5 rounded-2xl border border-dashed border-gray-200 overflow-hidden"
				>
					<div class="flex items-center gap-4">
						<n-avatar
							round
							:size="56"
							src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
							class="flex-shrink-0 border-2 border-white shadow-sm"
						/>
						<div class="min-w-0 flex-1">
							<h3
								class="text-base font-bold m-0 truncate text-gray-800"
							>
								欲盖弥彰
							</h3>
							<p class="text-[11px] text-gray-400 m-0">
								UID: 1000293
							</p>
						</div>
					</div>

					<div class="mt-4">
						<p
							class="text-[11px] font-medium text-gray-500 mb-1.5 ml-1 uppercase tracking-wider"
						>
							验证信息
						</p>
						<n-input
							type="textarea"
							placeholder="我是..."
							:autosize="{ minRows: 2, maxRows: 2 }"
							class="bg-white border-none shadow-sm"
							style="border-radius: 10px"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3 mt-1">
					<n-button
						strong
						secondary
						size="large"
						@click="showAddFriendModal = false"
						style="border-radius: 12px"
					>
						取消
					</n-button>
					<n-button
						type="primary"
						size="large"
						style="border-radius: 12px"
					>
						发送申请
					</n-button>
				</div>
			</div>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import {
	NAvatar,
	NIcon,
	NTag,
	NDropdown,
	NModal,
	NInputGroup,
	NInput,
	NButton,
	NBadge,
} from 'naive-ui'
import { ref, onMounted, h } from 'vue'
import type { Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
	Chatbubbles,
	Person,
	Settings,
	SearchOutline as Search,
	Add,
	ChevronBackOutline as ChevronBack,
	ChevronForwardOutline as ChevronForward,
} from '@vicons/ionicons5'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { Add16Filled } from '@vicons/fluent'

defineProps<{ isExpanded: boolean; width: number }>()
const emit = defineEmits(['toggle'])

const user = useUserInfoStore()
const router = useRouter()
const route = useRoute()
const showSearchModal = ref(false)
const showAddFriendModal = ref(false)
const platfrom = window.api.platform

interface MenuItem {
	key: string
	name: string
	icon: string
	label?: string
	hasMessage?: boolean
}

const addMenuOptions = [
	{
		label: '新建聊天',
		key: 'new-chat',
		icon: () => h(NIcon, null, { default: () => h(Add) }),
	},
	{
		label: '新建群组',
		key: 'new-group',
		icon: () => h(NIcon, null, { default: () => h(Add) }),
	},
	{
		label: '添加好友',
		key: 'new-friend',
		icon: () => h(NIcon, null, { default: () => h(Add) }),
		props: {
			onClick: () => {
				showAddFriendModal.value = true
			},
		},
	},
]

const userMenuOptions = [
	{
		key: 'user-info',
		label: '个人信息',
		type: 'render',
		render: () =>
			h('div', { class: 'p-4 flex flex-col w-200px' }, [
				h('div', { class: 'flex ' }, [
					h(NAvatar, {
						class: 'mb-2',
						src: user.avatarUrl,
						size: 62,
						round: true,
					}),
					h('div', { class: 'ml-4 flex flex-col justify-center' }, [
						h(
							'div',
							{
								class: 'text-lg font-semibold flex items-center text-gray-800',
							},
							[
								h(
									'span',
									{ class: 'text-text-main' },
									user.userName,
								),
								h(
									NTag,
									{
										class: 'ml-2',
										type: 'success',
										size: 'small',
										round: true,
									},
									{ default: () => '在线' },
								),
							],
						),
						h(
							'div',
							{ class: 'text-xs text-gray-500' },
							user.email,
						),
					]),
				]),
			]),
	},
	{ type: 'divider' },
	{ label: '我的个人名片', key: 'my-card' },
	{ type: 'divider' },
	{
		label: '退出登录',
		key: 'logout',
		props: {
			onClick: () => {
				window.electron.ipcRenderer.send('logout-open-loginWindow')
			},
		},
	},
]

const iconMap: Record<string, Component> = {
	chat: Chatbubbles,
	user: Person,
	setting: Settings,
}

const handleDragMouseDown = () => {
	document.body.click() // 解决 Dropdown 在拖拽区不消失的问题
}

const menus = ref<MenuItem[]>([])
onMounted(() => {
	menus.value = [
		{
			key: 'home',
			name: 'chat',
			icon: 'chat',
			label: '消息',
			hasMessage: true,
		},
		{ key: 'user', name: 'user', icon: 'user', label: '通讯录' },
		{ key: 'setting', name: 'setting', icon: 'setting', label: '设置' },
	]
})

function go(item: MenuItem): void {
	if (route.name !== item.name) router.push({ name: item.name })
}
</script>

<style scoped>
.drag {
	-webkit-app-region: drag;
}
.no-drag {
	-webkit-app-region: no-drag;
}

/* 基础过渡曲线 */
.main-sidebar {
	transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 头像层不闪烁优化 */
.avatar-layer {
	backface-visibility: hidden;
	transform: translateZ(0);
}

/* 名字滑入动画 */
.fade-slide-enter-active {
	transition: all 0.3s ease-out 0.1s;
}
.fade-slide-leave-active {
	transition: all 0.2s ease-in;
	position: absolute;
	left: 58px; /* 18px + 40px */
}
.fade-slide-enter-from,
.fade-slide-leave-to {
	opacity: 0;
	transform: translateX(-10px);
}

/* 添加按钮缩放动画 */
.fade-scale-enter-active {
	transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s;
}
.fade-scale-leave-active {
	transition: all 0.15s ease-in;
}
.fade-scale-enter-from,
.fade-scale-leave-to {
	opacity: 0;
	transform: scale(0.5);
}

/* 搜索框专属动画 */
.transition-custom {
	transition:
		width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
		height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
		background-color 0.2s linear,
		border-radius 0.3s ease;
	will-change: width, height;
}

.is-expanded {
	width: 100%;
	height: 32px;
	padding: 0 12px;
	border-radius: 8px;
	border: 1px solid rgba(156, 163, 175, 0.2);
}

.is-collapsed {
	width: 36px;
	height: 36px;
	padding: 0;
	justify-content: center;
	border-radius: 50%;
	border: 1px solid transparent;
}

/* 搜索框文字过渡 */
.fade-enter-active {
	transition: opacity 0.2s ease 0.1s;
}
.fade-leave-active {
	transition: opacity 0.1s ease;
	position: absolute;
}
.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
