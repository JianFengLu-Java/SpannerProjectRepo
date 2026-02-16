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
					<div class="slot-scroll-wrapper w-full h-full flex flex-col gap-1">
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
							'absolute top-1 right-1 z-10 h-4 w-4 rounded-full bg-card-bg/92 border border-border-default/70 shadow-sm flex items-center justify-center text-[rgba(99,116,148,0.58)] dark:text-[rgba(165,176,198,0.64)] hover:text-sidebar-select-item transition-colors opacity-100',
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
			preset="card"
			class="global-search-modal"
			title="全局搜索"
			:show-icon="false"
			:mask-closable="true"
			transform-origin="center"
			style="width: 680px; max-width: calc(100vw - 24px)"
		>
			<div class="flex flex-col gap-4">
				<n-input
					ref="searchInputRef"
					v-model:value="globalSearchQuery"
					type="text"
					placeholder="搜索联系人、群组、聊天记录..."
					size="large"
					clearable
					class="rounded-[6px]"
				>
					<template #prefix>
						<n-icon><SearchOutline /></n-icon>
					</template>
					<template #suffix>
						<span
							class="text-[11px] text-gray-400 dark:text-gray-500"
						>
							{{ isMac ? '⌘K' : 'Ctrl+K' }}
						</span>
					</template>
				</n-input>

				<div class="search-content min-h-[240px]">
					<div
						v-if="!globalSearchQuery.trim()"
						class="space-y-3"
					>
						<div class="text-xs text-gray-400 dark:text-gray-500">
							快捷入口
						</div>
						<div class="grid grid-cols-3 gap-2.5">
							<button
								v-for="item in globalSearchQuickEntries"
								:key="item.key"
								type="button"
								class="flex items-center gap-2 rounded-[6px] border border-border-default bg-page-bg px-3 py-2.5 text-left hover:bg-sidebar-select-bg/30 transition-colors"
								@click="handleGlobalSearchEntryClick(item)"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#3695ff]/10 text-[#2f7fe7]"
								>
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
						<div
							class="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500"
						>
							<span>匹配结果 ({{ filteredGlobalSearchEntries.length }})</span>
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
								class="w-full flex items-center gap-3 rounded-[6px] border border-transparent bg-page-bg px-3 py-2 text-left hover:border-border-default hover:bg-sidebar-select-bg/25 transition-colors"
								@click="handleGlobalSearchEntryClick(item)"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-[#3695ff]/10 text-[#2f7fe7]"
								>
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
							class="flex h-[220px] flex-col items-center justify-center rounded-[6px] border border-dashed border-border-default text-center text-gray-400 dark:text-gray-500"
						>
							<n-icon size="28" class="mb-2 opacity-70">
								<SearchOutline />
							</n-icon>
							<p class="text-sm">没有匹配结果</p>
							<p class="text-xs">试试其他关键词，例如“动态”或“设置”</p>
						</div>
					</div>
				</div>

				<div class="flex items-center justify-between border-t border-border-default/70 pt-2 text-[11px] text-gray-400 dark:text-gray-500">
					<div class="flex items-center gap-3">
						<div
							class="flex items-center gap-1"
						>
							<span class="rounded-[4px] bg-page-bg px-1.5 py-0.5">Enter</span>
							<span>打开</span>
						</div>
						<div class="flex items-center gap-1">
							<span class="rounded-[4px] bg-page-bg px-1.5 py-0.5">Esc</span>
							<span>关闭</span>
						</div>
					</div>
					<div>
						当前可搜索 {{ globalSearchEntries.length }} 项
					</div>
				</div>
			</div>
		</n-modal>

		<n-modal
			v-model:show="showEditProfileModal"
			preset="card"
			title="编辑个人信息"
			:mask-closable="false"
			style="width: 560px"
		>
			<div class="mb-3 text-xs text-gray-500 dark:text-gray-300">
				字段失焦后自动保存，保存成功不提示。
			</div>
			<n-form label-placement="left" label-width="90">
				<n-form-item label="真实姓名">
					<div class="w-full flex items-center gap-2">
						<n-input
							v-model:value="editProfile.realName"
							placeholder="请输入真实姓名"
							@blur="saveField('realName')"
						/>
						<span
							v-if="savingField.realName"
							class="text-xs text-gray-400 shrink-0"
							>保存中...</span
						>
					</div>
				</n-form-item>
				<n-form-item label="头像地址">
					<div class="w-full flex items-center gap-3">
						<n-avatar
							:size="40"
							round
							:src="editProfile.avatarUrl || user.avatarUrl"
							class="shrink-0 border border-gray-200 dark:border-zinc-700"
						/>
						<n-button
							size="small"
							:loading="
								isAvatarUploading || savingField.avatarUrl
							"
							@click="triggerAvatarUpload"
						>
							上传头像
						</n-button>
						<span
							v-if="savingField.avatarUrl"
							class="text-xs text-gray-400 shrink-0"
							>保存中...</span
						>
					</div>
				</n-form-item>
				<n-form-item label="性别">
					<div class="w-full flex items-center gap-2">
						<n-select
							v-model:value="editProfile.gender"
							:options="genderOptions"
							placeholder="请选择"
							@update:value="saveField('gender')"
						/>
						<span
							v-if="savingField.gender"
							class="text-xs text-gray-400 shrink-0"
							>保存中...</span
						>
					</div>
				</n-form-item>
				<n-form-item label="邮箱">
					<div class="w-full flex items-center gap-2">
						<n-input
							v-model:value="editProfile.email"
							placeholder="a@b.com"
							@blur="saveField('email')"
						/>
						<span
							v-if="savingField.email"
							class="text-xs text-gray-400 shrink-0"
							>保存中...</span
						>
					</div>
				</n-form-item>
				<n-form-item label="手机号">
					<div class="w-full flex items-center gap-2">
						<n-input
							v-model:value="editProfile.phone"
							placeholder="13800138000"
							@blur="saveField('phone')"
						/>
						<span
							v-if="savingField.phone"
							class="text-xs text-gray-400 shrink-0"
							>保存中...</span
						>
					</div>
				</n-form-item>
				<n-form-item label="地址">
					<div class="w-full flex items-center gap-2">
						<n-input
							v-model:value="editProfile.address"
							placeholder="Shanghai"
							@blur="saveField('address')"
						/>
						<span
							v-if="savingField.address"
							class="text-xs text-gray-400 shrink-0"
							>保存中...</span
						>
					</div>
				</n-form-item>
				<n-form-item label="个性签名">
					<div class="w-full flex items-center gap-2">
						<n-input
							v-model:value="editProfile.signature"
							type="textarea"
							placeholder="请输入个性签名"
							autosize
							maxlength="80"
							show-count
							@blur="saveField('signature')"
						/>
						<span
							v-if="savingField.signature"
							class="text-xs text-gray-400 shrink-0"
							>保存中...</span
						>
					</div>
				</n-form-item>
				<n-form-item label="年龄">
					<div class="w-full flex items-center gap-2">
						<n-input-number
							v-model:value="editProfile.age"
							:min="0"
							placeholder="25"
							class="w-full"
							@blur="saveField('age')"
						/>
						<span
							v-if="savingField.age"
							class="text-xs text-gray-400 shrink-0"
							>保存中...</span
						>
					</div>
				</n-form-item>
			</n-form>
		</n-modal>

		<FriendApplyModal
			v-model:show="showAddFriendModal"
			@applied="handleFriendApplied"
		/>
		<AvatarUploadEditor
			ref="avatarUploadEditorRef"
			@uploaded="handleAvatarUploaded"
			@uploading-change="handleAvatarUploadingChange"
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
	NForm,
	NFormItem,
	NSelect,
	NInputNumber,
	NButton,
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
	SearchOutline as Search,
	Add,
	ApertureOutline,
	GlobeOutline,
	Close,
	WalletOutline,
} from '@vicons/ionicons5'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { Add16Filled } from '@vicons/fluent'
import FriendApplyModal from '@renderer/components/FriendApplyModal.vue'
import { useFriendStore } from '@renderer/stores/friend'
import { useChatStore, type Message } from '@renderer/stores/chat'
import { useSidebarSlotStore } from '@renderer/stores/sidebarSlot'
import { useInAppBrowserStore } from '@renderer/stores/inAppBrowser'
import { storeToRefs } from 'pinia'
import request from '@renderer/utils/request'
import AvatarUploadEditor from '@renderer/components/AvatarUploadEditor.vue'

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
const showUserDropdown = ref(false)
const showAddDropdown = ref(false)
const showEditProfileModal = ref(false)
const isAvatarUploading = ref(false)
const avatarUploadEditorRef = ref<{
	openFileDialog: () => void
} | null>(null)
const platfrom = window.api.platform
const isMac = platfrom === 'darwin'
const GLOBAL_CHAT_SEARCH_DEBOUNCE_MS = 260
const GLOBAL_CHAT_SEARCH_CHAT_LIMIT = 30
let globalChatSearchTimer: ReturnType<typeof setTimeout> | null = null
let globalChatSearchSeq = 0

type EditableField =
	| 'realName'
	| 'avatarUrl'
	| 'gender'
	| 'email'
	| 'phone'
	| 'address'
	| 'signature'
	| 'age'

interface EditableProfile {
	realName: string
	avatarUrl: string
	gender: string
	email: string
	phone: string
	address: string
	signature: string
	age: number | null
}

type EditableValue = string | number | null

const genderOptions = [
	{ label: '男', value: 'male' },
	{ label: '女', value: 'female' },
	{ label: '未知', value: 'unknown' },
]

const createEditableProfile = (): EditableProfile => ({
	realName: user.userName || '',
	avatarUrl: user.avatarUrl || '',
	gender: user.gender || 'unknown',
	email: user.email || '',
	phone: user.phone || '',
	address: user.address || '',
	signature: user.signature || '',
	age:
		typeof user.age === 'number' && Number.isFinite(user.age)
			? user.age
			: null,
})

const editProfile = ref<EditableProfile>(createEditableProfile())
const persistedProfile = ref<EditableProfile>(createEditableProfile())
const savingField = ref<Record<EditableField, boolean>>({
	realName: false,
	avatarUrl: false,
	gender: false,
	email: false,
	phone: false,
	address: false,
	signature: false,
	age: false,
})

const getProfileFieldValue = (
	profile: EditableProfile,
	field: EditableField,
): EditableValue => {
	switch (field) {
		case 'realName':
			return profile.realName
		case 'avatarUrl':
			return profile.avatarUrl
		case 'gender':
			return profile.gender
		case 'email':
			return profile.email
		case 'phone':
			return profile.phone
		case 'address':
			return profile.address
		case 'signature':
			return profile.signature
		case 'age':
			return profile.age
	}
}

const setProfileFieldValue = (
	profile: EditableProfile,
	field: EditableField,
	value: EditableValue,
): void => {
	switch (field) {
		case 'realName':
			profile.realName = String(value ?? '')
			return
		case 'avatarUrl':
			profile.avatarUrl = String(value ?? '')
			return
		case 'gender':
			profile.gender = String(value ?? 'unknown')
			return
		case 'email':
			profile.email = String(value ?? '')
			return
		case 'phone':
			profile.phone = String(value ?? '')
			return
		case 'address':
			profile.address = String(value ?? '')
			return
		case 'signature':
			profile.signature = String(value ?? '')
			return
		case 'age':
			profile.age =
				typeof value === 'number' && Number.isFinite(value)
					? value
					: null
			return
	}
}

const normalizeFieldValue = (
	field: EditableField,
	value: EditableValue,
): EditableValue => {
	if (field === 'age') {
		if (typeof value !== 'number' || !Number.isFinite(value)) return null
		return Math.max(0, Math.floor(value))
	}
	if (field === 'gender') {
		return value === 'male' || value === 'female' || value === 'unknown'
			? value
			: 'unknown'
	}
	if (field === 'signature') {
		const normalized = typeof value === 'string' ? value.trim() : ''
		return normalized.slice(0, 80)
	}
	return typeof value === 'string' ? value.trim() : value
}

const openEditProfile = (): void => {
	const snapshot = createEditableProfile()
	editProfile.value = { ...snapshot }
	persistedProfile.value = { ...snapshot }
	showEditProfileModal.value = true
}

const saveFieldValue = async (
	field: EditableField,
	nextValue: EditableValue,
): Promise<void> => {
	if (savingField.value[field]) return

	const normalizedValue = normalizeFieldValue(field, nextValue)
	const prevValue = getProfileFieldValue(persistedProfile.value, field)
	if (normalizedValue === prevValue) {
		setProfileFieldValue(editProfile.value, field, prevValue)
		return
	}

	if (
		field === 'email' &&
		typeof normalizedValue === 'string' &&
		normalizedValue
	) {
		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
		if (!emailPattern.test(normalizedValue)) {
			message.error('邮箱格式不正确')
			setProfileFieldValue(editProfile.value, field, prevValue)
			return
		}
	}

	savingField.value[field] = true
	setProfileFieldValue(editProfile.value, field, normalizedValue)

	try {
		const payload: Record<string, EditableValue> = {
			[field]: normalizedValue,
		}
		await request.put('/user/me', payload)
		setProfileFieldValue(persistedProfile.value, field, normalizedValue)
		if (field === 'age') {
			user.patchUserInfo({
				age:
					typeof normalizedValue === 'number' &&
					Number.isFinite(normalizedValue)
						? normalizedValue
						: null,
			})
		} else if (field === 'realName') {
			user.patchUserInfo({ realName: String(normalizedValue ?? '') })
		} else if (field === 'avatarUrl') {
			user.patchUserInfo({ avatarUrl: String(normalizedValue ?? '') })
		} else if (field === 'gender') {
			user.patchUserInfo({
				gender: String(normalizedValue ?? 'unknown'),
			})
		} else if (field === 'email') {
			user.patchUserInfo({ email: String(normalizedValue ?? '') })
		} else if (field === 'phone') {
			user.patchUserInfo({ phone: String(normalizedValue ?? '') })
		} else if (field === 'address') {
			user.patchUserInfo({ address: String(normalizedValue ?? '') })
		} else if (field === 'signature') {
			user.patchUserInfo({ signature: String(normalizedValue ?? '') })
		}
	} catch (error) {
		console.error(`更新字段 ${field} 失败`, error)
		setProfileFieldValue(editProfile.value, field, prevValue)
		message.error('保存失败，请稍后重试')
	} finally {
		savingField.value[field] = false
	}
}

const saveField = async (field: EditableField): Promise<void> => {
	await saveFieldValue(field, getProfileFieldValue(editProfile.value, field))
}

const triggerAvatarUpload = (): void => {
	avatarUploadEditorRef.value?.openFileDialog()
}

const handleAvatarUploaded = async (url: string): Promise<void> => {
	await saveFieldValue('avatarUrl', url)
}

const handleAvatarUploadingChange = (uploading: boolean): void => {
	isAvatarUploading.value = uploading
}

const signatureDraft = ref('')

const saveDropdownSignature = async (): Promise<void> => {
	await saveFieldValue('signature', signatureDraft.value)
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
							],
						),
						h(
							'div',
							{ class: 'text-xs text-gray-500' },
							user.email,
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
							savingField.value.signature
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
	{ label: '我的个人名片', key: 'my-card' },
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
			title: '我的名片',
			componentKey: 'profile-card',
			icon: 'user',
		})
		return
	}
	if (key === 'edit-profile') {
		showUserDropdown.value = false
		openEditProfile()
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
	moments: ApertureOutline,
	wallet: WalletOutline,
	setting: Settings,
	web: GlobeOutline,
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
		icon: iconMap[item.icon] || GlobeOutline,
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
				openEditProfile()
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
						keywords: [record.chatName, getMessageSearchText(matchedMessage)],
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

const getCollapsedSlotLabel = (item: MenuItem): string => {
	if (isWebSlotItem(item)) return '网页'
	if (isProfileCardSlotItem(item)) return '名片'
	return item.label || ''
}

const shouldShowSlotTooltip = (item: MenuItem): boolean => {
	if (!item.label) return false
	if (isWebSlotItem(item)) return item.label !== '网页'
	if (isProfileCardSlotItem(item)) return item.label !== '我的名片'
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

:deep(.global-search-modal .n-card) {
	border-radius: 6px;
	border: 1px solid rgba(148, 163, 184, 0.18);
}

:deep(.global-search-modal .n-card-header) {
	padding-bottom: 10px;
	border-bottom: 1px solid rgba(148, 163, 184, 0.18);
}

:deep(.global-search-modal .n-card__content) {
	padding-top: 14px;
}

:deep(.dark .global-search-modal .n-card) {
	border-color: rgba(82, 82, 91, 0.7);
}

:deep(.dark .global-search-modal .n-card-header) {
	border-bottom-color: rgba(82, 82, 91, 0.7);
}
</style>
