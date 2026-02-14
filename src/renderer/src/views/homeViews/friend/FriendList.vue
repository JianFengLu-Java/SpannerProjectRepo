<template>
	<div
		ref="containerRef"
		class="h-full w-full flex overflow-hidden bg-page-bg transition-all duration-300"
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
									class="w-7 h-7 no-drag flex items-center justify-center rounded-xl hover:bg-gray-200/50 dark:hover:bg-zinc-700/40 cursor-pointer transition-colors"
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
									class="w-7 h-7 no-drag flex items-center justify-center rounded-xl hover:bg-gray-200/50 dark:hover:bg-zinc-700/40 cursor-pointer transition-colors"
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
									class="w-7 h-7 no-drag flex items-center justify-center rounded-xl hover:bg-gray-200/50 dark:hover:bg-zinc-700/40 cursor-pointer transition-colors"
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
					class="rounded-xl bg-gray-100/50 dark:bg-zinc-800/60 border-none"
				>
					<template #prefix>
						<n-icon class="text-gray-400 dark:text-gray-500">
							<Search24Regular />
						</n-icon>
					</template>
				</n-input>
			</div>

			<!-- 联系人列表内容 -->
			<div class="flex-1 overflow-y-auto custom-scrollbar p-2 pt-0">
				<div
					v-if="friendStore.isLoading"
					class="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500"
				>
					加载好友列表中...
				</div>
				<div
					v-else-if="!friendStore.friends.length"
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
					<!-- 分组头部 -->
					<div
						class="group-header flex items-center gap-1 h-9 px-2 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/6 transition-colors select-none"
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
						<span
							class="text-xs font-semibold text-gray-500 dark:text-gray-300 flex-1 truncate"
						>
							{{ group.name }}
						</span>
						<span
							class="text-[10px] text-gray-400 dark:text-gray-500"
						>
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
									class="text-[11px] text-gray-400 dark:text-gray-500 truncate pr-4"
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
			class="flex-1 overflow-hidden relative flex flex-col bg-page-bg"
		>
			<div
				class="pointer-events-none absolute inset-0 hidden dark:block bg-black/30"
			></div>
			<!-- 窄屏返回按钮 -->
			<div
				v-if="containerWidth < 500 && friendStore.selectedFriendId"
				class="absolute top-3 left-3 z-50"
			>
				<button
					class="w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-zinc-800/85 border border-black/5 dark:border-zinc-700/80 backdrop-blur-md rounded-full text-gray-600 dark:text-gray-100 active:scale-90 transition-all"
					@click="friendStore.selectedFriendId = null"
				>
					<n-icon size="20"><ChevronLeft24Regular /></n-icon>
				</button>
			</div>
			<Transition name="fade-scale" mode="out-in">
				<div
					v-if="friendStore.selectedFriend"
					:key="friendStore.selectedFriend.id"
					class="h-full overflow-y-auto custom-scrollbar"
				>
					<div
						class="relative isolate px-3 pb-6 pt-4 sm:px-4 lg:px-5"
					>
						<div
							class="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/5 via-transparent to-transparent"
						></div>
						<div
							class="relative mx-auto w-full max-w-5xl space-y-3"
						>
							<section
								class="rounded-xl border border-border-default bg-card-bg p-3 shadow-[0_10px_30px_rgba(16,24,40,0.08)] backdrop-blur-md sm:p-4"
							>
								<div
									class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
								>
									<div
										class="flex min-w-0 items-start gap-3 sm:gap-4"
									>
										<div class="relative shrink-0">
											<n-avatar
												round
												:size="
													containerWidth >= 640
														? 64
														: 56
												"
												:src="
													friendStore.selectedFriend
														.avatar
												"
												class="border-[3px] border-white/85 dark:border-zinc-800"
											/>
											<div
												class="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-zinc-800"
												:class="[
													friendStore.selectedFriend
														.status === 'online'
														? 'bg-emerald-500'
														: 'bg-gray-400',
												]"
											></div>
										</div>
										<div class="min-w-0 space-y-2">
											<div
												class="flex flex-wrap items-center gap-x-2 gap-y-1"
											>
												<h3
													class="max-w-[340px] truncate text-xl font-semibold text-text-main"
												>
													{{
														friendStore
															.selectedFriend.name
													}}
												</h3>
												<n-icon
													v-if="
														friendStore
															.selectedFriend
															.gender === 'male'
													"
													size="18"
													color="#0ea5e9"
												>
													<Male />
												</n-icon>
												<n-icon
													v-else-if="
														friendStore
															.selectedFriend
															.gender === 'female'
													"
													size="18"
													color="#f472b6"
												>
													<Female />
												</n-icon>
												<span
													class="rounded-full px-2 py-0.5 text-[11px] font-medium"
													:class="
														friendStore
															.selectedFriend
															.status === 'online'
															? 'bg-emerald-500/15 text-emerald-600'
															: 'bg-page-bg text-text-main/70 border border-border-default'
													"
												>
													{{
														friendStore
															.selectedFriend
															.status === 'online'
															? '在线'
															: '离线'
													}}
												</span>
											</div>
											<p
												class="line-clamp-2 text-[13px] leading-relaxed text-gray-500 dark:text-gray-300"
											>
												{{
													friendStore.selectedFriend
														.signature ||
													'这个人太神秘了，还没有个性签名。'
												}}
											</p>
											<div
												class="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500"
											>
												<span
													class="rounded-full border border-border-default bg-page-bg px-2 py-0.5 font-mono text-text-main/80"
												>
													UID:
													{{
														friendStore
															.selectedFriend.uid
													}}
												</span>
												<span
													class="rounded-full border border-border-default bg-page-bg px-2 py-0.5 text-text-main/80"
												>
													{{
														friendStore
															.selectedFriend
															.region ||
														'未知地区'
													}}
												</span>
											</div>
										</div>
									</div>

									<div class="flex items-center gap-2">
										<n-button
											type="primary"
											class="h-10 flex-1 rounded-xl px-4 text-sm font-semibold sm:flex-none"
											@click="
												startChat(
													friendStore.selectedFriend!,
												)
											"
										>
											<template #icon>
												<n-icon
													><Chat24Regular
												/></n-icon>
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
												class="h-10 w-10 rounded-xl px-0"
											>
												<n-icon size="20">
													<MoreHorizontal24Regular />
												</n-icon>
											</n-button>
										</n-dropdown>
									</div>
								</div>
							</section>

							<section
								class="grid grid-cols-1 gap-3 lg:grid-cols-3"
							>
								<div
									class="rounded-xl border border-border-default bg-card-bg p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm lg:col-span-2"
								>
									<p
										class="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500"
									>
										资料信息
									</p>
									<div
										class="grid grid-cols-1 gap-2 sm:grid-cols-2"
									>
										<div
											v-for="item in selectedFriendPrimaryInfoItems"
											:key="item.label"
											class="flex items-center gap-2 rounded-xl border border-border-default bg-page-bg p-2"
										>
											<div
												class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
												:class="item.iconBgClass"
											>
												<n-icon
													:class="item.iconTextClass"
													size="16"
												>
													<component
														:is="item.icon"
													/>
												</n-icon>
											</div>
											<div class="min-w-0">
												<p
													class="text-[10px] text-gray-400 dark:text-gray-500"
												>
													{{ item.label }}
												</p>
												<p
													class="truncate text-[13px] font-medium text-text-main"
												>
													{{ item.value }}
												</p>
											</div>
										</div>
										<div
											v-if="
												!selectedFriendPrimaryInfoItems.length
											"
											class="col-span-full rounded-xl border border-dashed border-border-default/70 dark:border-zinc-700/70 px-3 py-4 text-center text-xs text-gray-400 dark:text-gray-500"
										>
											暂无核心资料
										</div>
									</div>

									<div
										class="mt-2 rounded-xl border border-border-default bg-page-bg px-2.5 py-1.5"
									>
										<div
											v-for="item in selectedFriendSecondaryInfoItems"
											:key="`secondary-${item.label}`"
											class="flex items-center gap-2 py-1 first:pt-0 last:pb-0"
										>
											<div
												class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
												:class="item.iconBgClass"
											>
												<n-icon
													:class="item.iconTextClass"
													size="12"
												>
													<component
														:is="item.icon"
													/>
												</n-icon>
											</div>
											<p
												class="shrink-0 text-[11px] text-gray-400 dark:text-gray-500"
											>
												{{ item.label }}
											</p>
											<p
												class="truncate text-[12px] text-text-main/80"
											>
												{{ item.value }}
											</p>
										</div>
										<div
											v-if="
												!selectedFriendSecondaryInfoItems.length
											"
											class="py-2 text-center text-xs text-gray-400 dark:text-gray-500"
										>
											暂无更多资料
										</div>
									</div>
								</div>

								<div class="space-y-2.5">
									<div
										v-if="
											friendStore.selectedFriend.tags &&
											friendStore.selectedFriend.tags
												.length
										"
										class="rounded-xl border border-border-default bg-card-bg p-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)] backdrop-blur-sm"
									>
										<p
											class="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500"
										>
											个人标签
										</p>
										<div class="flex flex-wrap gap-2">
											<span
												v-for="tag in friendStore
													.selectedFriend.tags"
												:key="tag"
												class="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700"
											>
												# {{ tag }}
											</span>
										</div>
									</div>

									<button
										class="group w-full rounded-xl border border-border-default bg-card-bg p-3 text-left shadow-[0_8px_20px_rgba(6,182,212,0.12)] transition hover:bg-page-bg hover:shadow-[0_10px_26px_rgba(6,182,212,0.16)]"
										@click="
											message.info('正在进入个人空间...')
										"
									>
										<div
											class="flex items-center justify-between gap-3"
										>
											<div>
												<p
													class="text-[13px] font-semibold text-text-main"
												>
													个人空间
												</p>
												<p
													class="mt-0.5 text-[11px] text-gray-500"
												>
													查看相册、日志与动态
												</p>
											</div>
											<n-icon
												class="text-cyan-500 transition-transform group-hover:translate-x-0.5"
											>
												<ChevronRight12Filled />
											</n-icon>
										</div>
									</button>
								</div>
							</section>
						</div>
					</div>
				</div>

				<div
					v-else
					class="h-full flex items-center justify-center select-none px-6"
				>
					<div
						class="flex flex-col items-center justify-center rounded-xl px-8 py-10"
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
			:mask-closable="false"
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
			:mask-closable="false"
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

		<n-modal
			v-model:show="showRemarkModal"
			preset="dialog"
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
				class="rounded-xl"
			/>
		</n-modal>

		<n-modal
			v-model:show="showMoveGroupModal"
			preset="dialog"
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
			title="好友申请"
			:mask-closable="false"
			:bordered="false"
			style="width: 520px; border-radius: 16px"
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
							class="rounded-xl border border-border-default/70 bg-white/90 dark:border-zinc-700/80 dark:bg-zinc-900/85 p-3"
						>
							<div class="flex items-center gap-3">
								<n-avatar
									round
									:size="36"
									:src="request.avatarUrl"
								/>
								<div class="min-w-0 flex-1">
									<div
										class="truncate text-sm font-semibold text-text-main"
									>
										{{ request.realName }}
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
							class="rounded-xl border border-border-default/70 bg-white/90 dark:border-zinc-700/80 dark:bg-zinc-900/85 p-3"
						>
							<div class="flex items-center gap-3">
								<n-avatar
									round
									:size="34"
									:src="record.avatarUrl"
								/>
								<div class="min-w-0 flex-1">
									<div
										class="truncate text-sm font-semibold text-text-main"
									>
										{{ record.realName }}
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
	Chat24Regular,
	MoreHorizontal24Regular,
	PeopleCommunity24Regular,
	Edit24Regular,
	Delete24Regular,
	Mail24Regular,
	Tag24Regular,
	CalendarLtr24Regular,
} from '@vicons/fluent'
import { Male, Female } from '@vicons/ionicons5'
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
import { useChatStore } from '@renderer/stores/chat'
import { useElementSize } from '@vueuse/core'
import FriendApplyModal from '@renderer/components/FriendApplyModal.vue'

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
const showPendingRequestsModal = ref(false)
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

const loadFriends = async (): Promise<void> => {
	const [friendsOk, pendingOk] = await Promise.all([
		friendStore.fetchFriends(),
		friendStore.fetchPendingRequests(),
	])
	if (!friendsOk) {
		message.error('好友列表加载失败，请稍后重试')
	}
	if (!pendingOk) {
		message.error('好友请求加载失败，请稍后重试')
	}
}

onMounted(() => {
	void loadFriends()
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

const onlineCount = (groupId: string): number => {
	return (friendStore.groupedFriends[groupId] || []).filter(
		(f) => f.status === 'online',
	).length
}

interface FriendInfoItem {
	label: string
	value: string
	icon: unknown
	iconBgClass: string
	iconTextClass: string
	priority: 'primary' | 'secondary'
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

const formatGender = (gender?: Friend['gender']): string => {
	if (gender === 'male') return '男'
	if (gender === 'female') return '女'
	return '未知'
}

const formatDateTime = (raw?: string): string => {
	if (!raw) return '未知'
	const date = new Date(raw)
	if (Number.isNaN(date.getTime())) return raw
	return date.toLocaleString()
}

const formatRelationType = (relationType?: Friend['relationType']): string => {
	if (relationType === 'ACCEPTED') return '好友'
	if (relationType === 'PENDING') return '待处理'
	if (relationType === 'BLOCKED') return '已拉黑'
	return '无关系'
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

const selectedFriendInfoItems = computed<FriendInfoItem[]>(() => {
	const selectedFriend = friendStore.selectedFriend
	if (!selectedFriend) return []

	const groupName =
		friendStore.groups.find((group) => group.id === selectedFriend.groupId)
			?.name || '未知分组'

	return [
		{
			label: '账号',
			value: selectedFriend.uid || '未填',
			icon: Tag24Regular,
			iconBgClass: 'bg-slate-50 dark:bg-slate-900/30',
			iconTextClass: 'text-slate-500 dark:text-slate-300',
			priority: 'primary',
		},
		{
			label: '电子邮箱',
			value: selectedFriend.email || '未填',
			icon: Mail24Regular,
			iconBgClass: 'bg-blue-50 dark:bg-blue-900/30',
			iconTextClass: 'text-blue-500 dark:text-blue-300',
			priority: 'primary',
		},
		{
			label: '手机号',
			value: selectedFriend.phone || '未填',
			icon: Chat24Regular,
			iconBgClass: 'bg-cyan-50 dark:bg-cyan-900/30',
			iconTextClass: 'text-cyan-500 dark:text-cyan-300',
			priority: 'primary',
		},
		{
			label: '性别',
			value: formatGender(selectedFriend.gender),
			icon: Edit24Regular,
			iconBgClass: 'bg-fuchsia-50 dark:bg-fuchsia-900/30',
			iconTextClass: 'text-fuchsia-500 dark:text-fuchsia-300',
			priority: 'secondary',
		},
		{
			label: '年龄',
			value: selectedFriend.age ? `${selectedFriend.age} 岁` : '未知',
			icon: CalendarLtr24Regular,
			iconBgClass: 'bg-violet-50 dark:bg-violet-900/30',
			iconTextClass: 'text-violet-500 dark:text-violet-300',
			priority: 'secondary',
		},
		{
			label: '备注姓名',
			value: selectedFriend.remark || '无备注',
			icon: Edit24Regular,
			iconBgClass: 'bg-amber-50 dark:bg-amber-900/30',
			iconTextClass: 'text-amber-500 dark:text-amber-300',
			priority: 'secondary',
		},
		{
			label: '申请附言',
			value: selectedFriend.verificationMessage || '无',
			icon: Mail24Regular,
			iconBgClass: 'bg-orange-50 dark:bg-orange-900/30',
			iconTextClass: 'text-orange-500 dark:text-orange-300',
			priority: 'secondary',
		},
		{
			label: '添加时间',
			value: formatDateTime(selectedFriend.createTime),
			icon: CalendarLtr24Regular,
			iconBgClass: 'bg-indigo-50 dark:bg-indigo-900/30',
			iconTextClass: 'text-indigo-500 dark:text-indigo-300',
			priority: 'secondary',
		},
		{
			label: '所属分组',
			value: groupName,
			icon: Tag24Regular,
			iconBgClass: 'bg-emerald-50 dark:bg-emerald-900/30',
			iconTextClass: 'text-emerald-500 dark:text-emerald-300',
			priority: 'primary',
		},
		{
			label: '关系状态',
			value: formatRelationType(selectedFriend.relationType),
			icon: PeopleCommunity24Regular,
			iconBgClass: 'bg-teal-50 dark:bg-teal-900/30',
			iconTextClass: 'text-teal-500 dark:text-teal-300',
			priority: 'secondary',
		},
	]
})

const selectedFriendPrimaryInfoItems = computed<FriendInfoItem[]>(() => {
	const all = selectedFriendInfoItems.value
	if (!all.length) return []
	const primary = all.filter((item) => item.priority === 'primary')
	if (primary.length) return primary
	return all.slice(0, Math.min(4, all.length))
})

const selectedFriendSecondaryInfoItems = computed<FriendInfoItem[]>(() => {
	const all = selectedFriendInfoItems.value
	if (!all.length) return []
	const secondary = all.filter((item) => item.priority === 'secondary')
	if (secondary.length) return secondary
	const primaryLabels = new Set(
		selectedFriendPrimaryInfoItems.value.map((item) => item.label),
	)
	return all.filter((item) => !primaryLabels.has(item.label))
})

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

// 朋友详情页更多选项
const friendActionOptions = computed(() => {
	return [
		{ label: '修改备注', key: 'rename' },
		{ label: '移动分组', key: 'move' },
		{ label: '加入黑名单', key: 'block' },
		{ label: '删除好友', key: 'delete', text: true },
	]
})

const moveGroupOptions = computed(() =>
	sortedGroups.value.map((group) => ({
		label: group.name,
		value: group.id,
	})),
)

const handleFriendAction = (key: string): void => {
	const targetFriend = friendStore.selectedFriend
	if (!targetFriend) return

	if (key === 'rename') {
		remarkValue.value = targetFriend.remark || ''
		showRemarkModal.value = true
		return
	}
	if (key === 'move') {
		moveTargetGroupId.value = targetFriend.groupId || 'default'
		showMoveGroupModal.value = true
		return
	}
	if (key === 'block') {
		const moved = friendStore.moveFriendToGroup(
			targetFriend.id,
			'blacklist',
		)
		if (!moved) {
			message.error('加入黑名单失败，请稍后重试')
			return
		}
		message.success('已加入黑名单分组')
		return
	}
	if (key !== 'delete') return

	if (!window.confirm(`确认删除好友 ${targetFriend.name} 吗？`)) {
		return
	}

	void friendStore
		.deleteFriend(targetFriend.uid)
		.then(() => {
			message.success('好友已删除')
		})
		.catch(() => {
			message.error('删除失败，请稍后再试')
		})
}

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
