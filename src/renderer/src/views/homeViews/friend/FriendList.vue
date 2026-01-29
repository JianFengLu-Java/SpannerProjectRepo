<template>
	<div
		ref="containerRef"
		class="h-full w-full flex overflow-hidden rounded-[24px] bg-page-bg transition-all duration-300"
	>
		<!-- 左侧：分组联系人列表 (依赖容器宽度实现响应式) -->
		<div
			v-if="containerWidth >= 500"
			class="h-full flex flex-col border-r border-border-default shrink-0 overflow-hidden"
			:style="{ width: `${listWidth}px` }"
		>
			<!-- 顶部标题与功能 -->
			<div class="p-4 pb-2">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-lg font-bold text-text-main">联系人</h2>
					<div class="flex items-center gap-1">
						<n-tooltip trigger="hover">
							<template #trigger>
								<div
									class="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-200/50 cursor-pointer transition-colors"
									@click="showAddFriendModal = true"
								>
									<n-icon size="20" class="text-gray-500">
										<PersonAdd24Regular />
									</n-icon>
								</div>
							</template>
							添加好友
						</n-tooltip>
						<n-tooltip trigger="hover">
							<template #trigger>
								<div
									class="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-200/50 cursor-pointer transition-colors"
									@click="showAddGroupModal = true"
								>
									<n-icon size="20" class="text-gray-500">
										<FolderAdd24Regular />
									</n-icon>
								</div>
							</template>
							新建分组
						</n-tooltip>
					</div>
				</div>

				<!-- 搜索栏 -->
				<n-input
					v-model:value="searchQuery"
					placeholder="搜索联系人..."
					size="small"
					class="rounded-xl bg-gray-100/50 border-none"
				>
					<template #prefix>
						<n-icon class="text-gray-400">
							<Search24Regular />
						</n-icon>
					</template>
				</n-input>
			</div>

			<!-- 联系人列表内容 -->
			<div class="flex-1 overflow-y-auto custom-scrollbar p-2 pt-0">
				<div v-for="group in sortedGroups" :key="group.id" class="mb-1">
					<!-- 分组头部 -->
					<div
						class="group-header flex items-center gap-1 h-9 px-2 rounded-xl cursor-pointer hover:bg-black/5 transition-colors select-none"
						@click="friendStore.toggleGroupExpand(group.id)"
						@contextmenu.prevent="onGroupContextMenu($event, group)"
					>
						<n-icon
							size="14"
							class="text-gray-400 transition-transform duration-200"
							:class="{ 'rotate-90': group.expanded }"
						>
							<ChevronRight12Filled />
						</n-icon>
						<span
							class="text-xs font-semibold text-gray-500 flex-1 truncate"
						>
							{{ group.name }}
						</span>
						<span class="text-[10px] text-gray-400">
							{{ onlineCount(group.id) }}/{{
								(friendStore.groupedFriends[group.id] || [])
									.length
							}}
						</span>
					</div>

					<!-- 分组联系人列表 -->
					<div
						v-if="group.expanded"
						class="mt-0.5 space-y-0.5 overflow-hidden"
					>
						<div
							v-for="friend in filteredFriendsByGroup(group.id)"
							:key="friend.id"
							class="flex items-center gap-3 px-3 py-2 rounded-2xl cursor-copy transition-all duration-200 relative group"
							:class="[
								friendStore.selectedFriendId === friend.id
									? 'bg-primary/10'
									: 'hover:bg-black/5',
							]"
							@click="selectFriend(friend.id)"
						>
							<div class="relative shrink-0">
								<n-avatar
									round
									:size="34"
									:src="friend.avatar"
									:class="{
										'opacity-60 grayscale':
											friend.status === 'offline',
									}"
								/>
								<div
									class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
									:class="[
										friend.status === 'online'
											? 'bg-green-500'
											: 'bg-gray-400',
									]"
								></div>
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between">
									<span
										class="text-sm font-medium text-text-main truncate"
									>
										{{ friend.remark || friend.name }}
									</span>
								</div>
								<div
									class="text-[11px] text-gray-400 truncate pr-4"
								>
									{{ friend.signature || '[无签名]' }}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 右侧：详情展示区 -->
		<div class="flex-1 overflow-hidden relative flex flex-col bg-white">
			<Transition name="fade-scale" mode="out-in">
				<div
					v-if="friendStore.selectedFriend"
					:key="friendStore.selectedFriend.id"
					class="h-full flex flex-col items-center justify-center p-8 overflow-y-auto"
				>
					<div
						class="max-w-md w-full bg-white/60 backdrop-blur-md rounded-[32px] p-8 border border-white/40 flex flex-col items-center text-center"
					>
						<div class="relative mb-6">
							<n-avatar
								round
								:size="100"
								:src="friendStore.selectedFriend.avatar"
								class="border-4 border-white"
							/>
							<div
								class="absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-white"
								:class="[
									friendStore.selectedFriend.status ===
									'online'
										? 'bg-green-500'
										: 'bg-gray-400',
								]"
							></div>
						</div>

						<h3 class="text-2xl font-bold text-text-main mb-1">
							{{ friendStore.selectedFriend.name }}
						</h3>
						<p class="text-sm text-gray-500 mb-6">
							UID: {{ friendStore.selectedFriend.uid }}
						</p>

						<div class="w-full space-y-4 text-left mb-8">
							<div class="flex flex-col gap-1">
								<span
									class="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
									>备注</span
								>
								<div
									class="text-sm text-gray-700 bg-black/5 px-3 py-2 rounded-xl"
								>
									{{
										friendStore.selectedFriend.remark ||
										'无'
									}}
								</div>
							</div>
							<div class="flex flex-col gap-1">
								<span
									class="text-[11px] font-bold text-gray-400 uppercase tracking-wider"
									>个性签名</span
								>
								<div class="text-sm text-gray-600 italic">
									"{{
										friendStore.selectedFriend.signature ||
										'这个人很懒，什么都没有留下'
									}}"
								</div>
							</div>
						</div>

						<div class="flex gap-4 w-full">
							<n-button
								type="primary"
								class="flex-1 rounded-2xl h-12"
								@click="startChat(friendStore.selectedFriend!)"
							>
								<template #icon>
									<n-icon><Chat24Regular /></n-icon>
								</template>
								发消息
							</n-button>
							<n-dropdown
								placement="bottom-end"
								:options="friendActionOptions"
								@select="handleFriendAction"
							>
								<n-button
									quaternary
									class="rounded-2xl h-12 w-12 px-0"
								>
									<n-icon size="20"
										><MoreHorizontal24Regular
									/></n-icon>
								</n-button>
							</n-dropdown>
						</div>
					</div>
				</div>

				<div
					v-else
					class="h-full flex flex-col items-center justify-center opacity-30 select-none"
				>
					<n-icon size="120" class="mb-4 text-gray-300">
						<PeopleCommunity24Regular />
					</n-icon>
					<span class="text-lg text-gray-400"
						>选择一名联系人查看详情</span
					>
				</div>
			</Transition>
		</div>

		<!-- 分组右键菜单 -->
		<n-dropdown
			placement="bottom-start"
			trigger="manual"
			:x="contextMenuX"
			:y="contextMenuY"
			:options="groupContextMenuOptions"
			:show="showGroupContextMenu"
			:on-clickoutside="() => (showGroupContextMenu = false)"
			@select="handleGroupContextMenuAction"
		/>

		<!-- 新建分组弹窗 -->
		<n-modal
			v-model:show="showAddGroupModal"
			preset="dialog"
			title="新建分组"
			positive-text="确认"
			negative-text="取消"
			@positive-click="confirmAddGroup"
		>
			<n-input
				v-model:value="newGroupName"
				placeholder="请输入分组名称"
				class="rounded-xl"
			/>
		</n-modal>

		<!-- 修改分组弹窗 -->
		<n-modal
			v-model:show="showRenameGroupModal"
			preset="dialog"
			title="重命名分组"
			positive-text="确认"
			negative-text="取消"
			@positive-click="confirmRenameGroup"
		>
			<n-input
				v-model:value="renameGroupValue"
				placeholder="请输入新名称"
				class="rounded-xl"
			/>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, h } from 'vue'
import {
	Search24Regular,
	PersonAdd24Regular,
	FolderAdd24Regular,
	ChevronRight12Filled,
	Chat24Regular,
	MoreHorizontal24Regular,
	PeopleCommunity24Regular,
	Edit24Regular,
	Delete24Regular,
} from '@vicons/fluent'
import {
	NIcon,
	NInput,
	NAvatar,
	NTooltip,
	NButton,
	NDropdown,
	NModal,
	useMessage,
} from 'naive-ui'
import { useFriendStore, Friend, Group } from '@renderer/stores/friend'
import { useElementSize } from '@vueuse/core'

const friendStore = useFriendStore()
const message = useMessage()

const containerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)
const listWidth = ref(260)

const searchQuery = ref('')
const showAddFriendModal = ref(false)
const showAddGroupModal = ref(false)
const newGroupName = ref('')

// 分组排序逻辑：默认分组排第一，黑名单排最后
const sortedGroups = computed(() => {
	return [...friendStore.groups].sort((a, b) => {
		if (a.id === 'default') return -1
		if (b.id === 'default') return 1
		if (a.id === 'blacklist') return 1
		if (b.id === 'blacklist') return -1
		return a.name.localeCompare(b.name)
	})
})

const onlineCount = (groupId: string): number => {
	return (friendStore.groupedFriends[groupId] || []).filter(
		(f) => f.status === 'online',
	).length
}

const filteredFriendsByGroup = (groupId: string): Friend[] => {
	const groupFriends = friendStore.groupedFriends[groupId] || []
	if (!searchQuery.value) return groupFriends

	const query = searchQuery.value.toLowerCase()
	return groupFriends.filter(
		(f) =>
			f.name.toLowerCase().includes(query) ||
			f.remark?.toLowerCase().includes(query) ||
			f.uid.includes(query),
	)
}

const selectFriend = (id: string): void => {
	friendStore.selectedFriendId = id
}

const startChat = (friend: Friend): void => {
	window.electron.ipcRenderer.send(
		'open-chat-window',
		parseInt(friend.id),
		friend.name,
	)
}

// 分组右键菜单
const showGroupContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuGroup = ref<Group | null>(null)

const onGroupContextMenu = (e: MouseEvent, group: Group): void => {
	contextMenuGroup.value = group
	showGroupContextMenu.value = false
	nextTick(() => {
		showGroupContextMenu.value = true
		contextMenuX.value = e.clientX
		contextMenuY.value = e.clientY
	})
}

const groupContextMenuOptions = computed(() => {
	const isDefault = contextMenuGroup.value?.id === 'default'
	return [
		{
			label: '重命名',
			key: 'rename',
			icon: () => h(NIcon, null, { default: () => h(Edit24Regular) }),
		},
		{
			label: '删除分组',
			key: 'delete',
			disabled: isDefault,
			icon: () => h(NIcon, null, { default: () => h(Delete24Regular) }),
		},
	]
})

const showRenameGroupModal = ref(false)
const renameGroupValue = ref('')

const handleGroupContextMenuAction = (key: string): void => {
	if (!contextMenuGroup.value) return
	showGroupContextMenu.value = false

	if (key === 'rename') {
		renameGroupValue.value = contextMenuGroup.value.name
		showRenameGroupModal.value = true
	} else if (key === 'delete') {
		friendStore.deleteGroup(contextMenuGroup.value.id)
		message.success('分组已删除，成员已移动至默认分组')
	}
}

const confirmAddGroup = (): void => {
	if (newGroupName.value.trim()) {
		friendStore.addGroup(newGroupName.value.trim())
		newGroupName.value = ''
		message.success('添加成功')
	}
}

const confirmRenameGroup = (): void => {
	if (contextMenuGroup.value && renameGroupValue.value.trim()) {
		friendStore.renameGroup(
			contextMenuGroup.value.id,
			renameGroupValue.value.trim(),
		)
		message.success('修改成功')
	}
}

// 朋友详情页更多选项
const friendActionOptions = computed(() => {
	return [
		{ label: '修改备注', key: 'rename' },
		{ label: '移动分组', key: 'move' },
		{ label: '加入黑名单', key: 'block' },
		{ label: '删除好友', key: 'delete', text: true },
	]
})

const handleFriendAction = (key: string): void => {
	message.info(`功能开发中: ${key}`)
}
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
	width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
	background: rgba(0, 0, 0, 0.05);
	border-radius: 2px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
	background: rgba(0, 0, 0, 0.1);
}

.fade-scale-enter-active,
.fade-scale-leave-active {
	transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-scale-enter-from,
.fade-scale-leave-to {
	opacity: 0;
	transform: scale(0.95) translateY(10px);
}
</style>
