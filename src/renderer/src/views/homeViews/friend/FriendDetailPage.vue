<template>
	<div class="h-full w-full overflow-y-auto bg-page-bg pb-6">
		<header
			v-if="!embedded"
			class="sticky top-0 z-20 border-b border-border-default/50 bg-page-bg/95 backdrop-blur-xl"
		>
			<div class="mx-auto max-w-[960px] h-14 px-4 flex items-center justify-between">
				<n-button text @click="goBack">返回</n-button>
				<div class="text-sm font-semibold text-text-main">好友资料</div>
				<n-button text @click="showActionSheet = true">⋯</n-button>
			</div>
		</header>

		<main class="mx-auto max-w-[960px] px-4 space-y-4" :class="embedded ? 'pt-3' : 'pt-4'">
			<ProfileHeader
				:friend="friend"
				@copy-id="copyUserId"
				@message="onMessage"
				@voice-video="onVoiceVideo"
				@add-friend="onAddFriend"
				@preview-avatar="showAvatarPreview = true"
			/>

			<div v-if="friend.privacyLevel === 'private'" class="rounded-2xl border border-border-default/60 bg-card-bg p-6 text-center text-sm text-gray-500">
				对方设置隐私，仅展示基础信息。
			</div>

			<template v-else>
				<InfoSectionCard title="基本信息">
					<KeyValueRow label="性别" :value="friend.gender" />
					<KeyValueRow label="地区" :value="friend.region" />
					<KeyValueRow label="生日" :value="friend.birthday" />
					<KeyValueRow label="职业" :value="friend.occupation" />
				</InfoSectionCard>

				<InfoSectionCard title="社区信息">
					<KeyValueRow label="等级" :value="friend.badges.userLevel ? `Lv.${friend.badges.userLevel}` : undefined" />
					<KeyValueRow label="成长值" :value="friend.stats.growth" />
					<KeyValueRow label="发帖数" :value="friend.stats.posts" />
					<KeyValueRow label="获赞数" :value="friend.stats.likes" />
				</InfoSectionCard>

				<InfoSectionCard title="社交关系">
					<LinkRow label="共同好友" :value="friend.mutual.friendsCount" @click="onOpenMutualFriends" />
					<LinkRow label="共同群聊" :value="friend.mutual.groupsCount" @click="onOpenMutualGroups" />
				</InfoSectionCard>

				<InfoSectionCard title="备注与标签">
					<div class="px-4 py-3 border-t border-border-default/30 first:border-t-0">
						<div class="text-sm text-text-main mb-2">备注名</div>
						<n-input v-model:value="remarkName" placeholder="设置备注名" />
					</div>
					<div class="px-4 py-3 border-t border-border-default/30">
						<div class="text-sm text-text-main mb-2">标签</div>
						<n-select
							v-model:value="selectedTags"
							multiple
							clearable
							placeholder="选择标签"
							:options="tagOptions"
						/>
					</div>
				</InfoSectionCard>

				<InfoSectionCard title="来源信息" v-if="friend.source">
					<KeyValueRow label="添加来源" :value="friend.source" />
				</InfoSectionCard>

				<InfoSectionCard title="相册/动态预览">
					<div class="p-4">
						<MediaPreviewGrid
							:photos="friend.media.photos"
							:posts="friend.media.postsPreview"
							:privacy-blocked="isMediaHidden"
							@open-photo="onOpenPhoto"
							@open-post="onOpenPost"
						/>
					</div>
				</InfoSectionCard>
			</template>

			<InfoSectionCard title="隐私与安全设置">
				<SwitchRow label="消息免打扰" v-model:model-value="doNotDisturb" />
				<SwitchRow label="置顶聊天" v-model:model-value="pinChat" />
				<SwitchRow label="不看对方动态" v-model:model-value="muteTheirMoments" />
				<SwitchRow label="不让对方看我动态" v-model:model-value="hideMyMoments" />
				<SwitchRow
					label="拉黑"
					:model-value="isBlockedByMe"
					@update:model-value="onToggleBlock"
				/>
				<div v-if="isFriend" class="px-4 py-3 border-t border-border-default/30 first:border-t-0">
					<n-button type="error" ghost block @click="openDeleteConfirm">删除好友</n-button>
				</div>
				<LinkRow label="举报" description="向平台提交投诉" value="进入" @click="onReport" />
			</InfoSectionCard>
		</main>

		<ActionSheet
			:show="showActionSheet"
			:actions="actionItems"
			@close="showActionSheet = false"
			@select="onActionSelect"
		/>

		<ModalConfirm
			:show="confirmModal.show"
			:title="confirmModal.title"
			:content="confirmModal.content"
			:confirm-type="confirmModal.confirmType"
			:confirm-text="confirmModal.confirmText"
			@cancel="closeConfirm"
			@confirm="onConfirmAction"
		/>

		<n-modal :show="showAvatarPreview" @mask-click="showAvatarPreview = false">
			<div class="mx-auto mt-[90px] w-[420px] rounded-2xl overflow-hidden border border-border-default/60 bg-card-bg">
				<img :src="friend.avatar" alt="avatar" class="w-full h-[420px] object-cover" />
			</div>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NInput, NModal, NSelect, useMessage } from 'naive-ui'
import ActionSheet from '@renderer/components/friendDetail/ActionSheet.vue'
import type { ActionSheetItem } from '@renderer/components/friendDetail/ActionSheet.vue'
import InfoSectionCard from '@renderer/components/friendDetail/InfoSectionCard.vue'
import KeyValueRow from '@renderer/components/friendDetail/KeyValueRow.vue'
import LinkRow from '@renderer/components/friendDetail/LinkRow.vue'
import MediaPreviewGrid from '@renderer/components/friendDetail/MediaPreviewGrid.vue'
import ModalConfirm from '@renderer/components/friendDetail/ModalConfirm.vue'
import ProfileHeader from '@renderer/components/friendDetail/ProfileHeader.vue'
import SwitchRow from '@renderer/components/friendDetail/SwitchRow.vue'
import type { FriendModel, RelationshipStatus } from './friendDetail.types'

const props = withDefaults(
	defineProps<{
		friendData?: FriendModel | null
		embedded?: boolean
	}>(),
	{
		friendData: null,
		embedded: false,
	},
)

const emit = defineEmits<{
	(e: 'back'): void
	(e: 'message', friend: FriendModel): void
	(e: 'voice-video', friend: FriendModel): void
	(e: 'add-friend', friend: FriendModel): void
	(e: 'report', friend: FriendModel): void
	(e: 'delete-friend', friend: FriendModel): void
	(e: 'relationship-change', status: RelationshipStatus): void
}>()

const router = useRouter()
const message = useMessage()

const defaultFriend: FriendModel = {
	id: 'U1008673',
	nickname: 'Lina Hart',
	avatar:
		'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=520&q=80',
	bio: '生活在海边，热爱胶片和慢跑。',
	region: '上海',
	gender: '女',
	birthday: '1997-08-21',
	occupation: '产品设计师',
	onlineStatus: 'offline',
	lastActiveAt: '2 小时前',
	badges: {
		isVip: true,
		vipLevel: 5,
		verified: true,
		userLevel: 29,
	},
	stats: {
		posts: 146,
		likes: 3021,
		growth: 18900,
		followers: 590,
	},
	relationshipStatus: 'friend',
	privacyLevel: 'public',
	remarkName: '琳娜',
	tags: ['同事', 'UI 讨论'],
	mutual: {
		friendsCount: 8,
		groupsCount: 3,
	},
	source: '通过群聊添加',
	media: {
		photos: [
			'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=520&q=80',
			'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?auto=format&fit=crop&w=520&q=80',
			'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=520&q=80',
		],
		postsPreview: [
			{
				id: 'p-101',
				title: '本周 UI 复盘：降低操作噪音',
				excerpt: '把次要操作做成低干扰层级，实际转化明显更稳。',
			},
			{
				id: 'p-102',
				title: '城市晨跑路线推荐',
				excerpt: '从徐汇滨江到龙美术馆，清晨几乎没有人。',
			},
		],
	},
}

const cloneFriendModel = (payload: FriendModel): FriendModel =>
	JSON.parse(JSON.stringify(payload)) as FriendModel

const friend = ref<FriendModel>(cloneFriendModel(props.friendData || defaultFriend))

const doNotDisturb = ref(false)
const pinChat = ref(true)
const muteTheirMoments = ref(false)
const hideMyMoments = ref(false)
const showActionSheet = ref(false)
const showAvatarPreview = ref(false)

const remarkName = ref(friend.value.remarkName || '')
const selectedTags = ref([...(friend.value.tags || [])])
const tagOptions = [
	{ label: '同学', value: '同学' },
	{ label: '同事', value: '同事' },
	{ label: '游戏搭子', value: '游戏搭子' },
	{ label: 'UI 讨论', value: 'UI 讨论' },
	{ label: '摄影', value: '摄影' },
]

const isFriend = computed(() => friend.value.relationshipStatus === 'friend')
const isBlockedByMe = computed(() => friend.value.relationshipStatus === 'blocked_by_me')
const isBlockedMe = computed(() => friend.value.relationshipStatus === 'blocked_me')
const isInteractionDisabled = computed(
	() => isBlockedByMe.value || isBlockedMe.value,
)
const isMediaHidden = computed(
	() =>
		friend.value.privacyLevel === 'private' ||
		(friend.value.privacyLevel === 'friends_only' && !isFriend.value),
)

interface ConfirmState {
	show: boolean
	actionKey: 'block' | 'unblock' | 'delete' | ''
	title: string
	content: string
	confirmType: 'primary' | 'error' | 'warning' | 'success'
	confirmText: string
}

const confirmModal = reactive<ConfirmState>({
	show: false,
	actionKey: '',
	title: '',
	content: '',
	confirmType: 'error',
	confirmText: '确认',
})

const relationshipBeforeBlock = ref<'friend' | 'not_friend'>(
	friend.value.relationshipStatus === 'friend' ? 'friend' : 'not_friend',
)

const actionItems = computed<ActionSheetItem[]>(() => {
	const items: ActionSheetItem[] = [
		{ key: 'report', label: '举报', danger: true },
		{
			key: isBlockedByMe.value ? 'unblock' : 'block',
			label: isBlockedByMe.value ? '取消拉黑' : '拉黑',
			danger: !isBlockedByMe.value,
		},
		{ key: 'share', label: '分享名片/二维码（占位）' },
	]
	if (isFriend.value) items.splice(2, 0, { key: 'delete', label: '删除好友', danger: true })
	return items
})

const goBack = (): void => {
	if (props.embedded) {
		emit('back')
		return
	}
	router.back()
}

const copyUserId = async (): Promise<void> => {
	try {
		await navigator.clipboard.writeText(friend.value.id)
		message.success('用户 ID 已复制')
	} catch {
		message.error('复制失败，请手动复制')
	}
}

const onMessage = (): void => {
	if (isInteractionDisabled.value) {
		message.warning('当前关系状态下无法发消息')
		return
	}
	emit('message', friend.value)
	message.info('发消息占位：后续接路由/会话')
}

const onVoiceVideo = (): void => {
	if (isInteractionDisabled.value) {
		message.warning('当前关系状态下无法发起语音/视频')
		return
	}
	emit('voice-video', friend.value)
	message.info('语音/视频占位')
}

const onAddFriend = (): void => {
	if (isInteractionDisabled.value) {
		message.warning('当前无法添加，对方已限制')
		return
	}
	emit('add-friend', friend.value)
	message.success('添加好友请求已发送（占位）')
}

const onOpenMutualFriends = (): void => {
	message.info('共同好友列表占位')
}

const onOpenMutualGroups = (): void => {
	message.info('共同群聊列表占位')
}

const onOpenPhoto = (): void => {
	message.info('查看相册占位')
}

const onOpenPost = (): void => {
	message.info('查看动态占位')
}

const onReport = (): void => {
	emit('report', friend.value)
	message.info('举报入口占位')
}

const openConfirm = (config: Partial<ConfirmState> & { actionKey: ConfirmState['actionKey'] }): void => {
	confirmModal.show = true
	confirmModal.actionKey = config.actionKey
	confirmModal.title = config.title || '请确认'
	confirmModal.content = config.content || ''
	confirmModal.confirmType = config.confirmType || 'error'
	confirmModal.confirmText = config.confirmText || '确认'
}

const closeConfirm = (): void => {
	confirmModal.show = false
	confirmModal.actionKey = ''
}

const openDeleteConfirm = (): void => {
	openConfirm({
		actionKey: 'delete',
		title: '删除好友',
		content: '删除后将从好友列表移除，聊天记录不会自动恢复。',
		confirmType: 'error',
		confirmText: '删除',
	})
}

const onToggleBlock = (next: boolean): void => {
	if (next) {
		openConfirm({
			actionKey: 'block',
			title: '拉黑该好友',
			content: '拉黑后将无法互相发送消息，且对方无法查看你的动态。',
			confirmType: 'warning',
			confirmText: '确认拉黑',
		})
		return
	}
	openConfirm({
		actionKey: 'unblock',
		title: '取消拉黑',
		content: '解除后可恢复互动。',
		confirmType: 'primary',
		confirmText: '确认解除',
	})
}

const onActionSelect = (key: string): void => {
	showActionSheet.value = false
	if (key === 'report') {
		onReport()
		return
	}
	if (key === 'share') {
		message.info('分享名片/二维码占位')
		return
	}
	if (key === 'delete') {
		openDeleteConfirm()
		return
	}
	if (key === 'block') {
		onToggleBlock(true)
		return
	}
	if (key === 'unblock') {
		onToggleBlock(false)
	}
}

const onConfirmAction = (): void => {
	if (confirmModal.actionKey === 'block') {
		if (friend.value.relationshipStatus === 'friend' || friend.value.relationshipStatus === 'not_friend') {
			relationshipBeforeBlock.value = friend.value.relationshipStatus
		}
		friend.value.relationshipStatus = 'blocked_by_me'
		emit('relationship-change', 'blocked_by_me')
		message.success('已拉黑该用户')
	}
	if (confirmModal.actionKey === 'unblock') {
		friend.value.relationshipStatus = relationshipBeforeBlock.value
		emit('relationship-change', relationshipBeforeBlock.value)
		message.success('已取消拉黑')
	}
	if (confirmModal.actionKey === 'delete') {
		friend.value.relationshipStatus = 'not_friend'
		emit('relationship-change', 'not_friend')
		emit('delete-friend', friend.value)
		message.success('已删除好友')
	}
	closeConfirm()
}

watch(
	() => props.friendData,
	(next) => {
		friend.value = cloneFriendModel(next || defaultFriend)
		remarkName.value = friend.value.remarkName || ''
		selectedTags.value = [...(friend.value.tags || [])]
		relationshipBeforeBlock.value =
			friend.value.relationshipStatus === 'friend' ? 'friend' : 'not_friend'
	},
	{ immediate: true, deep: true },
)
</script>
