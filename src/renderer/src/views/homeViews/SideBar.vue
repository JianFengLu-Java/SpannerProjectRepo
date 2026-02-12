<template>
	<div
		class="main-sidebar gap-3 h-full flex flex-col items-center justify-between rounded-[24px] transition-all duration-300 ease-in-out relative"
		:style="{ width: isExpanded ? width + 'px' : '76px' }"
	>
		<div
			class="h-full fixed top-0 drag -z-10"
			:style="{ width: isExpanded ? width + 'px' : '76px' }"
			@mousedown="closeAllDropdowns"
		></div>

		<div
			class="flex flex-col no-drag w-full"
			:class="[platfrom === 'darwin' ? 'mt-10' : 'mt-2']"
		>
			<div class="flex items-center w-full relative h-12">
				<div class="flex items-center shrink-0 pl-[21px]">
					<n-dropdown
						trigger="manual"
						placement="right-start"
						style="border: 1px solid #ccc; border-radius: 12px"
						:options="userMenuOptions"
						:show="showUserDropdown"
						@select="handleUserMenuSelect"
						@clickoutside="showUserDropdown = false"
					>
						<n-avatar
							round
							:size="34"
							:src="user.avatarUrl"
							class="cursor-pointer shrink-0 avatar-layer"
							@click.stop="toggleUserDropdown"
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
							trigger="manual"
							placement="right-start"
							style="
								width: 140px;
								border: 1px solid #ccc;
								border-radius: 12px;
							"
							:options="addMenuOptions"
							:show="showAddDropdown"
							@clickoutside="showAddDropdown = false"
						>
							<n-icon
								size="20"
								class="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
								@click="toggleAddDropdown"
							>
								<Add16Filled />
							</n-icon>
						</n-dropdown>
					</div>
				</Transition>
			</div>
		</div>

		<div class="no-drag w-full px-2 flex justify-center">
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
				trigger="manual"
				placement="right-start"
				style="
					width: 140px;
					border: 1px solid #ccc;
					border-radius: 12px;
				"
				:options="addMenuOptions"
				:show="showAddDropdown"
				@clickoutside="showAddDropdown = false"
			>
				<div
					class="w-9 h-9 bg-card-bg rounded-full flex items-center justify-center hover:bg-sidebar-unselect-item/30 cursor-pointer transition-all"
					@click="toggleAddDropdown"
				>
					<n-icon size="20">
						<Add />
					</n-icon>
				</div>
			</n-dropdown>
		</div>

		<div
			class="flex-1 w-full flex flex-col items-center gap-1 rounded-xl pt-0 p-2 overflow-y-auto"
		>
			<div
				v-for="item in menus"
				:key="item.key"
				:class="[
					'flex items-center cursor-pointer transition-all no-drag',
					isExpanded
						? 'w-full px-3 h-9 gap-3 rounded-xl'
						: 'w-12 h-12 flex-col justify-center gap-1 rounded-2xl',
					route.name === item.name
						? ' bg-sidebar-select-bg text-primary-600'
						: ' hover:bg-sidebar-select-bg/35 ',
				]"
				@click="go(item)"
			>
				<n-badge :dot="item.hasMessage" class="sidebar-menu-dot">
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

		<n-modal
			v-model:show="showSearchModal"
			preset="dialog"
			title="全局搜索"
			:show-icon="false"
			transform-origin="center"
			style="width: 600px; border-radius: 24px; padding: 12px"
		>
			<div class="flex flex-col gap-4 mt-4">
				<n-input
					type="text"
					placeholder="搜索联系人、群组、聊天记录..."
					size="large"
					clearable
					class="rounded-xl"
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
							class="flex flex-col items-center p-4 rounded-2xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
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

		<FriendApplyModal
			v-model:show="showAddFriendModal"
			@applied="handleFriendApplied"
		/>
	</div>
</template>

<script setup lang="ts">
import {
	NAvatar,
	NIcon,
	NTag,
	NDropdown,
	NModal,
	NInput,
	NBadge,
} from 'naive-ui'
import { ref, computed, onMounted, onUnmounted, h } from 'vue'
import type { Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
	Chatbubbles,
	Person,
	Settings,
	SearchOutline as Search,
	Add,
	ApertureOutline,
} from '@vicons/ionicons5'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { Add16Filled } from '@vicons/fluent'
import FriendApplyModal from '@renderer/components/FriendApplyModal.vue'
import { useFriendStore } from '@renderer/stores/friend'
import { useChatStore } from '@renderer/stores/chat'
import { storeToRefs } from 'pinia'

defineProps<{ isExpanded: boolean; width: number }>()

const user = useUserInfoStore()
const friendStore = useFriendStore()
const chatStore = useChatStore()
const router = useRouter()
const route = useRoute()
const { chatlist } = storeToRefs(chatStore)
const showSearchModal = ref(false)
const showAddFriendModal = ref(false)
const showUserDropdown = ref(false)
const showAddDropdown = ref(false)
const platfrom = window.api.platform

// Dropdown 控制函数
const toggleUserDropdown = (): void => {
	showUserDropdown.value = !showUserDropdown.value
	if (showUserDropdown.value) {
		showAddDropdown.value = false
	}
}

const toggleAddDropdown = (): void => {
	showAddDropdown.value = !showAddDropdown.value
	if (showAddDropdown.value) {
		showUserDropdown.value = false
	}
}

const closeAllDropdowns = (): void => {
	showUserDropdown.value = false
	showAddDropdown.value = false
}

const handleFriendApplied = async (): Promise<void> => {
	await Promise.all([
		friendStore.fetchFriends(),
		friendStore.fetchPendingRequests(),
	])
}

// 全局监听器：点击侧边栏外部时关闭 dropdown
const handleGlobalClick = (e: MouseEvent): void => {
	const target = e.target as HTMLElement
	// Naive UI 的 dropdown 菜单渲染在 body 下，不属于 sidebar DOM，
	// 点击菜单项时不应触发“外部点击关闭”。
	if (target.closest('.n-dropdown-menu')) {
		return
	}
	// 检查点击是否在侧边栏内
	const sidebar = document.querySelector('.main-sidebar')
	if (sidebar && !sidebar.contains(target)) {
		closeAllDropdowns()
	}
}

interface MenuItem {
	key: string
	name: string
	icon: string
	label?: string
	hasMessage?: boolean
}

const hasUnreadChatMessage = computed(() =>
	chatlist.value.some((chat) => (chat.unreadCount || 0) > 0),
)

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
	},
]

const handleUserMenuSelect = (key: string): void => {
	if (key !== 'logout') return
	showUserDropdown.value = false
	user.logout()
	window.localStorage.removeItem('userInfo')
	window.electron.ipcRenderer.send('logout-open-loginWindow')
}

const iconMap: Record<string, Component> = {
	chat: Chatbubbles,
	user: Person,
	moments: ApertureOutline,
	setting: Settings,
}

const menus = computed<MenuItem[]>(() => [
	{
		key: 'home',
		name: 'chat',
		icon: 'chat',
		label: '消息',
		hasMessage: hasUnreadChatMessage.value,
	},
	{
		key: 'user',
		name: 'user',
		icon: 'user',
		label: '通讯录',
		hasMessage: friendStore.pendingRequests.length > 0,
	},
	{ key: 'moments', name: 'moments', icon: 'moments', label: '动态' },
	{ key: 'setting', name: 'setting', icon: 'setting', label: '设置' },
])

onMounted(() => {
	void friendStore.fetchPendingRequests()

	// 添加全局点击监听器
	document.addEventListener('mousedown', handleGlobalClick)
})

onUnmounted(() => {
	// 移除全局监听器
	document.removeEventListener('mousedown', handleGlobalClick)
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
	border-radius: 12px;
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

:deep(.sidebar-menu-dot .n-badge-sup) {
	background-color: #ef4444;
}
</style>
