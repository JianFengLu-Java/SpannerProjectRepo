<template>
	<div
		ref="containerRef"
		class="h-full w-full flex overflow-hidden rounded-[24px] bg-page-bg transition-all duration-300"
	>
		<!-- 左侧：分组联系人列表 (依赖容器宽度实现响应式) -->
		<div
			v-if="containerWidth >= 500 || !friendStore.selectedFriendId"
			class="h-full flex flex-col border-r border-border-default shrink-0 overflow-hidden"
			:class="[containerWidth < 500 ? 'w-full border-r-0!' : '']"
			:style="{
				width: containerWidth >= 500 ? `${listWidth}px` : '100%',
			}"
		>
			<!-- 顶部标题与功能 -->
			<div class="p-4 pb-2">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-lg font-bold text-text-main">联系人</h2>
					<div class="flex items-center gap-1">
						<n-tooltip trigger="hover">
							<template #trigger>
								<div
									class="w-7 h-7 no-drag flex items-center justify-center rounded-xl hover:bg-gray-200/50 cursor-pointer transition-colors"
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
									class="w-7 h-7 no-drag flex items-center justify-center rounded-xl hover:bg-gray-200/50 cursor-pointer transition-colors"
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
		<div
			v-if="containerWidth >= 500 || friendStore.selectedFriendId"
			class="flex-1 overflow-hidden relative flex flex-col bg-gray-50/30"
		>
			<!-- 窄屏返回按钮 -->
			<div
				v-if="containerWidth < 500 && friendStore.selectedFriendId"
				class="absolute top-4 left-4 z-50"
			>
				<button
					class="w-8 h-8 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-full shadow-md text-gray-600 active:scale-90 transition-all"
					@click="friendStore.selectedFriendId = null"
				>
					<n-icon size="20"><ChevronLeft24Regular /></n-icon>
				</button>
			</div>
			<Transition name="fade-scale" mode="out-in">
				<div
					v-if="friendStore.selectedFriend"
					:key="friendStore.selectedFriend.id"
					class="h-full flex flex-col overflow-y-auto custom-scrollbar"
				>
					<!-- 联系人背景 Cover -->
					<div class="relative w-full h-48 shrink-0 overflow-hidden">
						<img
							:src="
								friendStore.selectedFriend.cover ||
								'https://api.dicebear.com/7.x/shapes/svg?seed=' +
									friendStore.selectedFriend.id
							"
							class="w-full h-full object-cover"
						/>
						<div
							class="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"
						></div>
					</div>

					<!-- 详情内容头部 (QQ 样式：头像与信息左右布局) -->
					<div
						class="w-full max-w-2xl px-8 flex items-end gap-6 mt-2 relative z-10 mx-auto"
					>
						<!-- 头像 -->
						<div class="relative group shrink-0">
							<n-avatar
								round
								:size="60"
								:src="friendStore.selectedFriend.avatar"
								class="border-[4px] border-white bg-white"
							/>
							<div
								class="absolute bottom-1 right-1 w-5 h-5 rounded-full border-[3px] border-white"
								:class="[
									friendStore.selectedFriend.status ===
									'online'
										? 'bg-green-500'
										: 'bg-gray-400',
								]"
							></div>
						</div>

						<!-- 基本信息 -->
						<div class="flex-1 pb-2">
							<div class="flex items-center gap-2 mb-1">
								<h3
									class="text-2xl font-bold text-text-main truncate max-w-[300px]"
								>
									{{ friendStore.selectedFriend.name }}
								</h3>
								<n-icon
									v-if="
										friendStore.selectedFriend.gender ===
										'male'
									"
									size="18"
									color="#0ea5e9"
								>
									<Male />
								</n-icon>
								<n-icon
									v-else-if="
										friendStore.selectedFriend.gender ===
										'female'
									"
									size="18"
									color="#f472b6"
								>
									<Female />
								</n-icon>
							</div>
							<div
								class="flex items-center gap-3 text-sm text-gray-500"
							>
								<span class="flex items-center gap-1">
									<span
										class="opacity-60 text-[10px] font-bold"
										>UID:</span
									>
									<span class="font-mono">{{
										friendStore.selectedFriend.uid
									}}</span>
								</span>
								<span
									class="w-1 h-1 bg-gray-300 rounded-full"
								></span>
								<span>{{
									friendStore.selectedFriend.region ||
									'未知地区'
								}}</span>
							</div>
						</div>
					</div>

					<div class="px-8 w-full max-w-2xl mx-auto flex-1 pb-12">
						<!-- 个性签名 (放在头部下方) -->
						<div class="mb-6 px-1">
							<p
								class="text-sm text-gray-500 line-clamp-2 italic"
							>
								"{{
									friendStore.selectedFriend.signature ||
									'这个人太神秘了，还没有个性签名。'
								}}"
							</p>
						</div>
						<!-- 操作栏 -->
						<div class="flex gap-3 w-full">
							<n-button
								type="primary"
								class="flex-1 rounded-2xl h-12 text-base font-semibold"
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
									secondary
									class="rounded-2xl h-12 w-12 px-0"
								>
									<n-icon size="20"
										><MoreHorizontal24Regular
									/></n-icon>
								</n-button>
							</n-dropdown>
						</div>
						<!-- 标签页 -->
						<div
							v-if="
								friendStore.selectedFriend.tags &&
								friendStore.selectedFriend.tags.length
							"
							class="bg-white/60 backdrop-blur-sm p-5 rounded-3xl border border-white/50"
						>
							<span
								class="text-[11px] font-bold text-gray-400 uppercase tracking-widest block mb-3"
								>个人标签</span
							>
							<div class="flex flex-wrap gap-2">
								<span
									v-for="tag in friendStore.selectedFriend
										.tags"
									:key="tag"
									class="px-3 py-1 bg-black/5 text-gray-600 text-[11px] font-medium rounded-full"
								>
									# {{ tag }}
								</span>
							</div>
						</div>
						<!-- 个人空间入口 (QQ 样式) -->
						<div
							class="mb-10 flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 transition-all cursor-pointer group"
							@click="message.info('正在进入个人空间...')"
						>
							<div class="flex items-center gap-3">
								<div
									class="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-blue-500 transition-transform"
								>
									<n-icon size="24"
										><ApertureOutline
									/></n-icon>
								</div>
								<div>
									<h4 class="text-sm font-bold text-blue-900">
										个人空间
									</h4>
									<p class="text-[11px] text-blue-600/70">
										查看相册、日志与动态
									</p>
								</div>
							</div>
							<n-icon
								class="text-blue-300 group-hover:translate-x-1 transition-transform"
							>
								<ChevronRight12Filled />
							</n-icon>
						</div>

						<!-- 属性列表 -->
						<div class="grid grid-cols-2 gap-4 mb-10">
							<div
								class="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50 flex items-center gap-3"
							>
								<div
									class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500"
								>
									<n-icon size="20"><Mail24Regular /></n-icon>
								</div>
								<div class="flex-1 min-w-0">
									<p
										class="text-[10px] text-gray-400 font-medium"
									>
										电子邮箱
									</p>
									<p
										class="text-sm text-gray-700 truncate font-medium"
									>
										{{
											friendStore.selectedFriend.email ||
											'未填'
										}}
									</p>
								</div>
							</div>

							<div
								class="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50 flex items-center gap-3"
							>
								<div
									class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500"
								>
									<n-icon size="20"
										><CalendarLtr24Regular
									/></n-icon>
								</div>
								<div class="flex-1 min-w-0">
									<p
										class="text-[10px] text-gray-400 font-medium"
									>
										年龄 / 生日
									</p>
									<p
										class="text-sm text-gray-700 truncate font-medium"
									>
										{{
											friendStore.selectedFriend.age
												? friendStore.selectedFriend
														.age + ' 岁'
												: '未知'
										}}
									</p>
								</div>
							</div>

							<div
								class="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50 flex items-center gap-3"
							>
								<div
									class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500"
								>
									<n-icon size="20"><Edit24Regular /></n-icon>
								</div>
								<div class="flex-1 min-w-0">
									<p
										class="text-[10px] text-gray-400 font-medium"
									>
										备注姓名
									</p>
									<p
										class="text-sm text-gray-700 truncate font-medium"
									>
										{{
											friendStore.selectedFriend.remark ||
											'无备注'
										}}
									</p>
								</div>
							</div>

							<div
								class="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50 flex items-center gap-3"
							>
								<div
									class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500"
								>
									<n-icon
										name="Tag24Regular"
										size="20"
										class="flex items-center justify-center"
									>
										<Tag24Regular />
									</n-icon>
								</div>
								<div class="flex-1 min-w-0">
									<p
										class="text-[10px] text-gray-400 font-medium"
									>
										所属分组
									</p>
									<p
										class="text-sm text-gray-700 truncate font-medium"
									>
										{{
											friendStore.groups.find(
												(g) =>
													g.id ===
													friendStore.selectedFriend
														?.groupId,
											)?.name || '未知分组'
										}}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div
					v-else
					class="h-full flex flex-col items-center justify-center opacity-30 select-none bg-white"
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
import { useRouter } from 'vue-router'
import {
	Search24Regular,
	PersonAdd24Regular,
	FolderAdd24Regular,
	ChevronRight12Filled,
	ChevronLeft24Regular,
	Chat24Regular,
	MoreHorizontal24Regular,
	PeopleCommunity24Regular,
	Edit24Regular,
	Delete24Regular,
	Mail24Regular,
	Tag24Regular,
	CalendarLtr24Regular,
} from '@vicons/fluent'
import { Male, Female, ApertureOutline } from '@vicons/ionicons5'
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
import { useChatStore } from '@renderer/stores/chat'
import { useElementSize } from '@vueuse/core'

const friendStore = useFriendStore()
const chatStore = useChatStore()
const message = useMessage()
const router = useRouter()

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

const startChat = async (friend: Friend): Promise<void> => {
	const chatId = await chatStore.getOrCreateChat(friend)
	await chatStore.setActiveChat(chatId)
	router.push({ name: 'chat' })
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
	width: 0px;
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
