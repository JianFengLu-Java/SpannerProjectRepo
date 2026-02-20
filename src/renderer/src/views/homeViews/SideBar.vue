<template>
	<div
		class="main-sidebar gap-3 h-full flex flex-col items-center justify-between rounded-[24px] relative"
		:class="{ 'sidebar-dragging': isDragging }"
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
								class="text-gray-400 dark:text-gray-300 cursor-pointer hover:text-gray-600 dark:hover:text-gray-100 transition-colors"
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
				class="text-zinc-800 dark:text-gray-200 flex items-center cursor-pointer overflow-hidden transition-custom hover:bg-sidebar-unselect-item/30"
				:class="
					isExpanded
						? 'is-expanded  bg-card-bg'
						: 'is-collapsed bg-card-bg hover:bg-sidebar-unselect-item/30'
				"
				@click="openGlobalSearchModal"
			>
				<n-icon
					size="20"
					class="shrink-0 text-zinc-500 dark:text-zinc-300"
				>
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
			class="flex-1 w-full flex flex-col items-center gap-1 rounded-xl pt-0 p-2 overflow-hidden"
		>
			<div class="w-full flex flex-col gap-1">
				<div
					v-for="item in routeMenus"
					:key="item.key"
					:class="[
						'flex items-center cursor-pointer transition-all no-drag',
						isExpanded
							? 'w-full px-3 h-9 gap-3 rounded-xl'
							: 'w-12 h-12 mx-auto flex-col items-center justify-center gap-1 rounded-2xl',
						isMenuActive(item)
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
									isMenuActive(item)
										? ' text-[#3695ff] dark:text-[#56a7ff]'
										: ' text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)]',
								]"
							>
								<component :is="iconMap[item.icon]" />
							</n-icon>
						</div>
					</n-badge>

					<span
						v-if="isExpanded"
						class="text-xs whitespace-nowrap overflow-hidden flex-1"
						:class="[
							isMenuActive(item)
								? ' text-sidebar-select-item'
								: ' text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)]',
						]"
					>
						{{ item.label }}
					</span>
					<span
						v-else
						class="text-[10px] leading-none text-center"
						:class="[
							isMenuActive(item)
								? ' text-sidebar-select-item'
								: ' text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)]',
						]"
					>
						{{ item.label }}
					</span>
				</div>
			</div>

			<div v-if="slotMenus.length > 0" class="w-full py-2 shrink-0">
				<div class="slot-separator mx-auto"></div>
				<div
					v-if="isExpanded"
					class="mt-2 px-2 text-[11px] tracking-wide text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)]"
				>
					导航
				</div>
			</div>

			<div v-if="slotMenus.length > 0" class="w-full flex-1 min-h-0">
				<div
					class="slot-scroll-wrapper w-full h-full flex flex-col gap-1"
				>
					<n-tooltip
						v-for="item in slotMenus"
						:key="item.key"
						trigger="hover"
						placement="right"
						:disabled="isExpanded || !shouldShowSlotTooltip(item)"
					>
						<template #trigger>
							<div
								:class="[
									'flex items-center cursor-pointer transition-all no-drag relative group shrink-0',
									isExpanded
										? 'w-full px-3 h-9 gap-3 rounded-xl'
										: 'w-12 h-12 mx-auto flex-col items-center justify-center gap-1 rounded-2xl',
									isMenuActive(item)
										? ' bg-sidebar-select-bg text-primary-600'
										: ' hover:bg-sidebar-select-bg/35 ',
								]"
								@click="go(item)"
							>
								<n-badge
									:dot="item.hasMessage"
									class="sidebar-menu-dot"
								>
									<div
										class="flex justify-center items-center"
									>
										<n-icon
											size="18"
											:class="[
												isMenuActive(item)
													? ' text-[#3695ff] dark:text-[#56a7ff]'
													: ' text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)]',
											]"
										>
											<component
												:is="iconMap[item.icon]"
											/>
										</n-icon>
									</div>
								</n-badge>

								<span
									v-if="isExpanded"
									class="text-xs whitespace-nowrap overflow-hidden flex-1"
									:class="{ 'pr-5': !!item.slotKey }"
								>
									<span
										class="block truncate"
										:class="[
											isMenuActive(item)
												? ' text-sidebar-select-item'
												: ' text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)]',
										]"
									>
										{{ item.label }}
									</span>
								</span>
								<span
									v-else
									class="text-[10px] leading-none text-center"
									:class="[
										isMenuActive(item)
											? ' text-sidebar-select-item'
											: ' text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)]',
									]"
								>
									{{ getCollapsedSlotLabel(item) }}
								</span>
								<button
									v-if="item.slotKey"
									type="button"
									:class="[
										'absolute top-1 right-1 z-10 h-4 w-4 rounded-full bg-card-bg/92 border border-border-default/70 shadow-sm flex items-center justify-center text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)] hover:text-sidebar-select-item transition-all duration-150 opacity-0 group-hover:opacity-100',
									]"
									@click.stop="destroySlot(item.slotKey)"
								>
									<n-icon size="12">
										<Close />
									</n-icon>
								</button>
							</div>
						</template>
						{{ item.label }}
					</n-tooltip>
				</div>
			</div>
		</div>

		<n-modal
			v-model:show="showSearchModal"
			:mask-closable="true"
			transform-origin="center"
		>
			<div class="next-global-search-modal w-[min(92vw,680px)] max-h-[90vh] flex flex-col">
				<div class="modal-header-section">
					<div class="flex items-center justify-between w-full">
						<div>
							<div class="text-[15px] font-semibold text-white">全局搜索</div>
							<div class="text-[11px] text-blue-100/90">
								快速定位页面、联系人与聊天记录
							</div>
						</div>
						<button
							type="button"
							class="close-orb hover:bg-white/10 transition-colors"
							@click="showSearchModal = false"
						>
							<n-icon size="18" class="text-white/85">
								<Close />
							</n-icon>
						</button>
					</div>
					<div class="mt-3">
						<n-input
							ref="searchInputRef"
							v-model:value="globalSearchQuery"
							type="text"
							placeholder="搜索联系人、群组、聊天记录..."
							size="large"
							clearable
							class="search-modal-input"
						>
							<template #prefix>
								<n-icon><Search /></n-icon>
							</template>
							<template #suffix>
								<span class="text-[11px] text-slate-400">
									{{ isMac ? '⌘K' : 'Ctrl+K' }}
								</span>
							</template>
						</n-input>
					</div>
				</div>

				<div class="search-modal-body p-5 bg-white dark:bg-zinc-900 flex-1 overflow-y-auto">
					<div class="search-content min-h-[240px]">
						<div v-if="!globalSearchQuery.trim()" class="space-y-3">
							<div class="text-xs text-gray-400 dark:text-gray-500">
								快捷入口
							</div>
							<div class="grid grid-cols-3 gap-2.5">
								<button
									v-for="item in globalSearchQuickEntries"
									:key="item.key"
									type="button"
									class="search-entry-btn"
									@click="handleGlobalSearchEntryClick(item)"
								>
									<div class="search-entry-icon">
										<n-icon size="16">
											<component :is="item.icon" />
										</n-icon>
									</div>
									<div class="min-w-0">
										<div class="truncate text-xs font-semibold text-text-main">
											{{ item.label }}
										</div>
										<div class="truncate text-[11px] text-gray-400 dark:text-gray-500">
											{{ item.description }}
										</div>
									</div>
								</button>
							</div>
						</div>

						<div v-else class="space-y-2">
							<div class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
								<span>
									匹配结果 ({{ filteredGlobalSearchEntries.length }})
								</span>
								<span v-if="isSearchingGlobalChatRecords">
									正在检索聊天记录...
								</span>
							</div>
							<div
								v-if="filteredGlobalSearchEntries.length > 0"
								class="max-h-[320px] space-y-1.5 overflow-y-auto pr-1"
							>
								<button
									v-for="item in filteredGlobalSearchEntries"
									:key="item.key"
									type="button"
									class="search-entry-btn search-entry-btn-result"
									@click="handleGlobalSearchEntryClick(item)"
								>
									<div class="search-entry-icon">
										<n-icon size="16">
											<component :is="item.icon" />
										</n-icon>
									</div>
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm font-medium text-text-main">
											{{ item.label }}
										</div>
										<div class="truncate text-xs text-gray-400 dark:text-gray-500">
											{{ item.description }}
										</div>
									</div>
									<n-tag size="small" round :bordered="false">
										{{ item.typeLabel }}
									</n-tag>
								</button>
							</div>
							<div
								v-else
								class="flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border-default text-center text-gray-400 dark:text-gray-500"
							>
								<n-icon size="28" class="mb-2 opacity-70">
									<Search />
								</n-icon>
								<p class="text-sm">没有匹配结果</p>
								<p class="text-xs">
									试试其他关键词，例如“动态”或“设置”
								</p>
							</div>
						</div>
					</div>

					<div
						class="mt-4 flex items-center justify-between border-t border-border-default/70 pt-3 text-[11px] text-gray-400 dark:text-gray-500"
					>
						<div class="flex items-center gap-3">
							<div class="flex items-center gap-1">
								<span class="search-shortcut-key">Enter</span>
								<span>打开</span>
							</div>
							<div class="flex items-center gap-1">
								<span class="search-shortcut-key">Esc</span>
								<span>关闭</span>
							</div>
						</div>
						<div>当前可搜索 {{ globalSearchEntries.length }} 项</div>
					</div>
				</div>
			</div>
		</n-modal>

		<FriendApplyModal
			v-model:show="showAddFriendModal"
			@applied="handleFriendApplied"
		/>

		<GroupCreateModal v-model:show="showGroupCreateModal" />
	</div>
</template>

<script setup lang="ts">
import {
	NAvatar,
	NIcon,
	NTag,
	NDropdown,
	NInput,
	NBadge,
	NModal,
	NTooltip,
	useMessage,
	type InputInst,
} from 'naive-ui'
import { ref, computed, onMounted, onUnmounted, h, watch, nextTick } from 'vue'
import type { Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
	Chatbubbles,
	Person,
	Settings,
	Search,
	Add,
	Aperture,
	Globe,
	Close,
	Wallet,
	DocumentText,
} from '@vicons/ionicons5'
import vipBadgeIcon from '@renderer/assets/VIP.svg'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { Add16Filled } from '@vicons/fluent'
import FriendApplyModal from '@renderer/components/FriendApplyModal.vue'
import { useFriendStore } from '@renderer/stores/friend'
import { useChatStore, type Message } from '@renderer/stores/chat'
import { useSidebarSlotStore } from '@renderer/stores/sidebarSlot'
import { useInAppBrowserStore } from '@renderer/stores/inAppBrowser'
import { storeToRefs } from 'pinia'
import request from '@renderer/utils/request'
import GroupCreateModal from '@renderer/components/GroupCreateModal.vue'

defineProps<{ isExpanded: boolean; width: number; isDragging?: boolean }>()

const user = useUserInfoStore()
const friendStore = useFriendStore()
const chatStore = useChatStore()
const sidebarSlotStore = useSidebarSlotStore()
const inAppBrowserStore = useInAppBrowserStore()
const message = useMessage()
const router = useRouter()
const route = useRoute()
const { chatlist } = storeToRefs(chatStore)
const showSearchModal = ref(false)
const globalSearchQuery = ref('')
const searchInputRef = ref<InputInst | null>(null)
const isSearchingGlobalChatRecords = ref(false)
const globalChatMatchedRecords = ref<
	Array<{
		chatId: number
		chatName: string
		message: Message
	}>
>([])
const showAddFriendModal = ref(false)
const showGroupCreateModal = ref(false)
const showUserDropdown = ref(false)
const showAddDropdown = ref(false)
const signatureDraft = ref('')
const isSavingSignature = ref(false)
const platfrom = window.api.platform
const isMac = platfrom === 'darwin'
const GLOBAL_CHAT_SEARCH_DEBOUNCE_MS = 260
const GLOBAL_CHAT_SEARCH_CHAT_LIMIT = 30
let globalChatSearchTimer: ReturnType<typeof setTimeout> | null = null
let globalChatSearchSeq = 0

const vipIdentityText = computed(() => {
	if (!user.vipActive) return '普通用户'
	if (user.userLevel >= 9) return '黑金VIP'
	if (user.userLevel >= 7) return '铂金VIP'
	if (user.userLevel >= 4) return '黄金VIP'
	return '尊享VIP'
})

const openEditProfileSlot = (): void => {
	sidebarSlotStore.openSlot({
		slotKey: 'edit-profile',
		title: '编辑资料',
		componentKey: 'edit-profile',
		icon: 'user',
	})
}

const saveDropdownSignature = async (): Promise<void> => {
	if (isSavingSignature.value) return
	const normalizedSignature = signatureDraft.value.trim().slice(0, 80)
	const currentSignature = user.signature || ''
	if (normalizedSignature === currentSignature) {
		signatureDraft.value = currentSignature
		return
	}
	isSavingSignature.value = true
	signatureDraft.value = normalizedSignature
	try {
		await request.put('/user/me', { signature: normalizedSignature })
		user.patchUserInfo({ signature: normalizedSignature })
	} catch (error) {
		console.error('更新签名失败', error)
		signatureDraft.value = currentSignature
		message.error('保存失败，请稍后重试')
	} finally {
		isSavingSignature.value = false
	}
	signatureDraft.value = user.signature || ''
}

// Dropdown 控制函数
const toggleUserDropdown = (): void => {
	showUserDropdown.value = !showUserDropdown.value
	if (showUserDropdown.value) {
		signatureDraft.value = user.signature || ''
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
	type: 'route' | 'slot'
	name?: string
	slotKey?: string
	icon: string
	label?: string
	hasMessage?: boolean
}

interface GlobalSearchEntry {
	key: string
	label: string
	description: string
	typeLabel: '页面' | '功能' | '标签页' | '联系人' | '聊天'
	icon: Component
	keywords: string[]
	action: () => void | Promise<void>
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
		props: {
			onClick: () => {
				showGroupCreateModal.value = true
			},
		},
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
								class: 'text-lg font-semibold flex items-center text-text-main',
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
								user.vipActive
									? h('img', {
											src: vipBadgeIcon,
											alt: 'VIP',
											class: 'ml-2 h-4 w-4 block vip-fill-red',
										})
									: null,
							],
						),
						h(
							'div',
							{ class: 'text-xs text-gray-500' },
							user.email,
						),
						h(
							'div',
							{
								class: user.vipActive
									? 'mt-1 text-xs text-amber-500 font-medium'
									: 'mt-1 text-xs text-gray-400',
							},
							`身份：${vipIdentityText.value}`,
						),
						h('div', { class: 'mt-2' }, [
							h(
								'div',
								{ class: 'text-[11px] text-gray-400 mb-1' },
								'个性签名',
							),
							h(NInput, {
								value: signatureDraft.value,
								size: 'small',
								clearable: true,
								placeholder: '编辑签名（回车/失焦保存）',
								maxlength: 80,
								'onUpdate:value': (value: string) => {
									signatureDraft.value = value
								},
								onBlur: () => {
									void saveDropdownSignature()
								},
								onKeydown: (event: KeyboardEvent) => {
									if (event.key === 'Enter') {
										event.preventDefault()
										void saveDropdownSignature()
									}
								},
							}),
							isSavingSignature.value
								? h(
										'div',
										{
											class: 'text-[10px] text-gray-400 mt-1',
										},
										'签名保存中...',
									)
								: null,
						]),
					]),
				]),
			]),
	},
	{ type: 'divider' },
	{ label: '用户中心', key: 'my-card' },
	{ label: '编辑个人信息', key: 'edit-profile' },
	{ type: 'divider' },
	{
		label: '退出登录',
		key: 'logout',
	},
]

const handleUserMenuSelect = (key: string): void => {
	if (key === 'my-card') {
		showUserDropdown.value = false
		sidebarSlotStore.openSlot({
			slotKey: 'my-profile-card',
			title: '用户中心',
			componentKey: 'profile-card',
			icon: 'user',
		})
		return
	}
	if (key === 'edit-profile') {
		showUserDropdown.value = false
		openEditProfileSlot()
		return
	}
	if (key !== 'logout') return
	showUserDropdown.value = false
	user.logout()
	window.localStorage.removeItem('userInfo')
	window.electron.ipcRenderer.send('logout-open-loginWindow')
}

const iconMap: Record<string, Component> = {
	chat: Chatbubbles,
	user: Person,
	moments: Aperture,
	wallet: Wallet,
	setting: Settings,
	web: Globe,
	cloudDocs: DocumentText,
}

const routeMenus = computed<MenuItem[]>(() => [
	{
		key: 'home',
		type: 'route',
		name: 'chat',
		icon: 'chat',
		label: '消息',
		hasMessage: hasUnreadChatMessage.value,
	},
	{
		key: 'user',
		type: 'route',
		name: 'user',
		icon: 'user',
		label: '通讯录',
		hasMessage: friendStore.pendingRequests.length > 0,
	},
	{
		key: 'moments',
		type: 'route',
		name: 'moments',
		icon: 'moments',
		label: '动态',
	},
	{
		key: 'wallet',
		type: 'route',
		name: 'wallet',
		icon: 'wallet',
		label: '钱包',
	},
	{
		key: 'setting',
		type: 'route',
		name: 'setting',
		icon: 'setting',
		label: '设置',
	},
	{
		key: 'cloud-docs',
		type: 'route',
		name: 'cloudDocs',
		icon: 'cloudDocs',
		label: '云文档',
	},
])

const slotMenus = computed<MenuItem[]>(() =>
	sidebarSlotStore.slots.map((slot) => ({
		key: `slot-${slot.slotKey}`,
		type: 'slot',
		slotKey: slot.slotKey,
		icon: slot.icon,
		label: slot.title,
	})),
)

const globalSearchEntries = computed<GlobalSearchEntry[]>(() => {
	const routeEntries: GlobalSearchEntry[] = routeMenus.value.map((item) => ({
		key: `route-${item.key}`,
		label: item.label || item.key,
		description: '跳转到对应页面',
		typeLabel: '页面',
		icon: iconMap[item.icon] || Search,
		keywords: [item.key, item.label || '', item.name || ''],
		action: () => {
			go(item)
			showSearchModal.value = false
		},
	}))

	const slotEntries: GlobalSearchEntry[] = slotMenus.value.map((item) => ({
		key: `slot-${item.slotKey || item.key}`,
		label: item.label || '临时标签页',
		description: '切换到已打开标签页',
		typeLabel: '标签页',
		icon: iconMap[item.icon] || Globe,
		keywords: [item.label || '', item.icon, item.slotKey || ''],
		action: () => {
			go(item)
			showSearchModal.value = false
		},
	}))

	const actionEntries: GlobalSearchEntry[] = [
		{
			key: 'action-add-friend',
			label: '添加好友',
			description: '打开添加好友弹窗',
			typeLabel: '功能',
			icon: Add,
			keywords: ['添加', '好友', 'friend'],
			action: () => {
				showSearchModal.value = false
				showAddFriendModal.value = true
			},
		},
		{
			key: 'action-edit-profile',
			label: '编辑个人信息',
			description: '修改头像、签名、联系方式',
			typeLabel: '功能',
			icon: Person,
			keywords: ['编辑', '个人', '资料', 'profile'],
			action: () => {
				showSearchModal.value = false
				openEditProfileSlot()
			},
		},
	]

	const keyword = globalSearchQuery.value.trim().toLowerCase()

	const contactEntries: GlobalSearchEntry[] = keyword
		? friendStore.friends
				.filter((friend) => {
					const source = [
						friend.name,
						friend.remark,
						friend.uid,
						friend.email || '',
						friend.phone || '',
					]
						.join('|')
						.toLowerCase()
					return source.includes(keyword)
				})
				.slice(0, 8)
				.map((friend) => ({
					key: `friend-${friend.id}`,
					label: friend.remark || friend.name,
					description: `账号: ${friend.uid}`,
					typeLabel: '联系人' as const,
					icon: Person,
					keywords: [friend.name, friend.remark, friend.uid],
					action: async () => {
						showSearchModal.value = false
						friendStore.selectedFriendId = friend.id
						await router.push({ name: 'user' })
					},
				}))
		: []

	const chatRecordEntries: GlobalSearchEntry[] = keyword
		? globalChatMatchedRecords.value.map((record) => {
				const matchedMessage = record.message
				return {
					key: `chat-${record.chatId}-${matchedMessage.id}`,
					label: record.chatName,
					description:
						getMessageSearchText(matchedMessage) ||
						'进入会话查看聊天记录',
					typeLabel: '聊天' as const,
					icon: Chatbubbles,
					keywords: [
						record.chatName,
						getMessageSearchText(matchedMessage),
					],
					action: async () => {
						showSearchModal.value = false
						await router.push({ name: 'chat' })
						await chatStore.setActiveChat(record.chatId)
						chatStore.requestMessageJump({
							chatId: record.chatId,
							messageId: matchedMessage.id,
							serverMessageId: matchedMessage.serverMessageId,
							clientMessageId: matchedMessage.clientMessageId,
							keyword,
						})
					},
				}
			})
		: []

	return [
		...routeEntries,
		...slotEntries,
		...actionEntries,
		...contactEntries,
		...chatRecordEntries,
	]
})

const globalSearchQuickEntries = computed(() =>
	globalSearchEntries.value.slice(0, 6),
)

const filteredGlobalSearchEntries = computed(() => {
	const query = globalSearchQuery.value.trim().toLowerCase()
	if (!query) return globalSearchEntries.value
	return globalSearchEntries.value.filter((item) => {
		const source = [item.label, item.description, ...item.keywords]
			.join('|')
			.toLowerCase()
		return source.includes(query)
	})
})

const isWebSlotItem = (item: MenuItem): boolean => item.icon === 'web'

const isProfileCardSlotItem = (item: MenuItem): boolean =>
	item.slotKey === 'my-profile-card'

const isCloudDocSlotItem = (item: MenuItem): boolean =>
	item.icon === 'cloudDocs'

const getCollapsedSlotLabel = (item: MenuItem): string => {
	if (isWebSlotItem(item)) return '网页'
	if (isProfileCardSlotItem(item)) return '资料'
	if (isCloudDocSlotItem(item)) return '文档'
	return item.label || ''
}

const shouldShowSlotTooltip = (item: MenuItem): boolean => {
	if (!item.label) return false
	if (isWebSlotItem(item)) return item.label !== '网页'
	if (isProfileCardSlotItem(item)) return item.label !== '用户中心'
	if (isCloudDocSlotItem(item)) return true
	return false
}

const getMessageSearchText = (message: Message): string => {
	return (message.text || '').replace(/<[^>]*>/g, '').trim()
}

const scheduleGlobalChatSearch = (keyword: string): void => {
	if (globalChatSearchTimer) {
		clearTimeout(globalChatSearchTimer)
		globalChatSearchTimer = null
	}

	const trimmed = keyword.trim()
	if (!trimmed || !showSearchModal.value) {
		isSearchingGlobalChatRecords.value = false
		globalChatMatchedRecords.value = []
		return
	}

	globalChatSearchTimer = setTimeout(() => {
		globalChatSearchTimer = null
		void runGlobalChatSearch(trimmed)
	}, GLOBAL_CHAT_SEARCH_DEBOUNCE_MS)
}

const runGlobalChatSearch = async (keyword: string): Promise<void> => {
	const trimmed = keyword.trim()
	if (!trimmed) {
		isSearchingGlobalChatRecords.value = false
		globalChatMatchedRecords.value = []
		return
	}

	const seq = ++globalChatSearchSeq
	isSearchingGlobalChatRecords.value = true
	try {
		if (!chatlist.value.length) {
			await chatStore.init()
		}
		const rows = await chatStore.searchLocalMessagesGlobal(
			trimmed,
			GLOBAL_CHAT_SEARCH_CHAT_LIMIT,
		)

		if (seq !== globalChatSearchSeq) return
		const chatIdSet = new Set(chatlist.value.map((chat) => chat.id))
		globalChatMatchedRecords.value = rows
			.filter((item) => chatIdSet.has(item.chatId))
			.sort((a, b) => {
				const ta = new Date(
					a.message.sentAt || a.message.timestamp || '',
				).getTime()
				const tb = new Date(
					b.message.sentAt || b.message.timestamp || '',
				).getTime()
				return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
			})
	} finally {
		if (seq === globalChatSearchSeq) {
			isSearchingGlobalChatRecords.value = false
		}
	}
}

const openGlobalSearchModal = (): void => {
	showSearchModal.value = true
	void nextTick(() => {
		searchInputRef.value?.focus()
	})
}

const handleGlobalSearchEntryClick = (entry: GlobalSearchEntry): void => {
	void entry.action()
}

const handleSearchShortcut = (event: KeyboardEvent): void => {
	if (!(event.metaKey || event.ctrlKey)) return
	if (event.key.toLowerCase() !== 'k') return
	event.preventDefault()
	openGlobalSearchModal()
}

onMounted(() => {
	friendStore.startPendingRequestsAutoRefresh()

	// 添加全局点击监听器
	document.addEventListener('mousedown', handleGlobalClick)
	document.addEventListener('keydown', handleSearchShortcut)
})

onUnmounted(() => {
	friendStore.stopPendingRequestsAutoRefresh()

	// 移除全局监听器
	document.removeEventListener('mousedown', handleGlobalClick)
	document.removeEventListener('keydown', handleSearchShortcut)
	if (globalChatSearchTimer) {
		clearTimeout(globalChatSearchTimer)
		globalChatSearchTimer = null
	}
})

watch(
	() => user.signature,
	(value) => {
		if (!showUserDropdown.value) return
		signatureDraft.value = value || ''
	},
)

watch(
	() => showSearchModal.value,
	(show) => {
		if (show) {
			void nextTick(() => {
				searchInputRef.value?.focus()
			})
			scheduleGlobalChatSearch(globalSearchQuery.value)
			return
		}
		globalSearchQuery.value = ''
		globalChatMatchedRecords.value = []
		isSearchingGlobalChatRecords.value = false
	},
)

watch(
	() => globalSearchQuery.value,
	(value) => {
		scheduleGlobalChatSearch(value)
	},
)

watch(
	() => chatlist.value.length,
	() => {
		if (!showSearchModal.value || !globalSearchQuery.value.trim()) return
		scheduleGlobalChatSearch(globalSearchQuery.value)
	},
)

function go(item: MenuItem): void {
	if (item.type === 'route') {
		sidebarSlotStore.clearActiveSlot()
		if (item.name && route.name !== item.name) {
			router.push({ name: item.name })
		}
		return
	}
	if (item.slotKey) {
		inAppBrowserStore.handleSlotActivated(item.slotKey)
		sidebarSlotStore.activateSlot(item.slotKey)
	}
}

function destroySlot(slotKey: string): void {
	inAppBrowserStore.handleSlotRemoved(slotKey)
	sidebarSlotStore.removeSlot(slotKey)
}

function isMenuActive(item: MenuItem): boolean {
	if (item.type === 'slot') {
		return sidebarSlotStore.activeSlotKey === item.slotKey
	}
	if (sidebarSlotStore.activeSlotKey) return false
	if (item.name === 'cloudDocs' && route.name === 'cloudDocsEditor') {
		return true
	}
	return route.name === item.name
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

.main-sidebar.sidebar-dragging {
	transition: none;
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

.slot-separator {
	height: 1px;
	width: 82%;
	border-radius: 999px;
	background: rgba(148, 163, 184, 0.35);
	transform: scaleY(0.7);
	transform-origin: center;
}

.dark .slot-separator {
	background: rgba(148, 163, 184, 0.24);
}

.slot-scroll-wrapper {
	overflow-y: auto;
	scrollbar-width: none;
	-ms-overflow-style: none;
}

.slot-scroll-wrapper::-webkit-scrollbar {
	width: 0;
	height: 0;
	display: none;
}

.next-global-search-modal {
	border-radius: 8px !important;
	overflow: hidden;
	border: 1px solid rgba(0, 0, 0, 0.08);
}

.modal-header-section {
	padding: 12px 12px 14px;
	display: flex;
	flex-direction: column;
	background: linear-gradient(180deg, #3695ff 0%, #2f7fe7 100%);
}

.close-orb {
	width: 32px;
	height: 32px;
	border-radius: 10px;
	display: flex;
	align-items: center;
	justify-content: center;
}

:deep(.search-modal-input .n-input) {
	border-radius: 14px;
	border: 1px solid rgba(15, 23, 42, 0.08);
	background: rgba(255, 255, 255, 0.96);
}

:deep(.search-modal-input .n-input .n-input__input-el),
:deep(.search-modal-input .n-input .n-input__placeholder) {
	font-size: 13px;
}

:deep(.search-modal-input .n-input.n-input--focus) {
	border-color: rgba(54, 149, 255, 0.55);
	box-shadow: 0 0 0 2px rgba(54, 149, 255, 0.15);
}

:deep(.dark .search-modal-input .n-input) {
	border-color: rgba(63, 63, 70, 0.8);
	background: rgba(24, 24, 27, 0.98);
}

.search-entry-btn {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 10px 12px;
	text-align: left;
	border-radius: 12px;
	border: 1px solid rgba(148, 163, 184, 0.16);
	background: #f8fafc;
	transition: all 0.18s ease;
}

.search-entry-btn:hover {
	border-color: rgba(54, 149, 255, 0.35);
	background: rgba(54, 149, 255, 0.08);
}

.dark .search-entry-btn {
	border-color: rgba(63, 63, 70, 0.75);
	background: rgba(39, 39, 42, 0.62);
}

.dark .search-entry-btn:hover {
	border-color: rgba(96, 165, 250, 0.45);
	background: rgba(59, 130, 246, 0.18);
}

.search-entry-btn-result {
	gap: 12px;
	padding: 9px 12px;
}

.search-entry-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	flex-shrink: 0;
	border-radius: 10px;
	color: #2f7fe7;
	background: rgba(54, 149, 255, 0.12);
}

.search-shortcut-key {
	padding: 2px 6px;
	border-radius: 6px;
	background: #f1f5f9;
	color: #475569;
}

.dark .search-shortcut-key {
	background: #27272a;
	color: #a1a1aa;
}

.vip-fill-red {
	filter: brightness(0) saturate(100%) invert(23%) sepia(94%) saturate(7118%)
		hue-rotate(353deg) brightness(97%) contrast(111%);
}
</style>
