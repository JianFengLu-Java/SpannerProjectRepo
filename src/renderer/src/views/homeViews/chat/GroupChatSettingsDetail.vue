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
				:avatar="group.avatar"
				:group-name="group.name"
				:group-no="group.groupNo || '-'"
				:summary="groupSummary"
				:role-label="roleLabel"
				:can-edit="canManage"
				@copy-group-no="copyGroupNo"
				@open-qr="notify('邀请链接功能开发中')"
				@edit-profile="notify('群资料编辑页占位')"
			/>

			<MemberPreview
				:members="memberPreview"
				:member-count="group.memberCount || memberPreview.length"
				:can-manage="canManage"
				@view-all="notify('成员列表页占位')"
				@add-member="notify('添加成员页占位')"
				@remove-member="notify('移除成员页占位')"
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
					description="仅清除当前设备的聊天记录"
					@click="openConfirm('clear')"
				/>
				<LinkRow
					label="聊天背景"
					description="自定义本群聊天背景"
					@click="notify('聊天背景设置占位')"
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
					value="仅群主/管理员"
					@click="notify('公告权限固定为管理角色')"
				/>
				<LinkRow
					v-if="canManage"
					label="黑名单/禁言管理"
					description="统一管理违规成员与发言权限"
					@click="notify('黑名单/禁言管理页占位')"
				/>
				<LinkRow
					label="举报群聊"
					description="提交违规信息与截图证据"
					danger
					@click="notify('举报群聊流程占位')"
				/>
			</SettingSection>

			<SettingSection title="群公告">
				<LinkRow
					label="最近公告"
					:value="announcementBrief"
					@click="notify('公告详情页占位')"
				/>
				<LinkRow
					v-if="canManage"
					label="发布/编辑公告"
					description="发布后群成员将收到公告提醒"
					@click="notify('公告编辑页占位')"
				/>
			</SettingSection>

			<SettingSection title="文件与媒体">
				<LinkRow
					label="群文件"
					description="查看和管理共享文件"
					@click="notify('群文件页占位')"
				/>
				<LinkRow
					label="图片/视频"
					description="按时间查看媒体内容"
					@click="notify('媒体页占位')"
				/>
				<LinkRow
					label="链接"
					description="浏览群内分享链接"
					@click="notify('链接聚合页占位')"
				/>
			</SettingSection>

			<DangerZone
				:is-owner="isOwner"
				@quit="openConfirm('quit')"
				@disband="openConfirm('disband')"
			/>
		</div>

		<n-modal v-model:show="showConfirmModal" preset="card" :mask-closable="false" title="操作确认" class="max-w-[360px]">
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
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { NButton, NInput, NModal, useMessage } from 'naive-ui'
import GroupSettingsHeader from '@renderer/components/groupSettings/GroupSettingsHeader.vue'
import GroupInfoCard from '@renderer/components/groupSettings/GroupInfoCard.vue'
import MemberPreview from '@renderer/components/groupSettings/MemberPreview.vue'
import SettingSection from '@renderer/components/groupSettings/SettingSection.vue'
import SwitchRow from '@renderer/components/groupSettings/SwitchRow.vue'
import LinkRow from '@renderer/components/groupSettings/LinkRow.vue'
import DangerZone from '@renderer/components/groupSettings/DangerZone.vue'
import type { ChatItem } from '@renderer/stores/chat'
import type { GroupMember } from '@renderer/services/groupChatApi'

type ConfirmActionType = 'clear' | 'quit' | 'disband' | null

interface MemberItem {
	account: string
	name: string
	avatarUrl?: string
	role: 'OWNER' | 'ADMIN' | 'MEMBER'
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

const message = useMessage()

const messageMute = ref(false)
const chatPinned = ref(Boolean(props.group.isPinned))
const saveToContacts = ref(false)
const memberCanEditGroupName = ref(false)
const newMemberVerify = ref(true)
const invitePermission = ref<'ALL' | 'ADMIN_ONLY'>('ADMIN_ONLY')

const showConfirmModal = ref(false)
const confirmType = ref<ConfirmActionType>(null)
const confirmInput = ref('')

const roleLabel = computed(() => {
	const role = props.group.myRole || 'MEMBER'
	if (role === 'OWNER') return '群主'
	if (role === 'ADMIN') return '管理员'
	return '群成员'
})

const isOwner = computed(() => (props.group.myRole || 'MEMBER') === 'OWNER')
const canManage = computed(() => {
	const role = props.group.myRole || 'MEMBER'
	return role === 'OWNER' || role === 'ADMIN'
})

const groupSummary = computed(() => props.group.announcement?.trim() || '暂无群简介')

const announcementBrief = computed(() => {
	const content = props.group.announcement?.trim() || '暂无公告'
	if (content.length <= 18) return content
	return `${content.slice(0, 18)}...`
})

const memberPreview = computed<MemberItem[]>(() => {
	if (props.members.length) {
		return props.members.map((member) => ({
			account: member.account,
			name: member.name?.trim() || member.account,
			avatarUrl: member.avatarUrl,
			role: member.role,
		}))
	}
	return [
		{ account: '10001', name: '群主', role: 'OWNER' },
		{ account: '10002', name: '管理员', role: 'ADMIN' },
		{ account: '10003', name: '成员A', role: 'MEMBER' },
		{ account: '10004', name: '成员B', role: 'MEMBER' },
	]
})

const invitePermissionLabel = computed(() =>
	invitePermission.value === 'ALL' ? '所有人' : '仅管理员',
)

const confirmDescription = computed(() => {
	if (confirmType.value === 'clear') return '确认清空当前聊天记录吗？'
	if (confirmType.value === 'quit') return '确认退出当前群聊吗？'
	if (confirmType.value === 'disband') {
		return `该操作不可恢复。请输入群名称“${props.group.name}”确认解散。`
	}
	return '确认执行当前操作？'
})

const confirmDisabled = computed(() => {
	if (confirmType.value !== 'disband') return false
	return confirmInput.value.trim() !== props.group.name.trim()
})

const notify = (text: string): void => {
	message.info(text)
}

const copyGroupNo = async (): Promise<void> => {
	const groupNo = props.group.groupNo?.trim()
	if (!groupNo) return
	try {
		await navigator.clipboard.writeText(groupNo)
		message.success('群ID已复制')
	} catch {
		message.error('复制失败，请手动复制')
	}
}

const toggleInvitePermission = (): void => {
	invitePermission.value =
		invitePermission.value === 'ALL' ? 'ADMIN_ONLY' : 'ALL'
	message.success(`已切换为：${invitePermissionLabel.value}`)
}

const openConfirm = (type: ConfirmActionType): void => {
	confirmType.value = type
	confirmInput.value = ''
	showConfirmModal.value = true
}

const confirmDangerAction = (): void => {
	if (confirmDisabled.value || !confirmType.value) return
	const type = confirmType.value
	showConfirmModal.value = false
	if (type === 'clear') {
		emit('clear-history')
		message.success('聊天记录已清空（模拟）')
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
</script>
