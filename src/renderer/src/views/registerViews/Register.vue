<template>
	<div
		class="relative h-screen w-full overflow-hidden bg-linear-to-br from-grad-start via-[#eef5ff] to-[#e9f4ff] dark:via-[#121620]"
	>
		<div
			class="register-blob pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-sky-300/45 blur-3xl"
		></div>
		<div
			class="register-blob-delayed pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-indigo-300/35 blur-3xl"
		></div>

		<div
			class="relative z-10 flex h-full items-center justify-center px-2 py-2 pt-7 sm:px-3"
		>
			<div
				class="register-shell flex h-full max-h-[800px] w-full max-w-[1020px] overflow-hidden rounded-[12px] border border-white/65 bg-white/86 backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/85"
			>
				<section
					class="register-left relative flex w-[35%] min-w-[230px] flex-col justify-between overflow-hidden bg-linear-to-b from-[#091226] via-[#12284f] to-[#234b8f] px-6 py-7 text-white"
				>
					<BrandParticleLayer />

					<div class="relative z-10">
						<p
							class="register-brand text-[34px] font-black tracking-tight"
						>
							LinkR
						</p>
						<p
							class="register-brand-sub mt-2 text-xs tracking-[0.16em] text-white/72"
						>
							快速连接团队与项目
						</p>
					</div>
					<div class="relative z-10 space-y-2">
						<p
							v-for="(item, index) in registerHighlights"
							:key="`${item}-${index}`"
							class="register-highlight rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-xs leading-relaxed text-white/82"
						>
							{{ item }}
						</p>
					</div>
					<p class="relative z-10 text-xs text-white/45">
						© {{ currentYear }} LinkR Workspace
					</p>
				</section>

				<section
					class="register-main flex min-w-0 flex-1 flex-col overflow-hidden bg-page-bg px-4 py-2 sm:px-6 sm:py-2"
				>
					<div class="mb-2">
						<p
							class="inline-flex items-center rounded-full bg-[#2f7fe7]/12 px-3 py-1 text-xs font-semibold tracking-wide text-[#2f7fe7]"
						>
							创建账号
						</p>
					</div>

					<n-form
						ref="formRef"
						:model="formModel"
						:rules="rules"
						class="register-form flex h-full min-h-0 flex-col"
						label-placement="top"
						:size="'medium'"
						require-mark-placement="right-hanging"
					>
						<n-form-item
							path="avatarUrl"
							:show-label="false"
							class="avatar-form-item register-avatar-item mb-1"
							:show-feedback="true"
						>
							<div class="register-hero mb-1.5 flex items-center">
								<div class="flex flex-col items-center gap-1.5">
									<div
										class="avatar-wrapper group relative h-[72px] w-[72px] shrink-0 cursor-pointer"
										@click="triggerUpload"
									>
										<n-avatar
											round
											:size="72"
											:src="formModel.avatarUrl"
											class="block border border-gray-200 transition-all duration-300 group-hover:border-[#2f7fe7]/50 dark:border-zinc-700"
											color="#f3f4f6"
										>
											<template
												#icon
												v-if="!formModel.avatarUrl"
											>
												<n-icon
													:size="34"
													color="#dbe2ee"
													:component="PersonIcon"
												/>
											</template>
										</n-avatar>
										<div
											class="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-xs font-medium text-white opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100"
										>
											更换头像
										</div>
										<div
											class="absolute bottom-0 right-0 flex items-center justify-center rounded-full border border-gray-100 bg-white p-1 text-gray-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-300"
										>
											<n-icon
												:size="14"
												:component="CameraIcon"
											/>
										</div>
									</div>
									<p
										class="register-avatar-hint text-[11px] text-text-main/45"
									>
										建议使用清晰正面头像
									</p>
								</div>
							</div>
						</n-form-item>

						<div class="grid grid-cols-2 gap-x-3 gap-y-0">
							<n-form-item label="真实姓名" path="realName">
								<n-input
									v-model:value="formModel.realName"
									placeholder="请输入姓名"
									clearable
								/>
							</n-form-item>

							<n-form-item label="性别" path="gender">
								<n-select
									v-model:value="formModel.gender"
									:options="sexOptions"
									placeholder="请选择"
								/>
							</n-form-item>

							<n-form-item
								label="企业邮箱"
								path="email"
								class="col-span-2"
							>
								<n-input-group>
									<n-input
										v-model:value="formModel.email"
										placeholder="请输入邮箱前缀"
										clearable
									/>
									<n-input-group-label
										class="register-email-suffix"
										>{{ emailSuffix }}</n-input-group-label
									>
								</n-input-group>
							</n-form-item>

							<n-form-item
								label="所在地"
								path="address"
								class="col-span-2"
							>
								<n-cascader
									v-model:value="formModel.address"
									:options="chinaAreaOptions"
									placeholder="省 / 市 / 区"
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

							<n-form-item
								label="确认密码"
								path="confirmPassword"
							>
								<n-input
									v-model:value="formModel.confirmPassword"
									type="password"
									placeholder="请再次输入密码"
								/>
							</n-form-item>
						</div>

						<div class="register-actions register-actions-bottom">
							<n-button
								quaternary
								@click="handleBack"
								size="medium"
								class="register-back-btn"
							>
								<template #icon
									><n-icon :component="GoBackIcon"
								/></template>
								返回登录
							</n-button>
							<n-button
								type="primary"
								strong
								size="medium"
								:loading="isSubmitting"
								@click="submitRegistration"
								class="register-primary-btn register-submit-btn"
							>
								立即注册
							</n-button>
						</div>
					</n-form>
				</section>
			</div>
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
import BrandParticleLayer from '@renderer/components/BrandParticleLayer.vue'

const title = useTitleStore()

title.setTitle('注册')

const endpoint = import.meta.env.VITE_API_URL
const API = {
	REGISTER: endpoint + '/user/register',
}
const currentYear = new Date().getFullYear()
const registerHighlights = [
	'企业邮箱与成员资料统一维护，协作权限更清晰。',
	'创建后可直接进入团队工作台，减少切换步骤。',
	'账号、会话、文件数据全程同步，跨端衔接更稳定。',
]
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

const triggerUpload = (): void => {
	avatarUploadEditorRef.value?.openFileDialog()
}

const handleAvatarUploaded = (url: string): void => {
	formModel.avatarUrl = url
	message.success('头像处理成功')
	formRef.value?.validate(undefined, (rule) => rule.key === 'avatarUrl')
}

const submitRegistration = () => {
	formRef.value?.validate(async (errors) => {
		if (errors) {
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
.register-shell {
	animation: auth-fade-up 0.45s ease-out;
}

.register-blob {
	animation: blob-float 9s ease-in-out infinite;
}

.register-blob-delayed {
	animation: blob-float 10s ease-in-out infinite reverse;
}

:deep(.avatar-form-item) .n-form-item-feedback-wrapper {
	display: flex;
	justify-content: flex-start;
}

:deep(.register-form .n-form-item .n-form-item-label) {
	padding-bottom: 2px;
	font-size: 12px;
	font-weight: 600;
	color: rgba(31, 41, 55, 0.78);
}

:deep(.register-form .n-form-item) {
	margin-bottom: 2px;
}

:deep(.register-form .n-form-item .n-form-item-blank) {
	min-height: auto;
}

:deep(.dark .register-form .n-form-item .n-form-item-label) {
	color: rgba(229, 231, 235, 0.82);
}

:deep(.register-primary-btn.n-button--primary-type) {
	border: none;
	border-radius: 12px;
	background: linear-gradient(180deg, #3695ff 0%, #2f7fe7 100%);
	transition: transform 0.2s ease;
}

:deep(.register-primary-btn.n-button--primary-type:hover) {
	background: linear-gradient(180deg, #4aa2ff 0%, #2f7fe7 100%);
	transform: translateY(-1px);
}

:deep(.register-primary-btn.n-button--primary-type:active) {
	background: linear-gradient(180deg, #2f88f0 0%, #266fd3 100%);
}

:deep(.register-back-btn.n-button) {
	color: rgba(31, 41, 55, 0.65);
	font-weight: 600;
	border-radius: 12px;
	transition: transform 0.2s ease;
}

:deep(.register-back-btn.n-button:hover) {
	transform: translateY(-1px);
}

:deep(.dark .register-back-btn.n-button) {
	color: rgba(229, 231, 235, 0.75);
}

:deep(.register-email-suffix) {
	background-color: #f8fafc;
	color: rgba(75, 85, 99, 0.72);
}

:deep(.dark .register-email-suffix) {
	background-color: #27272a;
	color: rgba(209, 213, 219, 0.66);
}

:deep(.register-form .n-select .n-base-selection),
:deep(.register-form .n-cascader .n-base-selection) {
	border-radius: 6px;
}

.register-avatar-item {
	margin-bottom: 2px;
}

.register-hero {
	width: 100%;
	justify-content: flex-start;
}

.register-actions-bottom {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 0.75rem;
	margin-top: auto;
	padding-top: 1rem;
}

.register-submit-btn {
	min-width: 152px;
}

@media (max-height: 800px) {
	.register-shell {
		max-height: 760px;
	}

	.register-left {
		padding: 1.25rem 1.25rem;
	}

	.register-brand {
		font-size: 30px;
	}

	.register-brand-sub {
		margin-top: 0.35rem;
	}

	.register-highlight {
		padding: 0.4rem 0.6rem;
		line-height: 1.35;
	}

	.register-left .register-highlight:nth-of-type(3) {
		display: none;
	}

	.register-main {
		padding: 1rem 1.1rem;
	}

	.register-title {
		margin-top: 0.35rem;
		font-size: 20px;
	}

	.register-subtitle {
		margin-top: 0.15rem;
	}

	.register-avatar-hint {
		display: none;
	}

	.register-actions {
		margin-top: 0.25rem;
	}

	.register-actions-bottom {
		margin-top: auto;
	}

	:deep(.register-form .n-form-item) {
		margin-bottom: 1px;
	}
}

@keyframes auth-fade-up {
	0% {
		opacity: 0;
		transform: translateY(8px);
	}
	100% {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes blob-float {
	0%,
	100% {
		transform: translate3d(0, 0, 0);
	}
	50% {
		transform: translate3d(0, -10px, 0);
	}
}

</style>
