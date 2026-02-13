<template>
	<div
		class="flex h-screen w-screen items-center justify-center bg-linear-to-br from-grad-start to-grad-end"
	>
		<div
			class="w-[440px] bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 py-8"
		>
			<div class="px-8 mb-6 text-center">
				<h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100">创建账号</h2>
				<p class="text-gray-500 dark:text-gray-300 text-sm mt-1">
					注册 LinkR，开启高效协作之旅
				</p>
			</div>

			<n-form
				ref="formRef"
				:model="formModel"
				:rules="rules"
				label-placement="left"
				class="px-8"
				size="medium"
				:show-label="true"
				label-width="auto"
				require-mark-placement="right-hanging"
			>
				<div class="flex flex-col items-center mb-6">
					<n-form-item
						path="avatarUrl"
						:show-label="false"
						class="avatar-form-item"
						:show-feedback="true"
					>
						<div
							class="avatar-wrapper group relative w-[88px] h-[88px] shrink-0"
							@click="triggerUpload"
						>
							<n-avatar
								round
								:size="88"
								:src="formModel.avatarUrl"
								class="border border-gray-100 dark:border-zinc-700 group-hover:border-primary/50 transition-all duration-300 block"
								color="#f3f4f6"
							>
								<template #icon v-if="!formModel.avatarUrl">
									<n-icon
										:size="48"
										color="#e2e8f0"
										:component="PersonIcon"
									/>
								</template>
							</n-avatar>
							<div
								class="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer text-white text-xs font-medium backdrop-blur-[1px]"
							>
								更换
							</div>
							<div
								class="absolute bottom-0 right-0 bg-white dark:bg-zinc-800 rounded-full p-1 border border-gray-100 dark:border-zinc-700 text-gray-600 dark:text-gray-300 flex items-center justify-center shadow-sm"
							>
								<n-icon :size="14" :component="CameraIcon" />
							</div>
						</div>
					</n-form-item>
				</div>

				<div class="space-y-1">
					<n-form-item label="真实姓名" path="realName">
						<n-input
							v-model:value="formModel.realName"
							placeholder="您的姓名"
							clearable
						/>
					</n-form-item>

					<n-form-item label="企业邮箱" path="email">
						<n-input-group>
							<n-input
								v-model:value="formModel.email"
								placeholder="邮箱前缀"
								clearable
							/>
							<n-input-group-label
								class="bg-gray-50! dark:bg-zinc-800! text-gray-400 dark:text-gray-500"
								>{{ emailSuffix }}</n-input-group-label
							>
						</n-input-group>
					</n-form-item>

					<n-form-item label="性别" path="gender">
						<n-select
							v-model:value="formModel.gender"
							:options="sexOptions"
							placeholder="请选择"
						/>
					</n-form-item>
					<n-form-item label="所在地" path="address">
						<n-cascader
							v-model:value="formModel.address"
							:options="chinaAreaOptions"
							placeholder="省/市/区"
							check-strategy="child"
							expand-trigger="hover"
						/>
					</n-form-item>

					<n-form-item label="登录密码" path="password">
						<n-input
							v-model:value="formModel.password"
							type="password"
							show-password-on="mousedown"
							placeholder="至少 6 位安全密码"
						/>
					</n-form-item>

					<n-form-item label="确认密码" path="confirmPassword">
						<n-input
							v-model:value="formModel.confirmPassword"
							type="password"
							placeholder="请再次输入密码"
						/>
					</n-form-item>
				</div>

				<div class="flex flex-col gap-3 mt-8">
					<n-button
						type="primary"
						block
						strong
						size="large"
						:loading="isSubmitting"
						@click="submitRegistration"
						color="#333"
					>
						立即注册
					</n-button>
					<n-button
						quaternary
						block
						@click="handleBack"
						size="medium"
						class="text-gray-500"
					>
						<template #icon
							><n-icon :component="GoBackIcon"
						/></template>
						返回登录
					</n-button>
				</div>
			</n-form>
		</div>

		<AvatarUploadEditor
			ref="avatarUploadEditorRef"
			@uploaded="handleAvatarUploaded"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import {
	ArrowBackCircleOutline as GoBackIcon,
	Person as PersonIcon,
	Camera as CameraIcon,
} from '@vicons/ionicons5'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import axios from 'axios'
import { regionData } from 'element-china-area-data'
import { useTitleStore } from '@renderer/stores/title'
import router from '@renderer/router'
import AvatarUploadEditor from '@renderer/components/AvatarUploadEditor.vue'

const title = useTitleStore()

title.setTitle('注册')

/* ================== 配置与常量 ================== */
const endpoint = import.meta.env.VITE_API_URL
const API = {
	REGISTER: endpoint + '/user/register',
	UPLOAD: endpoint + '/files/update/avatar',
}
const emailSuffix = '@oakevergames.com'
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const avatarUploadEditorRef = ref<{
	openFileDialog: () => void
} | null>(null)
const chinaAreaOptions = regionData
const sexOptions = [
	{ label: '男', value: 'male' },
	{ label: '女', value: 'female' },
]

/* ================== 状态变量 ================== */
const isSubmitting = ref(false)

const formModel = reactive({
	realName: '',
	email: '',
	gender: null,
	address: null,
	password: '',
	confirmPassword: '',
	avatarUrl: '',
})

/* ================== 表单校验规则 ================== */
const rules: FormRules = {
	avatarUrl: { required: true, message: '请设置个人头像', trigger: 'change' },
	realName: [
		{ required: true, message: '请输入用户名' },
		{ min: 2, message: '姓名至少 2 个汉字', trigger: 'blur' },
	],
	email: { required: true, message: '请输入邮箱前缀' },
	gender: { required: true, message: '请选择性别' },
	address: { required: true, message: '请选择地区' },
	password: { required: true, min: 6, message: '密码不能少于 6 位' },
	confirmPassword: [
		{ required: true, message: '请再次输入密码' },
		{
			validator: (_, v) => v === formModel.password,
			message: '两次密码输入不一致',
			trigger: ['blur', 'input'],
		},
	],
}
/* ================== 逻辑处理：头像裁剪 ================== */
const triggerUpload = (): void => {
	avatarUploadEditorRef.value?.openFileDialog()
}

const handleAvatarUploaded = (url: string): void => {
	formModel.avatarUrl = url
	message.success('头像处理成功')
	formRef.value?.validate(undefined, (rule) => rule.key === 'avatarUrl')
}

/* ================== 逻辑处理：提交注册 ================== */
const submitRegistration = () => {
	formRef.value?.validate(async (errors) => {
		if (errors) {
			// message.warning('请检查信息是否完整')
			return
		}

		isSubmitting.value = true
		try {
			const payload = {
				...formModel,
				email: formModel.email + emailSuffix,
			}
			const res = await axios.post(API.REGISTER, payload)
			if (res.data.code === 200) {
				message.success('注册成功')
				console.log(res.data.data.account)

				router.push({
					name: 'RegisterResult',
					params: { userInfo: res.data.data.account },
				})
			} else {
				message.error(res.data.message || '注册失败')
			}
		} catch (err) {
			message.error('网络错误或服务器异常')
			console.error(err)
		} finally {
			isSubmitting.value = false
		}
	})
}

const handleBack = () => {
	window.electron?.ipcRenderer.send('register-success-open-loginWindow')
}
</script>

<style scoped>
/* 自定义头像下的错误提示位置 */
:deep(.avatar-form-item) .n-form-item-feedback-wrapper {
	justify-content: center;
	display: flex;
}

:deep(.n-form-item .n-form-item-label) {
	font-size: 13px;
	font-weight: 500;
	color: #4b5563;
	padding-bottom: 4px;
}

.dark :deep(.n-form-item .n-form-item-label) {
	color: #d1d5db;
}

</style>
