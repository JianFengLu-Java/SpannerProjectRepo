<template>
	<div
		ref="containerRef"
		class="h-full w-full flex overflow-hidden bg-page-bg transition-all duration-300"
	>
		<!-- 左侧：分组联系人列表 (依赖容器宽度实现响应式) -->
		<div
			v-if="shouldShowListPanel"
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
									class="w-7 h-7 no-drag flex items-center justify-center rounded-[6px] hover:bg-gray-200/50 dark:hover:bg-zinc-700/40 cursor-pointer transition-colors"
									@click="openPendingRequestsModal"
								>
									<n-badge
										:dot="
											friendStore.pendingRequests.length >
											0
										"
									>
										<n-icon
											size="20"
											class="text-gray-500 dark:text-gray-300"
										>
											<Mail24Regular />
										</n-icon>
									</n-badge>
								</div>
							</template>
							好友申请
						</n-tooltip>
						<n-tooltip trigger="hover">
							<template #trigger>
								<div
									class="w-7 h-7 no-drag flex items-center justify-center rounded-[6px] hover:bg-gray-200/50 dark:hover:bg-zinc-700/40 cursor-pointer transition-colors"
									@click="showAddFriendModal = true"
								>
									<n-icon
										size="20"
										class="text-gray-500 dark:text-gray-300"
									>
										<PersonAdd24Regular />
									</n-icon>
								</div>
							</template>
							添加好友
						</n-tooltip>
						<n-tooltip trigger="hover">
							<template #trigger>
								<div
									class="w-7 h-7 no-drag flex items-center justify-center rounded-[6px] hover:bg-gray-200/50 dark:hover:bg-zinc-700/40 cursor-pointer transition-colors"
									@click="showAddGroupModal = true"
								>
									<n-icon
										size="20"
										class="text-gray-500 dark:text-gray-300"
									>
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
					class="rounded-[6px] bg-gray-100/50 dark:bg-zinc-800/60 border-none"
				>
					<template #prefix>
						<n-icon class="text-gray-400 dark:text-gray-500">
							<Search24Regular />
						</n-icon>
					</template>
				</n-input>

				<div class="mt-2 grid grid-cols-2 gap-1 rounded-[6px] bg-black/5 p-1 dark:bg-white/5">
					<button
						type="button"
						class="h-7 rounded-[6px] text-xs font-semibold transition-colors"
						:class="
							contactModule === 'friends'
								? 'bg-card-bg text-text-main'
								: 'text-gray-500 hover:text-text-main'
						"
						@click="switchContactModule('friends')"
					>
						好友
					</button>
					<button
						type="button"
						class="h-7 rounded-[6px] text-xs font-semibold transition-colors"
						:class="
							contactModule === 'groups'
								? 'bg-card-bg text-text-main'
								: 'text-gray-500 hover:text-text-main'
						"
						@click="switchContactModule('groups')"
					>
						群组
					</button>
				</div>
			</div>

			<!-- 联系人列表内容 -->
			<div class="flex-1 overflow-y-auto custom-scrollbar p-2 pt-0">
				<template v-if="contactModule === 'friends'">
					<div
						v-if="
							friendStore.isLoading &&
							!isInitializingFriends &&
							!friendStore.friends.length
						"
						class="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500"
					>
						加载好友列表中...
					</div>
					<div
						v-else-if="
							!isInitializingFriends && !friendStore.friends.length
						"
						class="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500"
					>
						暂无好友，点击右上角添加
					</div>
					<div
						v-for="group in sortedGroups"
						v-else
						:key="group.id"
						class="mb-1"
					>
						<div
							class="group-header flex items-center gap-1 h-9 px-2 rounded-[6px] cursor-pointer hover:bg-black/5 dark:hover:bg-white/6 transition-colors select-none"
							@click="friendStore.toggleGroupExpand(group.id)"
							@contextmenu.prevent="onGroupContextMenu($event, group)"
						>
							<n-icon
								size="14"
								class="text-gray-400 dark:text-gray-500 transition-transform duration-200"
								:class="{ 'rotate-90': group.expanded }"
							>
								<ChevronRight12Filled />
							</n-icon>
							<span class="text-xs font-semibold text-gray-500 dark:text-gray-300 flex-1 truncate">
								{{ group.name }}
							</span>
							<span class="text-[10px] text-gray-400 dark:text-gray-500">
								{{ onlineCount(group.id) }}/{{ (friendStore.groupedFriends[group.id] || []).length }}
							</span>
						</div>

						<div v-if="group.expanded" class="mt-0.5 space-y-0.5 overflow-hidden">
							<div
								v-for="friend in filteredFriendsByGroup(group.id)"
								:key="friend.id"
								class="flex items-center gap-3 px-3 py-2 rounded-[6px] cursor-copy transition-all duration-200 relative group"
								:class="[
									friendStore.selectedFriendId === friend.id
										? 'bg-primary/10'
										: 'hover:bg-black/5 dark:hover:bg-white/6',
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
										class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-700"
										:class="[
											friend.status === 'online'
												? 'bg-blue-500'
												: 'bg-gray-400',
										]"
									></div>
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between">
											<div class="min-w-0 flex items-center gap-1">
												<span
													class="text-sm font-medium truncate"
													:class="
														friend.isVip
															? 'text-red-500'
															: 'text-text-main'
													"
												>
													{{ friend.remark || friend.name }}
												</span>
													<img
														v-if="friend.isVip"
														:src="vipBadgeIcon"
														alt="VIP"
														class="h-4 w-4 block vip-fill-red"
													/>
											</div>
									</div>
									<div class="text-[11px] text-gray-400 dark:text-gray-500 truncate pr-4">
										{{ friend.signature || '[无签名]' }}
									</div>
								</div>
							</div>
						</div>
					</div>
				</template>

				<template v-else>
					<div
						v-if="isLoadingGroupChats && !filteredGroupChats.length"
						class="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500"
					>
						加载群组中...
					</div>
					<div
						v-else-if="!filteredGroupChats.length"
						class="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500"
					>
						暂无群组
					</div>
					<div v-else class="space-y-1 pt-1">
						<div
							v-for="groupChat in filteredGroupChats"
							:key="groupChat.groupNo"
							class="flex items-center gap-3 px-3 py-2 rounded-[6px] cursor-pointer transition-all duration-200"
							:class="
								selectedGroupNo === groupChat.groupNo
									? 'bg-primary/10'
									: 'hover:bg-black/5 dark:hover:bg-white/6'
							"
							@click="selectGroupChat(groupChat.groupNo)"
						>
							<n-avatar round :size="34" :src="groupChat.avatar" />
							<div class="min-w-0 flex-1">
								<div class="text-sm font-medium text-text-main truncate">
									{{ groupChat.name }}
								</div>
								<div class="text-[11px] text-gray-400 truncate">
									群号: {{ groupChat.groupNo || '-' }}
								</div>
							</div>
							<n-tag size="small" :bordered="false">
								{{ groupChat.memberCount || 0 }}人
							</n-tag>
						</div>
					</div>
				</template>
			</div>
		</div>

		<!-- 右侧：详情展示区 -->
		<div
			v-if="shouldShowDetailPanel"
			class="flex-1 overflow-hidden relative flex flex-col bg-page-bg"
		>
			<div
				class="pointer-events-none absolute inset-0 hidden dark:block bg-black/30"
			></div>
			<!-- 窄屏返回按钮 -->
			<div
				v-if="containerWidth < 500 && (friendStore.selectedFriendId || selectedGroupNo)"
				class="absolute top-3 left-3 z-50"
			>
				<button
					class="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-zinc-800/85 border border-black/5 dark:border-zinc-700/80 backdrop-blur-md rounded-full text-gray-600 dark:text-gray-100 active:scale-90 transition-all"
					@click="handleMobileBack"
				>
					<n-icon size="20"><ChevronLeft24Regular /></n-icon>
				</button>
			</div>
			<Transition v-if="contactModule === 'friends'" name="fade-detail" mode="out-in">
				<div
					v-if="selectedFriendDetailModel"
					:key="selectedFriendDetailModel.id"
					class="h-full overflow-y-auto custom-scrollbar"
				>
					<FriendDetailPage
						embedded
						:friend-data="selectedFriendDetailModel"
						@message="handleFriendDetailMessage"
						@delete-friend="handleFriendDetailDelete"
					/>
				</div>

				<div
					v-else
					class="h-full flex items-center justify-center select-none px-6"
				>
					<div
						class="flex flex-col items-center justify-center rounded-[6px] px-8 py-10"
					>
						<n-icon size="108" class="mb-3 text-gray-300">
							<PeopleCommunity24Regular />
						</n-icon>
						<span class="text-base font-medium text-text-main">
							选择一名联系人查看详情
						</span>
					</div>
				</div>
			</Transition>

			<Transition v-else name="fade-detail" mode="out-in">
				<div
					v-if="selectedGroupChat"
					:key="String(selectedGroupChat.groupNo)"
					class="h-full overflow-y-auto custom-scrollbar"
				>
					<div class="relative isolate px-4 pb-6 pt-4">
						<div class="mx-auto w-full max-w-3xl space-y-3">
							<section class="rounded-[6px] border border-border-default bg-card-bg p-4">
								<div class="flex items-start gap-3">
									<n-avatar round :size="56" :src="selectedGroupChat.avatar" />
									<div class="min-w-0 flex-1">
										<h3 class="truncate text-lg font-semibold text-text-main">
											{{ selectedGroupChat.name }}
										</h3>
										<p class="mt-1 text-xs text-gray-400">
											群号：{{ selectedGroupChat.groupNo || '-' }}
										</p>
										<div class="mt-2 flex flex-wrap gap-2">
											<n-tag size="small" :bordered="false">
												{{ selectedGroupChat.memberCount || 0 }}/{{ selectedGroupChat.maxMembers || 500 }} 人
											</n-tag>
											<n-tag size="small" :bordered="false" type="info">
												{{ selectedGroupChat.myRole || 'MEMBER' }}
											</n-tag>
										</div>
									</div>
								</div>
								<div class="mt-3 rounded-[6px] border border-border-default bg-page-bg p-3 text-xs text-gray-500">
									{{ selectedGroupChat.announcement?.trim() || '暂无群公告' }}
								</div>
								<div class="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
									<div class="rounded-[6px] border border-border-default bg-page-bg px-3 py-2">
										邀请权限：{{
											selectedGroupChat.inviteMode === 'ALL'
												? '所有成员可邀请'
												: selectedGroupChat.inviteMode === 'ADMIN_ONLY'
													? '仅管理员可邀请'
													: '-'
										}}
									</div>
									<div class="rounded-[6px] border border-border-default bg-page-bg px-3 py-2">
										入群验证：{{
											selectedGroupChat.joinVerificationEnabled === true
												? '开启'
												: selectedGroupChat.joinVerificationEnabled === false
													? '关闭'
													: '-'
										}}
									</div>
									<div class="rounded-[6px] border border-border-default bg-page-bg px-3 py-2">
										公告权限：{{
											selectedGroupChat.announcementPermission === 'OWNER_ONLY'
												? '仅群主'
												: selectedGroupChat.announcementPermission === 'OWNER_ADMIN'
													? '群主/管理员'
													: '-'
										}}
									</div>
									<div class="rounded-[6px] border border-border-default bg-page-bg px-3 py-2">
										群主账号：{{ selectedGroupChat.ownerAccount || '-' }}
									</div>
								</div>
								<div class="mt-3 text-[11px] text-gray-400">
									创建：{{ formatDateTime(selectedGroupChat.createdAt) }} · 更新：{{ formatDateTime(selectedGroupChat.updatedAt) }}
								</div>
								<div class="mt-3 flex gap-2">
									<n-button type="primary" @click="openSelectedGroupChat">
										进入群聊
									</n-button>
									<n-button secondary @click="copySelectedGroupNo">
										复制群号
									</n-button>
								</div>
							</section>
						</div>
					</div>
				</div>
				<div v-else class="h-full flex items-center justify-center select-none px-6">
					<div class="flex flex-col items-center justify-center rounded-[6px] px-8 py-10">
						<n-icon size="108" class="mb-3 text-gray-300">
							<PeopleCommunity24Regular />
						</n-icon>
						<span class="text-base font-medium text-text-main">
							选择一个群组查看详情
						</span>
					</div>
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
				class="app-modal-dialog"
				title="新建分组"
			:mask-closable="false"
			positive-text="确认"
			negative-text="取消"
			@positive-click="confirmAddGroup"
		>
			<n-input
				v-model:value="newGroupName"
				placeholder="请输入分组名称"
				class="rounded-[6px]"
			/>
		</n-modal>

		<!-- 修改分组弹窗 -->
			<n-modal
				v-model:show="showRenameGroupModal"
				preset="dialog"
				class="app-modal-dialog"
				title="重命名分组"
			:mask-closable="false"
			positive-text="确认"
			negative-text="取消"
			@positive-click="confirmRenameGroup"
		>
			<n-input
				v-model:value="renameGroupValue"
				placeholder="请输入新名称"
				class="rounded-[6px]"
			/>
		</n-modal>

			<n-modal
				v-model:show="showRemarkModal"
				preset="dialog"
				class="app-modal-dialog"
				title="修改备注"
			:mask-closable="false"
			positive-text="确认"
			negative-text="取消"
			@positive-click="confirmRemarkUpdate"
		>
			<n-input
				v-model:value="remarkValue"
				placeholder="请输入备注（留空为清空备注）"
				maxlength="30"
				show-count
				class="rounded-[6px]"
			/>
		</n-modal>

			<n-modal
				v-model:show="showMoveGroupModal"
				preset="dialog"
				class="app-modal-dialog"
				title="移动分组"
			:mask-closable="false"
			positive-text="确认"
			negative-text="取消"
			@positive-click="confirmMoveGroup"
		>
			<n-select
				v-model:value="moveTargetGroupId"
				:options="moveGroupOptions"
				placeholder="请选择分组"
			/>
		</n-modal>

		<n-modal
			v-model:show="showPendingRequestsModal"
			preset="card"
			class="app-modal-card"
			title="好友申请"
			:mask-closable="false"
			:bordered="false"
			style="width: 520px; border-radius: 6px"
		>
			<n-tabs
				v-model:value="requestModalTab"
				type="line"
				animated
				class="min-h-[360px]"
			>
				<n-tab-pane name="pending" tab="待处理">
					<div
						v-if="friendStore.isPendingLoading"
						class="py-8 text-center text-sm text-gray-400 dark:text-gray-500"
					>
						加载好友申请中...
					</div>
					<div
						v-else-if="!friendStore.pendingRequests.length"
						class="py-8 text-center text-sm text-gray-400 dark:text-gray-500"
					>
						暂无待处理申请
					</div>
					<div
						v-else
						class="max-h-[380px] space-y-2 overflow-y-auto pr-1"
					>
						<div
							v-for="request in friendStore.pendingRequests"
							:key="request.account"
							class="rounded-[6px] border border-border-default/70 bg-white/90 dark:border-zinc-700/80 dark:bg-zinc-900/85 p-3"
						>
							<div class="flex items-center gap-3">
								<n-avatar
									round
									:size="36"
									:src="request.avatarUrl"
								/>
								<div class="min-w-0 flex-1">
									<div class="flex min-w-0 items-center gap-1">
										<div
											class="truncate text-sm font-semibold"
											:class="
												request.isVip
													? 'text-red-500'
													: 'text-text-main'
											"
										>
											{{ request.realName }}
										</div>
										<img
											v-if="request.isVip"
											:src="vipBadgeIcon"
											alt="VIP"
											class="h-4 w-4 block vip-fill-red"
										/>
									</div>
									<div
										class="truncate text-xs text-gray-400 dark:text-gray-500"
									>
										账号: {{ request.account }}
									</div>
								</div>
								<n-tag size="small" round :bordered="false">
									待处理
								</n-tag>
							</div>
							<div
								class="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-300"
							>
								{{
									request.verificationMessage ||
									'对方未填写验证信息'
								}}
							</div>
							<div
								class="mt-1 text-[11px] text-gray-400 dark:text-gray-500"
							>
								申请时间:
								{{ formatDateTime(request.createTime) }}
							</div>
							<div class="mt-3 flex justify-end gap-2">
								<n-button
									size="small"
									secondary
									:loading="
										actionLoadingAccount ===
											request.account &&
										actionType === 'reject'
									"
									@click="
										handlePendingRequestAction(
											'reject',
											request,
										)
									"
								>
									拒绝
								</n-button>
								<n-button
									size="small"
									type="primary"
									:loading="
										actionLoadingAccount ===
											request.account &&
										actionType === 'accept'
									"
									@click="
										handlePendingRequestAction(
											'accept',
											request,
										)
									"
								>
									同意
								</n-button>
							</div>
						</div>
					</div>
				</n-tab-pane>

				<n-tab-pane name="history" tab="历史记录">
					<div class="mb-3 flex items-center gap-2">
						<n-select
							v-model:value="historyStatusFilter"
							:options="historyStatusOptions"
							size="small"
							class="w-32"
						/>
						<n-input
							v-model:value="historyKeyword"
							size="small"
							clearable
							placeholder="搜索账号/昵称"
						/>
						<n-button
							size="small"
							type="primary"
							:loading="friendStore.isRequestHistoryLoading"
							@click="reloadHistory"
						>
							查询
						</n-button>
					</div>
					<div
						v-if="
							friendStore.isRequestHistoryLoading &&
							!requestHistoryRecords.length
						"
						class="py-8 text-center text-sm text-gray-400 dark:text-gray-500"
					>
						加载历史记录中...
					</div>
					<div
						v-else-if="!requestHistoryRecords.length"
						class="py-8 text-center text-sm text-gray-400 dark:text-gray-500"
					>
						暂无历史记录
					</div>
					<div
						v-else
						class="max-h-[380px] space-y-2 overflow-y-auto pr-1"
					>
						<div
							v-for="record in requestHistoryRecords"
							:key="record.uniqueKey"
							class="rounded-[6px] border border-border-default/70 bg-white/90 dark:border-zinc-700/80 dark:bg-zinc-900/85 p-3"
						>
							<div class="flex items-center gap-3">
								<n-avatar
									round
									:size="34"
									:src="record.avatarUrl"
								/>
								<div class="min-w-0 flex-1">
									<div class="flex min-w-0 items-center gap-1">
										<div
											class="truncate text-sm font-semibold"
											:class="
												record.isVip
													? 'text-red-500'
													: 'text-text-main'
											"
										>
											{{ record.realName }}
										</div>
										<img
											v-if="record.isVip"
											:src="vipBadgeIcon"
											alt="VIP"
											class="h-4 w-4 block vip-fill-red"
										/>
									</div>
									<div
										class="truncate text-xs text-gray-400 dark:text-gray-500"
									>
										账号: {{ record.account }}
									</div>
								</div>
								<n-tag
									size="small"
									round
									:bordered="false"
									:type="requestStatusTagType(record.status)"
								>
									{{ requestStatusText(record.status) }}
								</n-tag>
							</div>
							<div
								class="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-300"
							>
								{{
									record.verificationMessage ||
									'对方未填写验证信息'
								}}
							</div>
							<div
								class="mt-1 text-[11px] text-gray-400 dark:text-gray-500"
							>
								申请时间:
								{{ formatDateTime(record.createdTime) }}
							</div>
							<div
								class="mt-1 text-[11px] text-gray-400 dark:text-gray-500"
							>
								更新时间:
								{{ formatDateTime(record.updateTime) }}
							</div>
						</div>
					</div>
					<div class="mt-3 flex justify-center">
						<n-button
							v-if="historyHasMore"
							size="small"
							quaternary
							:loading="friendStore.isRequestHistoryLoading"
							@click="loadMoreHistory"
						>
							加载更多
						</n-button>
					</div>
				</n-tab-pane>
			</n-tabs>
		</n-modal>

		<FriendApplyModal
			v-model:show="showAddFriendModal"
			@applied="handleFriendApplied"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, h, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
	Search24Regular,
	PersonAdd24Regular,
	FolderAdd24Regular,
	ChevronRight12Filled,
	ChevronLeft24Regular,
	PeopleCommunity24Regular,
	Edit24Regular,
	Delete24Regular,
	Mail24Regular,
} from '@vicons/fluent'
import vipBadgeIcon from '@renderer/assets/VIP.svg'
import {
	NIcon,
	NInput,
	NAvatar,
	NTooltip,
	NButton,
	NDropdown,
	NModal,
	NBadge,
	NTag,
	NTabs,
	NTabPane,
	NSelect,
	useMessage,
} from 'naive-ui'
import {
	useFriendStore,
	Friend,
	Group,
	PendingFriendRequest,
	FriendRequestStatus,
	FriendRequestHistoryItem,
} from '@renderer/stores/friend'
import { useChatStore, type ChatItem } from '@renderer/stores/chat'
import { useElementSize } from '@vueuse/core'
import FriendApplyModal from '@renderer/components/FriendApplyModal.vue'
import FriendDetailPage from '@renderer/views/homeViews/friend/FriendDetailPage.vue'
import type { FriendModel } from '@renderer/views/homeViews/friend/friendDetail.types'
import {
	groupChatApi,
	type GroupRole,
} from '@renderer/services/groupChatApi'

const friendStore = useFriendStore()
const chatStore = useChatStore()
const message = useMessage()
const router = useRouter()

const containerRef = ref<HTMLElement | null>(null)
const { width: containerWidth } = useElementSize(containerRef)
const listWidth = ref(260)

const searchQuery = ref('')
const contactModule = ref<'friends' | 'groups'>('friends')
interface GroupContactItem {
	id: number
	groupNo: string
	name: string
	avatar: string
	memberCount?: number
	maxMembers?: number
	myRole?: GroupRole
	announcement?: string
	inviteMode?: string
	joinVerificationEnabled?: boolean
	announcementPermission?: string
	ownerAccount?: string
	createdAt?: string
	updatedAt?: string
}

const selectedGroupNo = ref<string | null>(null)
const joinedGroupChats = ref<GroupContactItem[]>([])
const isLoadingGroupChats = ref(false)
const showAddFriendModal = ref(false)
const showAddGroupModal = ref(false)
const showPendingRequestsModal = ref(false)
const isInitializingFriends = ref(true)
const requestModalTab = ref<'pending' | 'history'>('pending')
const newGroupName = ref('')
const actionLoadingAccount = ref('')
const actionType = ref<'accept' | 'reject' | ''>('')

type RequestStatusFilter = FriendRequestStatus | 'ALL'

interface RequestHistoryRecord {
	uniqueKey: string
	requestId: string
	account: string
	realName: string
	avatarUrl: string
	isVip?: boolean
	verificationMessage?: string | null
	direction: 'INBOUND' | 'OUTBOUND'
	status: FriendRequestStatus
	createdTime: string
	updateTime: string
}

const requestHistoryRecords = ref<RequestHistoryRecord[]>([])
const historyStatusFilter = ref<RequestStatusFilter>('ALL')
const historyKeyword = ref('')
const historyStatusOptions = [
	{ label: '全部状态', value: 'ALL' },
	{ label: '待处理', value: 'PENDING' },
	{ label: '已同意', value: 'ACCEPTED' },
	{ label: '已拒绝', value: 'REJECTED' },
	{ label: '已取消', value: 'CANCELED' },
	{ label: '已过期', value: 'EXPIRED' },
]

const loadFriends = async ({
	silent = false,
}: {
	silent?: boolean
} = {}): Promise<void> => {
	const [friendsOk, pendingOk] = await Promise.all([
		friendStore.fetchFriends(),
		friendStore.fetchPendingRequests(),
	])
	if (!silent && !friendsOk) {
		message.error('好友列表加载失败，请稍后重试')
	}
	if (!silent && !pendingOk) {
		message.error('好友请求加载失败，请稍后重试')
	}
}

onMounted(() => {
	void loadFriends({ silent: true }).finally(() => {
		isInitializingFriends.value = false
	})
})

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

const hashToPositiveInt = (seed: string): number => {
	let hash = 2166136261
	for (let i = 0; i < seed.length; i += 1) {
		hash ^= seed.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0) % 1000000000 + 1000000000
}

const deriveGroupChatId = (groupNo: string): number => {
	const normalized = groupNo.trim()
	const numeric = Number(normalized)
	if (Number.isFinite(numeric) && numeric > 0) {
		return -Math.floor(numeric)
	}
	return -hashToPositiveInt(`group:${normalized}`)
}

const parseSafePositiveInt = (value: unknown): number | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return Math.max(0, Math.floor(value))
	}
	if (typeof value === 'string') {
		const parsed = Number(value)
		if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed))
	}
	return undefined
}

const loadJoinedGroups = async (): Promise<void> => {
	isLoadingGroupChats.value = true
	try {
		const localGroupMap = new Map<string, ChatItem>(
			chatStore.chatlist
				.filter((item) => item.chatType === 'GROUP')
				.map((item) => [item.groupNo?.trim() || '', item]),
		)
		const pageSize = 100
		const maxPages = 50
		let page = 1
		let hasMore = true
		const mergedMap = new Map<string, GroupContactItem>()
		while (hasMore && page <= maxPages) {
			const response = await groupChatApi.getJoinedGroups({
				page,
				size: pageSize,
			})
			const payload = response.data?.data
			const records = Array.isArray(payload?.records)
				? payload.records
				: Array.isArray(payload?.list)
					? payload.list
					: []
			for (const record of records) {
				const groupNo = (record?.groupNo || '').trim()
				if (!groupNo) continue
				const local = localGroupMap.get(groupNo)
				const remoteAvatar =
					(record?.groupAvatarUrl || record?.avatarUrl || record?.avatar || '').trim()
				const remoteMemberCount = parseSafePositiveInt(record?.memberCount)
				const remoteMaxMembers = parseSafePositiveInt(record?.maxMembers)
				const remoteRole =
					typeof record?.myRole === 'string' ? record.myRole : undefined
				const remoteSummary =
					typeof record?.summary === 'string'
						? record.summary
						: typeof record?.announcement === 'string'
							? record.announcement
							: undefined
				mergedMap.set(groupNo, {
					id: local?.id ?? deriveGroupChatId(groupNo),
					groupNo,
					name: (record?.groupName || '').trim() || local?.name || `群聊 ${groupNo}`,
					avatar: remoteAvatar || local?.avatar || '',
					memberCount: remoteMemberCount ?? local?.memberCount,
					maxMembers: remoteMaxMembers ?? local?.maxMembers,
					myRole: (remoteRole as GroupRole | undefined) || local?.myRole,
					announcement: remoteSummary || local?.announcement,
					inviteMode:
						typeof record?.inviteMode === 'string'
							? record.inviteMode
							: undefined,
					joinVerificationEnabled:
						typeof record?.joinVerificationEnabled === 'boolean'
							? record.joinVerificationEnabled
							: undefined,
					announcementPermission:
						typeof record?.announcementPermission === 'string'
							? record.announcementPermission
							: undefined,
					ownerAccount:
						typeof record?.ownerAccount === 'string'
							? record.ownerAccount
							: undefined,
					createdAt:
						typeof record?.createdAt === 'string'
							? record.createdAt
							: undefined,
					updatedAt:
						typeof record?.updatedAt === 'string'
							? record.updatedAt
							: undefined,
				})
			}
			const hasMoreFromApi =
				typeof payload?.hasMore === 'boolean' ? payload.hasMore : undefined
			const totalPages = Number(payload?.totalPages || 0)
			const reachedTail = records.length < pageSize
			if (typeof hasMoreFromApi === 'boolean') {
				hasMore = hasMoreFromApi
			} else if (totalPages > 0) {
				hasMore = page < totalPages
			} else {
				hasMore = !reachedTail
			}
			page += 1
		}
		joinedGroupChats.value = Array.from(mergedMap.values())
	} catch (error) {
		console.warn('加载我加入的群列表失败:', error)
		joinedGroupChats.value = []
	} finally {
		isLoadingGroupChats.value = false
	}
}

const filteredGroupChats = computed<GroupContactItem[]>(() => {
	const keyword = searchQuery.value.trim().toLowerCase()
	if (!keyword) return joinedGroupChats.value
	return joinedGroupChats.value.filter((item) => {
		const candidate = `${item.name || ''} ${item.groupNo || ''}`.toLowerCase()
		return candidate.includes(keyword)
	})
})

const selectedGroupChat = computed<GroupContactItem | null>(() => {
	if (!selectedGroupNo.value) return null
	return (
		joinedGroupChats.value.find(
			(item) => item.groupNo === selectedGroupNo.value,
		) ||
		null
	)
})

const selectedFriendDetailModel = computed<FriendModel | null>(() => {
	const selectedFriend = friendStore.selectedFriend
	if (!selectedFriend) return null
	return {
		id: selectedFriend.uid || selectedFriend.id,
		nickname: selectedFriend.remark || selectedFriend.name,
		avatar: selectedFriend.avatar,
		bio: selectedFriend.signature || '',
		region: selectedFriend.region || '',
		gender:
			selectedFriend.gender === 'male'
				? '男'
				: selectedFriend.gender === 'female'
					? '女'
					: '未知',
		onlineStatus: selectedFriend.status,
		lastActiveAt: selectedFriend.status === 'offline' ? '最近离线' : '',
		badges: {
			isVip: !!selectedFriend.isVip,
			vipLevel: selectedFriend.isVip ? selectedFriend.vipLevel || 1 : undefined,
			verified: false,
			userLevel: undefined,
		},
		stats: {
			growth: selectedFriend.growthValue || 0,
		},
		relationshipStatus:
			selectedFriend.relationType === 'BLOCKED' ||
			selectedFriend.groupId === 'blacklist'
				? 'blocked_by_me'
				: 'friend',
		privacyLevel: 'public',
		remarkName: selectedFriend.remark || '',
		tags: selectedFriend.tags || [],
		mutual: {
			friendsCount: 0,
			groupsCount: 0,
		},
		source: selectedFriend.createTime ? `添加于 ${formatDateTime(selectedFriend.createTime)}` : '联系人列表',
		media: {
			photos: [],
			postsPreview: [],
		},
	}
})

const shouldShowListPanel = computed<boolean>(() => {
	if (containerWidth.value >= 500) return true
	if (contactModule.value === 'friends') {
		return !friendStore.selectedFriendId
	}
	return !selectedGroupNo.value
})

const shouldShowDetailPanel = computed<boolean>(() => {
	if (containerWidth.value >= 500) return true
	if (contactModule.value === 'friends') {
		return !!friendStore.selectedFriendId
	}
	return !!selectedGroupNo.value
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

const selectGroupChat = (groupNo: string): void => {
	selectedGroupNo.value = groupNo
}

const switchContactModule = (module: 'friends' | 'groups'): void => {
	contactModule.value = module
	searchQuery.value = ''
	if (module === 'friends') {
		selectedGroupNo.value = null
		return
	}
	friendStore.selectedFriendId = null
	void loadJoinedGroups()
	if (!selectedGroupNo.value && filteredGroupChats.value.length) {
		selectedGroupNo.value = filteredGroupChats.value[0].groupNo
	}
}

const handleMobileBack = (): void => {
	if (contactModule.value === 'friends') {
		friendStore.selectedFriendId = null
		return
	}
	selectedGroupNo.value = null
}

const formatDateTime = (raw?: string): string => {
	if (!raw) return '未知'
	const date = new Date(raw)
	if (Number.isNaN(date.getTime())) return raw
	return date.toLocaleString()
}

const requestStatusText = (status: FriendRequestStatus): string => {
	if (status === 'ACCEPTED') return '已同意'
	if (status === 'REJECTED') return '已拒绝'
	if (status === 'CANCELED') return '已取消'
	if (status === 'EXPIRED') return '已过期'
	return '待处理'
}

const requestStatusTagType = (
	status: FriendRequestStatus,
): 'default' | 'success' | 'error' | 'warning' => {
	if (status === 'ACCEPTED') return 'success'
	if (status === 'REJECTED') return 'error'
	if (status === 'EXPIRED') return 'warning'
	return 'default'
}

const mapHistoryRecord = (
	item: FriendRequestHistoryItem,
): RequestHistoryRecord => {
	const isOutbound = item.direction === 'OUTBOUND'
	return {
		uniqueKey: [
			item.requestId || 'unknown',
			item.createdAt || 'unknown',
			item.direction,
			item.status,
		].join('|'),
		requestId: item.requestId,
		account: isOutbound ? item.targetAccount : item.applicantAccount,
		realName: isOutbound ? item.targetName : item.applicantName,
		avatarUrl: isOutbound ? item.targetAvatarUrl : item.applicantAvatarUrl,
		isVip: isOutbound ? item.targetIsVip : item.applicantIsVip,
		verificationMessage: item.verificationMessage,
		direction: item.direction,
		status: item.status,
		createdTime: item.createdAt,
		updateTime: item.updatedAt || item.createdAt,
	}
}

const historyHasMore = computed(
	() => friendStore.requestHistoryPagination.hasMore,
)

const loadHistory = async (page = 1): Promise<void> => {
	const ok = await friendStore.fetchRequestHistory({
		page,
		size: 20,
		statuses:
			historyStatusFilter.value === 'ALL'
				? undefined
				: [historyStatusFilter.value],
		keyword: historyKeyword.value || undefined,
	})
	if (!ok) {
		message.error('历史记录加载失败，请稍后重试')
		return
	}

	const pageRecords = friendStore.requestHistory.map(mapHistoryRecord)
	if (page <= 1) {
		requestHistoryRecords.value = pageRecords
		return
	}
	const merged = new Map<string, RequestHistoryRecord>()
	requestHistoryRecords.value.forEach((item) =>
		merged.set(item.uniqueKey, item),
	)
	pageRecords.forEach((item) => merged.set(item.uniqueKey, item))
	requestHistoryRecords.value = Array.from(merged.values()).sort((a, b) => {
		const timeA = new Date(a.updateTime).getTime()
		const timeB = new Date(b.updateTime).getTime()
		return (
			(Number.isNaN(timeB) ? 0 : timeB) -
			(Number.isNaN(timeA) ? 0 : timeA)
		)
	})
}

const reloadHistory = async (): Promise<void> => {
	await loadHistory(1)
}

const loadMoreHistory = async (): Promise<void> => {
	const nextPage = friendStore.requestHistoryPagination.page + 1
	await loadHistory(nextPage)
}


const startChat = async (friend: Friend): Promise<void> => {
	const chatId = await chatStore.getOrCreateChat(friend)
	await chatStore.setActiveChat(chatId)
	router.push({ name: 'chat' })
}

const handleFriendDetailMessage = async (profile: FriendModel): Promise<void> => {
	const target = friendStore.friends.find(
		(item) => item.id === profile.id || item.uid === profile.id,
	)
	if (!target) {
		message.warning('未找到该好友，无法发起会话')
		return
	}
	await startChat(target)
}

const handleFriendDetailDelete = async (profile: FriendModel): Promise<void> => {
	try {
		await friendStore.deleteFriend(profile.id)
		message.success('好友已删除')
	} catch {
		message.error('删除失败，请稍后再试')
	}
}

const openSelectedGroupChat = async (): Promise<void> => {
	const groupNo = selectedGroupChat.value?.groupNo?.trim() || ''
	if (!groupNo) return
	await chatStore.getGroupInfo(groupNo)
	const groupChat = chatStore.chatlist.find(
		(item) => item.chatType === 'GROUP' && item.groupNo?.trim() === groupNo,
	)
	if (!groupChat) return
	await chatStore.setActiveChat(groupChat.id)
	router.push({ name: 'chat' })
}

const copySelectedGroupNo = async (): Promise<void> => {
	const groupNo = selectedGroupChat.value?.groupNo?.trim() || ''
	if (!groupNo) {
		message.warning('当前群组缺少群号')
		return
	}
	try {
		await navigator.clipboard.writeText(groupNo)
		message.success('群号已复制')
	} catch {
		message.error('复制失败，请手动复制')
	}
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
const showRemarkModal = ref(false)
const remarkValue = ref('')
const showMoveGroupModal = ref(false)
const moveTargetGroupId = ref<string | null>(null)

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
		const created = friendStore.addGroup(newGroupName.value.trim())
		if (!created) {
			message.warning('分组名称不能为空或已存在')
			return
		}
		newGroupName.value = ''
		message.success('添加成功')
	}
}

const confirmRenameGroup = (): void => {
	if (contextMenuGroup.value && renameGroupValue.value.trim()) {
		const renamed = friendStore.renameGroup(
			contextMenuGroup.value.id,
			renameGroupValue.value.trim(),
		)
		if (!renamed) {
			message.warning('分组名称不能为空或已存在')
			return
		}
		message.success('修改成功')
	}
}

const moveGroupOptions = computed(() =>
	sortedGroups.value.map((group) => ({
		label: group.name,
		value: group.id,
	})),
)

const confirmRemarkUpdate = (): void => {
	const targetFriend = friendStore.selectedFriend
	if (!targetFriend) return
	const updated = friendStore.updateFriendRemark(
		targetFriend.id,
		remarkValue.value,
	)
	if (!updated) {
		message.error('修改备注失败，请稍后重试')
		return
	}
	message.success('备注已更新')
}

const confirmMoveGroup = (): void => {
	const targetFriend = friendStore.selectedFriend
	if (!targetFriend || !moveTargetGroupId.value) {
		message.warning('请先选择目标分组')
		return
	}
	const moved = friendStore.moveFriendToGroup(
		targetFriend.id,
		moveTargetGroupId.value,
	)
	if (!moved) {
		message.error('移动分组失败，请稍后重试')
		return
	}
	message.success('已移动到目标分组')
}

const handleFriendApplied = async (): Promise<void> => {
	await Promise.all([friendStore.fetchPendingRequests(), reloadHistory()])
}

const openPendingRequestsModal = async (): Promise<void> => {
	showPendingRequestsModal.value = true
	requestModalTab.value = 'pending'
	const [pendingOk] = await Promise.all([
		friendStore.fetchPendingRequests(),
		loadHistory(1),
	])
	const ok = pendingOk
	if (!ok) {
		message.error('好友请求加载失败，请稍后重试')
	}
}

const handlePendingRequestAction = async (
	action: 'accept' | 'reject',
	request: PendingFriendRequest,
): Promise<void> => {
	actionLoadingAccount.value = request.account
	actionType.value = action
	try {
		if (action === 'accept') {
			await friendStore.acceptFriendRequest(request.account)
			message.success('已同意好友申请')
			await friendStore.fetchFriends()
		} else {
			await friendStore.rejectFriendRequest(request.account)
			message.success('已拒绝好友申请')
		}
		await Promise.all([friendStore.fetchPendingRequests(), reloadHistory()])
	} catch {
		message.error('操作失败，请稍后再试')
	} finally {
		actionLoadingAccount.value = ''
		actionType.value = ''
	}
}

watch(
	() => requestModalTab.value,
	(tab) => {
		if (tab === 'history') {
			void reloadHistory()
		}
	},
)

watch(
	() => joinedGroupChats.value.map((item) => item.groupNo).join(','),
	() => {
		if (contactModule.value !== 'groups') return
		if (
			selectedGroupNo.value &&
			joinedGroupChats.value.some(
				(item) => item.groupNo === selectedGroupNo.value,
			)
		) {
			return
		}
		selectedGroupNo.value = joinedGroupChats.value[0]?.groupNo || null
	},
)
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

:deep(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.12);
}

:deep(.dark) .custom-scrollbar:hover::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.2);
}

.fade-detail-enter-active,
.fade-detail-leave-active {
	transition: opacity 0.3s ease;
}
.fade-detail-enter-from,
.fade-detail-leave-to {
	opacity: 0;
}

.vip-fill-red {
	filter: brightness(0) saturate(100%) invert(23%) sepia(94%) saturate(7118%)
		hue-rotate(353deg) brightness(97%) contrast(111%);
}
</style>
