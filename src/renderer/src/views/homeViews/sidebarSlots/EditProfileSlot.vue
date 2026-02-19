<template>
	<div
		class="h-full w-full rounded-[14px] border border-border-default bg-card-bg p-6 overflow-y-auto"
	>
		<div class="max-w-[760px] mx-auto flex flex-col gap-4">
			<div class="text-xl font-semibold text-text-main">编辑个人信息</div>
			<div class="text-xs text-gray-500 dark:text-gray-300">
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
		</div>
		<AvatarUploadEditor
			ref="avatarUploadEditorRef"
			@uploaded="handleAvatarUploaded"
			@uploading-change="handleAvatarUploadingChange"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
	NAvatar,
	NButton,
	NForm,
	NFormItem,
	NInput,
	NInputNumber,
	NSelect,
	useMessage,
} from 'naive-ui'
import AvatarUploadEditor from '@renderer/components/AvatarUploadEditor.vue'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import request from '@renderer/utils/request'

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

const user = useUserInfoStore()
const message = useMessage()
const isAvatarUploading = ref(false)
const avatarUploadEditorRef = ref<{
	openFileDialog: () => void
} | null>(null)

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
</script>
