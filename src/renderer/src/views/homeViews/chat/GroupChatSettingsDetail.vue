<template>
	<div class="h-full min-h-0 w-full overflow-hidden bg-page-bg flex flex-col">
		<div class="group-settings-title shrink-0">
			<GroupSettingsHeader
				title="群聊设置"
				@back="$emit('close')"
				@more="notify('更多功能待接入')"
			/>
		</div>

			<div
				class="group-settings-context min-h-0 flex-1 overflow-y-auto px-3 pb-4 space-y-3"
			>
				<GroupInfoCard
					:avatar="groupAvatar"
					:group-name="groupName"
					:group-no="group.groupNo || '-'"
					:summary="groupSummary"
					:role-label="roleLabel"
					:can-edit="canEditProfile"
					@copy-group-no="copyGroupNo"
					@open-qr="showInviteLinkModal = true"
					@edit-profile="openProfileEditor"
				/>

			<MemberPreview
				:members="memberPreview"
				:member-count="resolvedMemberCount"
				:can-manage="canManage"
				@view-all="openMembersModal('view')"
				@add-member="openInviteModal"
				@remove-member="openMembersModal('remove')"
			/>

			<SettingSection title="消息与提醒">
				<SwitchRow
					v-model:model-value="messageMute"
					label="消息免打扰"
					description="开启后仅保留重要提醒"
				/>
				<SwitchRow
					v-model:model-value="chatPinned"
					label="置顶聊天"
					description="会话将在消息列表顶部显示"
				/>
				<SwitchRow
					v-model:model-value="saveToContacts"
					label="保存到通讯录"
					description="在联系人列表中快捷访问"
				/>
				<LinkRow
					label="清空聊天记录"
					description="清除当前账号在本群的消息记录"
					@click="openConfirm('clear')"
				/>
				<LinkRow
					label="聊天背景"
					description="自定义本群聊天背景"
					@click="showChatBackgroundModal = true"
				/>
			</SettingSection>

			<SettingSection title="权限与安全" description="降低误操作风险，提升管理效率">
				<LinkRow
					label="谁可以邀请成员"
					:value="invitePermissionLabel"
					@click="toggleInvitePermission"
				/>
				<SwitchRow
					v-model:model-value="memberCanEditGroupName"
					label="成员可修改群名称"
					:disabled="!canManage"
					description="关闭后仅群主/管理员可修改"
				/>
				<SwitchRow
					v-model:model-value="newMemberVerify"
					label="新成员入群验证"
					:disabled="!canManage"
					description="开启后入群需管理员确认"
				/>
				<LinkRow
					label="群公告发布权限"
					:value="announcementPermissionLabel"
					@click="notify('当前权限由后端配置返回')"
				/>
				<LinkRow
					v-if="canManage"
					label="黑名单/禁言管理"
					description="统一管理违规成员与发言权限"
					@click="openMembersModal('manage')"
				/>
				<LinkRow
					label="举报群聊"
					description="提交违规信息与截图证据"
					danger
					@click="showReportModal = true"
				/>
			</SettingSection>

			<SettingSection title="群公告">
				<LinkRow
					label="最近公告"
					:value="announcementBrief"
					@click="openAnnouncementHistory"
				/>
				<LinkRow
					v-if="canManage"
					label="发布/编辑公告"
					description="发布后群成员将收到公告提醒"
					@click="openAnnouncementEditor"
				/>
			</SettingSection>

			<SettingSection title="文件与媒体">
				<LinkRow
					label="群文件"
					description="查看和管理共享文件"
					:value="String(mediaOverview?.fileCount ?? 0)"
					@click="openMediaOverview('file')"
				/>
				<LinkRow
					label="图片/视频"
					description="按时间查看媒体内容"
					:value="String(mediaOverview?.imageVideoCount ?? 0)"
					@click="openMediaOverview('imageVideo')"
				/>
				<LinkRow
					label="链接"
					description="浏览群内分享链接"
					:value="String(mediaOverview?.linkCount ?? 0)"
					@click="openMediaOverview('link')"
				/>
			</SettingSection>

			<DangerZone
				:is-owner="isOwner"
				@quit="openConfirm('quit')"
				@disband="openConfirm('disband')"
			/>
		</div>

			<n-modal
				v-model:show="showProfileEditorModal"
				preset="card"
				class="app-modal-card max-w-[520px]"
				:mask-closable="false"
				title="编辑群资料"
			>
				<div class="space-y-3">
					<n-input
						v-model:value="profileEditorGroupName"
						maxlength="30"
						placeholder="请输入群名称"
						:disabled="!canEditProfile"
						aria-label="群名称"
					/>
					<div class="rounded-lg border border-border-default/50 p-3">
						<div class="text-xs text-gray-500 mb-2">群头像</div>
						<div class="flex items-center gap-3">
							<n-avatar :size="56" round :src="profileEditorAvatarPreview" />
							<div class="flex flex-col gap-2">
								<n-button
									size="small"
									secondary
									:disabled="!canManage || profileAvatarUploading"
									@click="openGroupAvatarUpload"
								>
									{{ profileAvatarUploading ? '上传中...' : '上传头像' }}
								</n-button>
								<div class="text-[11px] text-gray-400 break-all max-w-[320px]">
									{{ profileEditorAvatarUrl || '未上传头像，默认使用当前会话头像' }}
								</div>
							</div>
						</div>
					</div>
					<n-input
						v-model:value="profileEditorSummary"
						type="textarea"
						:autosize="{ minRows: 3, maxRows: 6 }"
						maxlength="120"
						placeholder="请输入群简介"
						:disabled="!canManage"
						aria-label="群简介"
					/>
					<div class="text-xs text-gray-400">
						普通成员仅可在允许时修改群名称；群头像与群简介仅群主/管理员可编辑。
					</div>
				</div>
				<template #footer>
					<div class="flex justify-end gap-2">
						<n-button @click="showProfileEditorModal = false">取消</n-button>
						<n-button
							type="primary"
							:loading="profileEditorSaving"
							:disabled="!profileEditorGroupName.trim() || profileAvatarUploading"
							@click="submitProfileEdit"
						>
							保存
						</n-button>
					</div>
				</template>
			</n-modal>

			<n-modal
				v-model:show="showConfirmModal"
				preset="card"
				class="app-modal-card max-w-[360px]"
				:mask-closable="false"
				title="操作确认"
			>
			<div class="space-y-3 text-sm text-gray-600">
				<p>{{ confirmDescription }}</p>
				<n-input
					v-if="confirmType === 'disband'"
					v-model:value="confirmInput"
					placeholder="请输入群名称以确认解散"
					aria-label="解散确认输入"
				/>
			</div>
			<template #footer>
				<div class="flex justify-end gap-2">
					<n-button @click="showConfirmModal = false">取消</n-button>
					<n-button
						type="error"
						:disabled="confirmDisabled"
						@click="confirmDangerAction"
					>
						确认
					</n-button>
				</div>
			</template>
		</n-modal>

			<n-modal
				v-model:show="showMembersModal"
				preset="card"
				title="群成员"
				class="app-modal-card max-w-[560px]"
			>
			<div class="space-y-3">
				<div class="flex items-center gap-2">
					<n-input
						v-model:value="membersKeyword"
						placeholder="搜索成员账号或昵称"
					/>
					<n-select
						v-model:value="membersRoleFilter"
						:options="memberRoleOptions"
						class="w-[140px]"
					/>
					<n-button @click="loadMembersPage(1)">查询</n-button>
				</div>

				<n-spin :show="membersLoading">
					<div v-if="!membersList.length" class="py-10">
						<n-empty description="暂无成员" />
					</div>
					<div v-else class="max-h-[360px] overflow-y-auto pr-1 space-y-2">
						<div
							v-for="member in membersList"
							:key="member.account"
							class="rounded-lg border border-border-default/50 px-3 py-2 flex items-center justify-between gap-3"
						>
							<div class="min-w-0 flex items-center gap-2">
								<n-avatar :size="28" round :src="member.avatarUrl" />
								<div class="min-w-0">
									<div class="text-sm text-text-main truncate">
										{{ member.name || member.account }}
									</div>
									<div class="text-[11px] text-gray-400 truncate">
										{{ member.account }}
									</div>
								</div>
							</div>
							<div class="flex items-center gap-2">
								<n-tag size="small" :bordered="false">{{ roleText(member.role) }}</n-tag>
								<n-button
									v-if="isOwner && member.role !== 'OWNER'"
									size="tiny"
									secondary
									@click="toggleMemberRole(member)"
								>
									{{ member.role === 'ADMIN' ? '降为成员' : '设为管理员' }}
								</n-button>
								<n-button
									v-if="canManage && canRemoveMember(member)"
									size="tiny"
									type="error"
									ghost
									@click="removeMember(member)"
								>
									移除
								</n-button>
							</div>
						</div>
					</div>
				</n-spin>

				<div class="flex items-center justify-between text-xs text-gray-400">
					<div>第 {{ membersPage }} / {{ Math.max(membersTotalPages, 1) }} 页，共 {{ membersTotal }} 人</div>
					<div class="flex gap-2">
						<n-button size="tiny" :disabled="membersPage <= 1" @click="loadMembersPage(membersPage - 1)">上一页</n-button>
						<n-button size="tiny" :disabled="membersPage >= membersTotalPages" @click="loadMembersPage(membersPage + 1)">下一页</n-button>
					</div>
				</div>
			</div>
		</n-modal>

			<n-modal v-model:show="showInviteModal" preset="card" title="添加成员" class="app-modal-card max-w-[520px]">
			<div class="space-y-3">
				<n-select
					v-model:value="inviteAccounts"
					multiple
					filterable
					clearable
					:options="inviteFriendOptions"
					placeholder="选择要邀请的好友"
				/>
				<div class="text-xs text-gray-400">已选择 {{ inviteAccounts.length }} 人</div>
			</div>
			<template #footer>
				<div class="flex justify-end gap-2">
					<n-button @click="showInviteModal = false">取消</n-button>
					<n-button
						type="primary"
						:loading="inviteSubmitting"
						:disabled="!inviteAccounts.length"
						@click="submitInviteMembers"
					>
						邀请
					</n-button>
				</div>
			</template>
		</n-modal>

			<n-modal v-model:show="showAnnouncementModal" preset="card" title="群公告历史" class="app-modal-card max-w-[560px]">
			<n-spin :show="announcementsLoading">
				<div v-if="!announcementsList.length" class="py-10">
					<n-empty description="暂无公告" />
				</div>
				<div v-else class="max-h-[360px] overflow-y-auto pr-1 space-y-2">
					<div
						v-for="item in announcementsList"
						:key="item.announcementId"
						class="rounded-lg border border-border-default/50 px-3 py-2"
					>
						<div class="text-sm text-text-main whitespace-pre-wrap break-words">{{ item.content }}</div>
						<div class="mt-1 text-[11px] text-gray-400">
							{{ item.publisherName || item.publisherAccount || '-' }} · {{ item.updatedAt || item.createdAt || '-' }}
						</div>
					</div>
				</div>
			</n-spin>
		</n-modal>

			<n-modal v-model:show="showAnnouncementEditorModal" preset="card" title="编辑公告" class="app-modal-card max-w-[520px]">
			<div class="space-y-3">
				<n-input
					v-model:value="announcementEditorContent"
					type="textarea"
					:autosize="{ minRows: 4, maxRows: 8 }"
					maxlength="500"
					placeholder="请输入公告内容"
				/>
				<div class="text-xs text-gray-400">{{ announcementEditorContent.length }}/500</div>
			</div>
			<template #footer>
				<div class="flex justify-end gap-2">
					<n-button @click="showAnnouncementEditorModal = false">取消</n-button>
					<n-button type="primary" :loading="announcementSaving" @click="submitAnnouncementEdit">保存</n-button>
				</div>
			</template>
		</n-modal>

			<n-modal v-model:show="showMediaModal" preset="card" title="媒体统计" class="app-modal-card max-w-[420px]">
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-lg border border-border-default/50 p-3 text-center">
					<div class="text-xs text-gray-400">群文件</div>
					<div class="text-lg font-semibold text-text-main mt-1">{{ mediaOverview?.fileCount ?? 0 }}</div>
				</div>
				<div class="rounded-lg border border-border-default/50 p-3 text-center">
					<div class="text-xs text-gray-400">图片/视频</div>
					<div class="text-lg font-semibold text-text-main mt-1">{{ mediaOverview?.imageVideoCount ?? 0 }}</div>
				</div>
				<div class="rounded-lg border border-border-default/50 p-3 text-center">
					<div class="text-xs text-gray-400">链接</div>
					<div class="text-lg font-semibold text-text-main mt-1">{{ mediaOverview?.linkCount ?? 0 }}</div>
				</div>
			</div>
			<div class="mt-3 text-xs text-gray-400">当前聚焦：{{ mediaFocusText }}</div>
		</n-modal>

			<n-modal v-model:show="showReportModal" preset="card" title="举报群聊" class="app-modal-card max-w-[520px]">
			<div class="space-y-3">
				<n-select v-model:value="reportReasonType" :options="reportReasonOptions" />
				<n-input
					v-model:value="reportDescription"
					type="textarea"
					:autosize="{ minRows: 3, maxRows: 6 }"
					placeholder="请输入举报说明（可选）"
				/>
				<n-input
					v-model:value="reportEvidenceUrlsText"
					placeholder="证据URL，多个用逗号分隔（可选）"
				/>
			</div>
			<template #footer>
				<div class="flex justify-end gap-2">
					<n-button @click="showReportModal = false">取消</n-button>
					<n-button type="error" :loading="reportSubmitting" @click="submitReport">提交举报</n-button>
				</div>
			</template>
		</n-modal>

			<n-modal v-model:show="showInviteLinkModal" preset="card" title="二维码/邀请链接" class="app-modal-card max-w-[420px]">
			<div class="space-y-3 text-sm">
				<div class="rounded-lg border border-border-default/50 p-3">
					<div class="text-xs text-gray-400">邀请链接</div>
					<div class="mt-1 break-all text-text-main">{{ inviteLink }}</div>
				</div>
				<n-button block secondary @click="copyInviteLink">复制邀请链接</n-button>
			</div>
		</n-modal>

				<n-modal v-model:show="showChatBackgroundModal" preset="card" title="聊天背景" class="app-modal-card max-w-[420px]">
			<div class="space-y-3">
				<n-select v-model:value="chatBackgroundTheme" :options="chatBackgroundOptions" />
				<div class="h-20 rounded-lg border border-border-default/50" :class="chatBackgroundClass" />
				<div class="text-xs text-gray-400">该设置仅本地生效。</div>
				</div>
			</n-modal>

			<AvatarUploadEditor
				ref="groupAvatarUploadEditorRef"
				title="编辑群头像"
				:upload-url="groupAvatarUploadUrl"
				@uploaded="handleGroupAvatarUploaded"
				@uploading-change="handleGroupAvatarUploadingChange"
			/>
		</div>
	</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
	NAvatar,
	NButton,
	NEmpty,
	NInput,
	NModal,
	NSelect,
	NSpin,
	NTag,
	useMessage,
} from 'naive-ui'
import AvatarUploadEditor from '@renderer/components/AvatarUploadEditor.vue'
import { useFriendStore } from '@renderer/stores/friend'
import { useChatStore, type ChatItem } from '@renderer/stores/chat'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import GroupSettingsHeader from '@renderer/components/groupSettings/GroupSettingsHeader.vue'
import GroupInfoCard from '@renderer/components/groupSettings/GroupInfoCard.vue'
import MemberPreview from '@renderer/components/groupSettings/MemberPreview.vue'
import SettingSection from '@renderer/components/groupSettings/SettingSection.vue'
import SwitchRow from '@renderer/components/groupSettings/SwitchRow.vue'
import LinkRow from '@renderer/components/groupSettings/LinkRow.vue'
import DangerZone from '@renderer/components/groupSettings/DangerZone.vue'
import {
	groupChatApi,
	type AnnouncementPermission,
	type GroupAnnouncement,
	type GroupMediaOverview,
	type GroupMember,
	type GroupMembersLegacyData,
	type GroupMembersPageData,
	type GroupProfilePatchPayload,
	type GroupProfile,
	type GroupRole,
	type GroupUserSettings,
	type InviteMode,
} from '@renderer/services/groupChatApi'

type ConfirmActionType = 'clear' | 'quit' | 'disband' | null
type MemberModalMode = 'view' | 'remove' | 'manage'
type MediaFocus = 'file' | 'imageVideo' | 'link'
type GroupMySettingsPatch = Partial<
	Pick<GroupUserSettings, 'messageMute' | 'chatPinned' | 'saveToContacts'>
>
type GroupPermissionsPatch = Partial<
	Pick<
		GroupProfile,
		'inviteMode' | 'memberCanEditGroupName' | 'joinVerificationEnabled'
	>
>

interface MemberItem {
	account: string
	name: string
	avatarUrl?: string
	role: GroupRole
}

interface GroupSettingsLocalCache {
	version: 1
	account: string
	groupNo: string
	mySettings: Required<
		Pick<GroupUserSettings, 'messageMute' | 'chatPinned' | 'saveToContacts'>
	>
	permissions: {
		inviteMode: InviteMode
		memberCanEditGroupName: boolean
		joinVerificationEnabled: boolean
	}
	updatedAt: number
}

const props = defineProps<{
	group: ChatItem
	members: GroupMember[]
}>()

const emit = defineEmits<{
	(e: 'close'): void
	(e: 'quit-group'): void
	(e: 'disband-group'): void
	(e: 'clear-history'): void
}>()

const chatStore = useChatStore()
const friendStore = useFriendStore()
const userInfoStore = useUserInfoStore()
const message = useMessage()

const showConfirmModal = ref(false)
const confirmType = ref<ConfirmActionType>(null)
const confirmInput = ref('')

const showProfileEditorModal = ref(false)
const profileEditorSaving = ref(false)
const profileEditorGroupName = ref('')
const profileEditorAvatarUrl = ref('')
const profileEditorSummary = ref('')
const profileAvatarUploading = ref(false)
const groupAvatarUploadEditorRef = ref<{ openFileDialog: () => void } | null>(null)

const messageMute = ref(false)
const chatPinned = ref(Boolean(props.group.isPinned))
const saveToContacts = ref(false)
const memberCanEditGroupName = ref(false)
const newMemberVerify = ref(true)
const invitePermission = ref<InviteMode>('ADMIN_ONLY')
const announcementPermission = ref<AnnouncementPermission>('OWNER_ADMIN')
const latestAnnouncement = ref<GroupAnnouncement | null>(null)
const mediaOverview = ref<GroupMediaOverview | null>(null)
const profileFromApi = ref<GroupProfile | null>(null)
const previewMembers = ref<GroupMember[]>([])

const showMembersModal = ref(false)
const membersModalMode = ref<MemberModalMode>('view')
const membersLoading = ref(false)
const membersList = ref<GroupMember[]>([])
const membersPage = ref(1)
const membersSize = ref(20)
const membersTotal = ref(0)
const membersTotalPages = ref(1)
const membersKeyword = ref('')
const membersRoleFilter = ref<GroupRole | 'ALL'>('ALL')

const showInviteModal = ref(false)
const inviteSubmitting = ref(false)
const inviteAccounts = ref<string[]>([])

const showAnnouncementModal = ref(false)
const announcementsLoading = ref(false)
const announcementsList = ref<GroupAnnouncement[]>([])

const showAnnouncementEditorModal = ref(false)
const announcementEditorContent = ref('')
const announcementSaving = ref(false)

const showMediaModal = ref(false)
const mediaFocus = ref<MediaFocus>('file')

const showReportModal = ref(false)
const reportSubmitting = ref(false)
const reportReasonType = ref('SPAM')
const reportDescription = ref('')
const reportEvidenceUrlsText = ref('')

const showInviteLinkModal = ref(false)
const showChatBackgroundModal = ref(false)
const chatBackgroundTheme = ref<'light' | 'gray' | 'dark'>('light')

let suppressMySettingsWatch = false
let suppressPermissionWatch = false
const GROUP_SETTINGS_CACHE_VERSION = 1

const roleLabel = computed(() => {
	const role = profileFromApi.value?.myRole || props.group.myRole || 'MEMBER'
	if (role === 'OWNER') return '群主'
	if (role === 'ADMIN') return '管理员'
	return '群成员'
})

const isOwner = computed(
	() => (profileFromApi.value?.myRole || props.group.myRole || 'MEMBER') === 'OWNER',
)
const canManage = computed(() => {
	const role = profileFromApi.value?.myRole || props.group.myRole || 'MEMBER'
	return role === 'OWNER' || role === 'ADMIN'
})
const canEditProfile = computed(() => {
	if (canManage.value) return true
	return memberCanEditGroupName.value
})

const groupName = computed(
	() => profileFromApi.value?.groupName?.trim() || props.group.name,
)
const groupAvatar = computed(
	() => profileFromApi.value?.groupAvatarUrl?.trim() || props.group.avatar,
)
const profileEditorAvatarPreview = computed(
	() => profileEditorAvatarUrl.value.trim() || groupAvatar.value,
)
const groupAvatarUploadUrl = `${import.meta.env.VITE_API_URL}/files/update/avatar`

const groupSummary = computed(
	() =>
		profileFromApi.value?.summary?.trim() ||
		props.group.announcement?.trim() ||
		'暂无群简介',
)

const announcementBrief = computed(() => {
	const content =
		latestAnnouncement.value?.content?.trim() ||
		props.group.announcement?.trim() ||
		'暂无公告'
	if (content.length <= 18) return content
	return `${content.slice(0, 18)}...`
})

const memberPreview = computed<MemberItem[]>(() => {
	const source = previewMembers.value.length
		? previewMembers.value
		: props.members
	if (source.length) {
		return source.slice(0, 9).map((member) => ({
			account: member.account,
			name: member.name?.trim() || member.account,
			avatarUrl: member.avatarUrl,
			role: member.role,
		}))
	}
	return [
		{ account: '10001', name: '群主', role: 'OWNER' },
		{ account: '10002', name: '管理员', role: 'ADMIN' },
	]
})

const resolvedMemberCount = computed(() => {
	const fromApi = profileFromApi.value?.memberCount
	if (typeof fromApi === 'number' && Number.isFinite(fromApi)) return fromApi
	if (props.group.memberCount) return props.group.memberCount
	return memberPreview.value.length
})

const invitePermissionLabel = computed(() =>
	invitePermission.value === 'ALL' ? '所有人' : '仅管理员',
)

const announcementPermissionLabel = computed(() =>
	announcementPermission.value === 'OWNER_ONLY' ? '仅群主' : '群主/管理员',
)

const confirmDescription = computed(() => {
	if (confirmType.value === 'clear') return '确认清空当前聊天记录吗？'
	if (confirmType.value === 'quit') return '确认退出当前群聊吗？'
	if (confirmType.value === 'disband') {
		return `该操作不可恢复。请输入群名称“${groupName.value}”确认解散。`
	}
	return '确认执行当前操作？'
})

const confirmDisabled = computed(() => {
	if (confirmType.value !== 'disband') return false
	return confirmInput.value.trim() !== groupName.value.trim()
})

const groupNo = computed(() => props.group.groupNo?.trim() || '')

const resolveCurrentAccount = (): string => {
	return userInfoStore.account?.trim() || 'anonymous'
}

const getSettingsCacheKey = (): string => {
	return `group-settings-cache:v${GROUP_SETTINGS_CACHE_VERSION}:${resolveCurrentAccount()}:${groupNo.value}`
}

const buildLocalCacheSnapshot = (): GroupSettingsLocalCache => {
	return {
		version: 1,
		account: resolveCurrentAccount(),
		groupNo: groupNo.value,
		mySettings: {
			messageMute: Boolean(messageMute.value),
			chatPinned: Boolean(chatPinned.value),
			saveToContacts: Boolean(saveToContacts.value),
		},
		permissions: {
			inviteMode: invitePermission.value,
			memberCanEditGroupName: Boolean(memberCanEditGroupName.value),
			joinVerificationEnabled: Boolean(newMemberVerify.value),
		},
		updatedAt: Date.now(),
	}
}

const readLocalSettingsCache = (): GroupSettingsLocalCache | null => {
	if (!groupNo.value) return null
	try {
		const raw = window.localStorage.getItem(getSettingsCacheKey())
		if (!raw) return null
		const parsed = JSON.parse(raw) as GroupSettingsLocalCache
		if (parsed?.version !== 1) return null
		if (parsed.groupNo !== groupNo.value) return null
		if (parsed.account !== resolveCurrentAccount()) return null
		return parsed
	} catch {
		return null
	}
}

const persistLocalSettingsCache = (): void => {
	if (!groupNo.value) return
	try {
		const snapshot = buildLocalCacheSnapshot()
		window.localStorage.setItem(getSettingsCacheKey(), JSON.stringify(snapshot))
	} catch (error) {
		console.warn('写入群设置本地缓存失败:', error)
	}
}

const applyLocalSettingsCache = (): void => {
	const cache = readLocalSettingsCache()
	if (!cache) return
	suppressMySettingsWatch = true
	suppressPermissionWatch = true
	messageMute.value = cache.mySettings.messageMute
	chatPinned.value = cache.mySettings.chatPinned
	saveToContacts.value = cache.mySettings.saveToContacts
	invitePermission.value = cache.permissions.inviteMode
	memberCanEditGroupName.value = cache.permissions.memberCanEditGroupName
	newMemberVerify.value = cache.permissions.joinVerificationEnabled
	setTimeout(() => {
		suppressMySettingsWatch = false
		suppressPermissionWatch = false
	}, 0)
}

const memberRoleOptions = [
	{ label: '全部角色', value: 'ALL' },
	{ label: '群主', value: 'OWNER' },
	{ label: '管理员', value: 'ADMIN' },
	{ label: '成员', value: 'MEMBER' },
]

const reportReasonOptions = [
	{ label: '垃圾广告', value: 'SPAM' },
	{ label: '违规内容', value: 'ILLEGAL' },
	{ label: '骚扰辱骂', value: 'HARASS' },
]

const chatBackgroundOptions = [
	{ label: '明亮', value: 'light' },
	{ label: '灰调', value: 'gray' },
	{ label: '深色', value: 'dark' },
]

const chatBackgroundClass = computed(() => {
	if (chatBackgroundTheme.value === 'dark') return 'bg-zinc-800'
	if (chatBackgroundTheme.value === 'gray') return 'bg-gray-200'
	return 'bg-blue-50'
})

const mediaFocusText = computed(() => {
	if (mediaFocus.value === 'file') return '群文件'
	if (mediaFocus.value === 'imageVideo') return '图片/视频'
	return '链接'
})

const inviteFriendOptions = computed(() => {
	const memberSet = new Set(membersList.value.map((item) => item.account))
	return friendStore.friends
		.filter((friend) => !memberSet.has(friend.id))
		.map((friend) => ({
			label: `${friend.remark || friend.name} (${friend.id})`,
			value: friend.id,
		}))
})

const inviteLink = computed(() => {
	const no = groupNo.value || 'unknown'
	return `https://im.example.com/invite?groupNo=${encodeURIComponent(no)}`
})

const normalizeMembersPayload = (
	payload?: GroupMembersLegacyData | GroupMembersPageData,
): {
	records: GroupMember[]
	page: number
	size: number
	total: number
	totalPages: number
} => {
	if (!payload) {
		return {
			records: [],
			page: 1,
			size: membersSize.value,
			total: 0,
			totalPages: 1,
		}
	}
	const pagedRecords =
		'records' in payload && Array.isArray(payload.records)
			? payload.records
			: []
	const legacyRecords =
		'members' in payload && Array.isArray(payload.members)
			? payload.members
			: []
	const records = pagedRecords.length ? pagedRecords : legacyRecords
	const total =
		'total' in payload && typeof payload.total === 'number'
			? payload.total
			: 'count' in payload && typeof payload.count === 'number'
				? payload.count
				: records.length
	const page =
		'page' in payload && typeof payload.page === 'number'
			? payload.page
			: 1
	const size =
		'size' in payload && typeof payload.size === 'number'
			? payload.size
			: membersSize.value
	const totalPages =
		'totalPages' in payload && typeof payload.totalPages === 'number'
			? payload.totalPages
			: Math.max(1, Math.ceil(total / Math.max(1, size)))
	return {
		records,
		page,
		size,
		total,
		totalPages,
	}
}

const roleText = (role: GroupRole): string => {
	if (role === 'OWNER') return '群主'
	if (role === 'ADMIN') return '管理员'
	return '成员'
}

const canRemoveMember = (member: GroupMember): boolean => {
	const myRole = profileFromApi.value?.myRole || props.group.myRole || 'MEMBER'
	if (member.account === userInfoStore.account) return false
	if (myRole === 'OWNER') return member.role !== 'OWNER'
	if (myRole === 'ADMIN') return member.role === 'MEMBER'
	return false
}

const notify = (text: string): void => {
	message.info(text)
}

const syncGroupDisplayToSession = (profile: GroupProfile): void => {
	const targetGroupNo = groupNo.value
	if (!targetGroupNo) return
	const target = chatStore.chatlist.find(
		(item) =>
			item.chatType === 'GROUP' && item.groupNo?.trim() === targetGroupNo,
	)
	if (!target) return
	target.name = profile.groupName?.trim() || target.name
	if (profile.groupAvatarUrl?.trim()) {
		target.avatar = profile.groupAvatarUrl.trim()
	}
	target.announcement = profile.summary?.trim() || target.announcement
}

const openProfileEditor = (): void => {
	if (!canEditProfile.value) {
		message.warning('当前无权限编辑群资料')
		return
	}
	profileEditorGroupName.value = groupName.value
	profileEditorAvatarUrl.value = profileFromApi.value?.groupAvatarUrl?.trim() || ''
	profileEditorSummary.value = profileFromApi.value?.summary?.trim() || ''
	showProfileEditorModal.value = true
}

const openGroupAvatarUpload = (): void => {
	if (!canManage.value) {
		message.warning('仅群主/管理员可修改群头像')
		return
	}
	groupAvatarUploadEditorRef.value?.openFileDialog()
}

const handleGroupAvatarUploaded = (url: string): void => {
	profileEditorAvatarUrl.value = url.trim()
	message.success('群头像上传成功')
}

const handleGroupAvatarUploadingChange = (uploading: boolean): void => {
	profileAvatarUploading.value = uploading
}

const submitProfileEdit = async (): Promise<void> => {
	if (!groupNo.value) return
	const nextGroupName = profileEditorGroupName.value.trim()
	if (!nextGroupName) {
		message.warning('群名称不能为空')
		return
	}
	const payload: GroupProfilePatchPayload = {
		groupName: nextGroupName,
	}
	if (canManage.value) {
		payload.groupAvatarUrl = profileEditorAvatarUrl.value.trim()
		payload.summary = profileEditorSummary.value.trim()
	}
	profileEditorSaving.value = true
	try {
		const response = await groupChatApi.updateGroupProfile(groupNo.value, payload)
		const nextProfile = response.data?.data
		if (nextProfile) {
			profileFromApi.value = nextProfile
			applyPermissions(nextProfile)
			syncGroupDisplayToSession(nextProfile)
		}
		showProfileEditorModal.value = false
		message.success('群资料已更新')
	} catch (error) {
		console.warn('更新群资料失败:', error)
		message.error('群资料更新失败')
	} finally {
		profileEditorSaving.value = false
	}
}

const copyGroupNo = async (): Promise<void> => {
	if (!groupNo.value) return
	try {
		await navigator.clipboard.writeText(groupNo.value)
		message.success('群ID已复制')
	} catch {
		message.error('复制失败，请手动复制')
	}
}

const copyInviteLink = async (): Promise<void> => {
	try {
		await navigator.clipboard.writeText(inviteLink.value)
		message.success('邀请链接已复制')
	} catch {
		message.error('复制失败，请手动复制')
	}
}

const applyMySettings = (settings?: GroupUserSettings | null): void => {
	if (!settings) return
	suppressMySettingsWatch = true
	messageMute.value = Boolean(settings.messageMute)
	chatPinned.value = Boolean(settings.chatPinned)
	saveToContacts.value = Boolean(settings.saveToContacts)
	setTimeout(() => {
		suppressMySettingsWatch = false
	}, 0)
}

const applyPermissions = (profile?: GroupProfile | null): void => {
	if (!profile) return
	suppressPermissionWatch = true
	invitePermission.value = profile.inviteMode || 'ADMIN_ONLY'
	memberCanEditGroupName.value = Boolean(profile.memberCanEditGroupName)
	newMemberVerify.value = Boolean(profile.joinVerificationEnabled)
	announcementPermission.value =
		profile.announcementPermission || 'OWNER_ADMIN'
	setTimeout(() => {
		suppressPermissionWatch = false
	}, 0)
}

const diffMySettingsWithCache = (
	serverSettings?: GroupUserSettings | null,
): GroupMySettingsPatch => {
	const cache = readLocalSettingsCache()
	if (!cache) return {}
	const patch: GroupMySettingsPatch = {}
	if (cache.mySettings.messageMute !== Boolean(serverSettings?.messageMute)) {
		patch.messageMute = cache.mySettings.messageMute
	}
	if (cache.mySettings.chatPinned !== Boolean(serverSettings?.chatPinned)) {
		patch.chatPinned = cache.mySettings.chatPinned
	}
	if (cache.mySettings.saveToContacts !== Boolean(serverSettings?.saveToContacts)) {
		patch.saveToContacts = cache.mySettings.saveToContacts
	}
	return patch
}

const diffPermissionsWithCache = (
	serverProfile?: GroupProfile | null,
): GroupPermissionsPatch => {
	const cache = readLocalSettingsCache()
	if (!cache) return {}
	const patch: GroupPermissionsPatch = {}
	if (cache.permissions.inviteMode !== (serverProfile?.inviteMode || 'ADMIN_ONLY')) {
		patch.inviteMode = cache.permissions.inviteMode
	}
	if (
		cache.permissions.memberCanEditGroupName !==
		Boolean(serverProfile?.memberCanEditGroupName)
	) {
		patch.memberCanEditGroupName = cache.permissions.memberCanEditGroupName
	}
	if (
		cache.permissions.joinVerificationEnabled !==
		Boolean(serverProfile?.joinVerificationEnabled)
	) {
		patch.joinVerificationEnabled = cache.permissions.joinVerificationEnabled
	}
	return patch
}

const loadMembersPage = async (page = 1): Promise<void> => {
	if (!groupNo.value) return
	membersLoading.value = true
	try {
		const response = await groupChatApi.getGroupMembers(groupNo.value, {
			page,
			size: membersSize.value,
			keyword: membersKeyword.value.trim() || undefined,
			role:
				membersRoleFilter.value === 'ALL'
					? undefined
					: membersRoleFilter.value,
		})
		const normalized = normalizeMembersPayload(response.data?.data)
		membersList.value = normalized.records
		membersPage.value = normalized.page
		membersSize.value = normalized.size
		membersTotal.value = normalized.total
		membersTotalPages.value = normalized.totalPages
	} catch (error) {
		console.warn('加载成员列表失败:', error)
		message.error('加载成员列表失败')
	} finally {
		membersLoading.value = false
	}
}

const loadGroupSettingsDetail = async (): Promise<void> => {
	if (!groupNo.value) return
	try {
		const [detailRes, latestAnnouncementRes, previewRes] = await Promise.all([
			groupChatApi.getGroupSettingsDetail(groupNo.value),
			groupChatApi.getLatestAnnouncement(groupNo.value),
			groupChatApi.getGroupMembersPreview(groupNo.value).catch(() => null),
		])
		const detail = detailRes.data?.data
		profileFromApi.value = detail?.groupProfile || null
		mediaOverview.value = detail?.mediaOverview || null
		latestAnnouncement.value =
			latestAnnouncementRes.data?.data || detail?.latestAnnouncement || null
		applyMySettings(detail?.mySettings)
		applyPermissions(detail?.groupProfile)
		if (previewRes?.data?.data && Array.isArray(previewRes.data.data)) {
			previewMembers.value = previewRes.data.data
		}

		// 云端差异更新：仅将本地缓存与云端有差异的字段 Patch 回云端
		const myPatch = diffMySettingsWithCache(detail?.mySettings)
		if (Object.keys(myPatch).length) {
			await updateMySettingsRemote(myPatch, {
				reloadOnError: false,
				silent: true,
			})
		}
		if (canManage.value) {
			const permissionPatch = diffPermissionsWithCache(detail?.groupProfile)
			if (Object.keys(permissionPatch).length) {
				await updatePermissionsRemote(permissionPatch, {
					reloadOnError: false,
					silent: true,
				})
			}
		}
		persistLocalSettingsCache()
	} catch (error) {
		console.warn('加载群设置详情失败:', error)
		message.error('加载群设置失败，请稍后重试')
	}
}

const updateMySettingsRemote = async (
	payload: GroupMySettingsPatch,
	options?: {
		reloadOnError?: boolean
		silent?: boolean
	},
): Promise<void> => {
	if (!groupNo.value) return
	try {
		const response = await groupChatApi.updateMySettings(groupNo.value, payload)
		applyMySettings(response.data?.data)
		if (typeof payload.chatPinned === 'boolean') {
			if (payload.chatPinned) {
				chatStore.pinChat(props.group.id)
			} else {
				chatStore.unpinChat(props.group.id)
			}
		}
		persistLocalSettingsCache()
		if (!options?.silent) {
			message.success('设置已同步')
		}
	} catch (error) {
		console.warn('更新我的群设置失败:', error)
		if (!options?.silent) {
			message.error('设置保存失败')
		}
		if (options?.reloadOnError !== false) {
			await loadGroupSettingsDetail()
		}
	}
}

const updatePermissionsRemote = async (
	payload: GroupPermissionsPatch,
	options?: {
		reloadOnError?: boolean
		silent?: boolean
	},
): Promise<void> => {
	if (!groupNo.value || !canManage.value) return
	try {
		const response = await groupChatApi.updatePermissions(groupNo.value, payload)
		const profile = response.data?.data
		if (profile) {
			profileFromApi.value = profile
			applyPermissions(profile)
		}
		persistLocalSettingsCache()
		if (!options?.silent) {
			message.success('权限已同步')
		}
	} catch (error) {
		console.warn('更新群权限失败:', error)
		if (!options?.silent) {
			message.error('权限更新失败')
		}
		if (options?.reloadOnError !== false) {
			await loadGroupSettingsDetail()
		}
	}
}

const toggleInvitePermission = async (): Promise<void> => {
	if (!canManage.value) {
		message.warning('仅群主/管理员可修改')
		return
	}
	const nextValue: InviteMode =
		invitePermission.value === 'ALL' ? 'ADMIN_ONLY' : 'ALL'
	invitePermission.value = nextValue
	persistLocalSettingsCache()
	await updatePermissionsRemote(
		{ inviteMode: nextValue },
		{ silent: true },
	)
	message.success(`已切换为：${nextValue === 'ALL' ? '所有人' : '仅管理员'}`)
}

const openMembersModal = (mode: MemberModalMode): void => {
	membersModalMode.value = mode
	showMembersModal.value = true
	void loadMembersPage(1)
}

const openInviteModal = async (): Promise<void> => {
	if (!canManage.value) {
		message.warning('仅群主/管理员可邀请成员')
		return
	}
	if (!friendStore.friends.length) {
		await friendStore.fetchFriends()
	}
	if (!membersList.value.length) {
		await loadMembersPage(1)
	}
	inviteAccounts.value = []
	showInviteModal.value = true
}

const submitInviteMembers = async (): Promise<void> => {
	if (!groupNo.value || !inviteAccounts.value.length) return
	inviteSubmitting.value = true
	try {
		const response = await groupChatApi.batchInviteMembers(
			groupNo.value,
			inviteAccounts.value,
		)
		const success = response.data?.data?.successAccounts || []
		const failed = response.data?.data?.failed || []
		if (failed.length) {
			message.warning(`成功 ${success.length} 人，失败 ${failed.length} 人`)
		} else {
			message.success(`邀请成功 ${success.length} 人`)
		}
		showInviteModal.value = false
		await Promise.all([loadMembersPage(membersPage.value), loadGroupSettingsDetail()])
	} catch (error) {
		console.warn('批量邀请失败:', error)
		message.error('邀请失败，请稍后再试')
	} finally {
		inviteSubmitting.value = false
	}
}

const removeMember = async (member: GroupMember): Promise<void> => {
	if (!groupNo.value) return
	const ok = window.confirm(`确认移除成员 ${member.name || member.account} 吗？`)
	if (!ok) return
	try {
		await groupChatApi.removeMember(groupNo.value, member.account)
		message.success('成员已移除')
		await Promise.all([loadMembersPage(membersPage.value), loadGroupSettingsDetail()])
	} catch (error) {
		console.warn('移除成员失败:', error)
		message.error('移除成员失败')
	}
}

const toggleMemberRole = async (member: GroupMember): Promise<void> => {
	if (!groupNo.value || !isOwner.value) return
	const nextRole: GroupRole = member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'
	try {
		await groupChatApi.updateMemberRole(groupNo.value, member.account, nextRole)
		message.success('成员角色已更新')
		await Promise.all([loadMembersPage(membersPage.value), loadGroupSettingsDetail()])
	} catch (error) {
		console.warn('更新成员角色失败:', error)
		message.error('更新成员角色失败')
	}
}

const openAnnouncementHistory = async (): Promise<void> => {
	if (!groupNo.value) return
	showAnnouncementModal.value = true
	announcementsLoading.value = true
	try {
		const response = await groupChatApi.getAnnouncements(groupNo.value, 1, 30)
		announcementsList.value = response.data?.data?.records || []
	} catch (error) {
		console.warn('加载公告历史失败:', error)
		announcementsList.value = []
		message.error('加载公告历史失败')
	} finally {
		announcementsLoading.value = false
	}
}

const openAnnouncementEditor = (): void => {
	if (!canManage.value || !groupNo.value) {
		message.warning('仅群主/管理员可发布公告')
		return
	}
	announcementEditorContent.value = latestAnnouncement.value?.content?.trim() || ''
	showAnnouncementEditorModal.value = true
}

const submitAnnouncementEdit = async (): Promise<void> => {
	if (!groupNo.value) return
	const normalized = announcementEditorContent.value.trim()
	if (!normalized) {
		message.warning('公告内容不能为空')
		return
	}
	announcementSaving.value = true
	try {
		if (latestAnnouncement.value?.announcementId) {
			const response = await groupChatApi.updateAnnouncementById(
				groupNo.value,
				latestAnnouncement.value.announcementId,
				normalized,
			)
			latestAnnouncement.value = response.data?.data || null
		} else {
			const response = await groupChatApi.createAnnouncement(groupNo.value, normalized)
			latestAnnouncement.value = response.data?.data || null
		}
		message.success('公告已更新')
		showAnnouncementEditorModal.value = false
	} catch (error) {
		console.warn('更新公告失败:', error)
		message.error('公告更新失败')
	} finally {
		announcementSaving.value = false
	}
}

const openMediaOverview = async (focus: MediaFocus): Promise<void> => {
	mediaFocus.value = focus
	showMediaModal.value = true
	if (!groupNo.value) return
	try {
		const response = await groupChatApi.getMediaOverview(groupNo.value)
		mediaOverview.value = response.data?.data || mediaOverview.value
	} catch (error) {
		console.warn('加载媒体统计失败:', error)
	}
}

const submitReport = async (): Promise<void> => {
	if (!groupNo.value) return
	reportSubmitting.value = true
	try {
		const evidenceUrls = reportEvidenceUrlsText.value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean)
		const response = await groupChatApi.reportGroup(groupNo.value, {
			reasonType: reportReasonType.value,
			description: reportDescription.value,
			evidenceUrls,
		})
		const reportNo = response.data?.data?.reportNo || '-'
		message.success(`举报已提交，单号：${reportNo}`)
		showReportModal.value = false
		reportDescription.value = ''
		reportEvidenceUrlsText.value = ''
	} catch (error) {
		console.warn('举报失败:', error)
		message.error('举报提交失败')
	} finally {
		reportSubmitting.value = false
	}
}

const openConfirm = (type: ConfirmActionType): void => {
	confirmType.value = type
	confirmInput.value = ''
	showConfirmModal.value = true
}

const confirmDangerAction = async (): Promise<void> => {
	if (confirmDisabled.value || !confirmType.value || !groupNo.value) return
	const type = confirmType.value
	showConfirmModal.value = false
	if (type === 'clear') {
		try {
			await groupChatApi.clearMessages(groupNo.value)
			emit('clear-history')
			message.success('聊天记录已清空')
		} catch (error) {
			console.warn('清空聊天记录失败:', error)
			message.error('清空聊天记录失败')
		}
		return
	}
	if (type === 'quit') {
		emit('quit-group')
		return
	}
	if (type === 'disband') {
		emit('disband-group')
	}
}

watch(messageMute, (value) => {
	if (suppressMySettingsWatch) return
	persistLocalSettingsCache()
	void updateMySettingsRemote({ messageMute: value })
})

watch(chatPinned, (value) => {
	if (suppressMySettingsWatch) return
	persistLocalSettingsCache()
	void updateMySettingsRemote({ chatPinned: value })
})

watch(saveToContacts, (value) => {
	if (suppressMySettingsWatch) return
	persistLocalSettingsCache()
	void updateMySettingsRemote({ saveToContacts: value })
})

watch(memberCanEditGroupName, (value) => {
	if (suppressPermissionWatch) return
	persistLocalSettingsCache()
	void updatePermissionsRemote({ memberCanEditGroupName: value })
})

watch(newMemberVerify, (value) => {
	if (suppressPermissionWatch) return
	persistLocalSettingsCache()
	void updatePermissionsRemote({ joinVerificationEnabled: value })
})

watch(
	() => props.group.groupNo,
	() => {
		applyLocalSettingsCache()
		void loadGroupSettingsDetail()
	},
)

onMounted(() => {
	applyLocalSettingsCache()
	void loadGroupSettingsDetail()
})
</script>
