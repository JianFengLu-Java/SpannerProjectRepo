<template>
	<div class="register-container">
		<div class="register-card shadow-2xl border border-gray-100">
			<div class="header-section text-center mb-8">
				<h1
					class="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-500 bg-clip-text text-transparent"
				>
					创建新账号
				</h1>
				<p class="text-xs text-gray-400 mt-2">
					加入 Spanner Tools，开启高效工作流
				</p>
			</div>

			<n-form
				ref="formRef"
				:model="formModel"
				:rules="rules"
				label-placement="top"
				class="px-8"
				size="medium"
				:show-label="true"
			>
				<div class="flex flex-col items-center mb-1">
					<n-form-item
						path="avatarUrl"
						:show-label="false"
						:show-feedback="false"
					>
						<n-upload
							list-type="image-card"
							:max="1"
							class="avatar-uploader"
							:custom-request="customUploadRequest"
							@before-upload="beforeUpload"
							@finish="handleUploadFinish"
						>
							<div class="text-center">
								<p class="text-[10px] text-gray-400">
									上传头像
								</p>
							</div>
						</n-upload>
					</n-form-item>
				</div>

				<div class="space-y-1">
					<n-form-item label="用户名" path="userName">
						<n-input
							v-model:value="formModel.userName"
							:allow-input="onlyAlphaNumber"
							placeholder="建议使用英文或数字"
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
							<n-input-group-label class="bg-gray-50!">{{
								emailSuffix
							}}</n-input-group-label>
						</n-input-group>
					</n-form-item>

					<div class="grid grid-cols-2 gap-2">
						<n-form-item label="性别" path="gender">
							<n-select
								v-model:value="formModel.gender"
								:options="sexOptions"
								placeholder="选择"
							/>
						</n-form-item>
						<n-form-item label="所在地" path="address">
							<n-cascader
								v-model:value="formModel.address"
								:options="chinaAreaOptions"
								placeholder="省/市"
								check-strategy="child"
								expand-trigger="hover"
							/>
						</n-form-item>
					</div>

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

				<div class="flex flex-col gap-2 mt-8">
					<n-button
						type="primary"
						block
						strong
						round
						size="large"
						:loading="isSubmitting"
						@click="submitRegistration"
					>
						立即注册
					</n-button>
					<n-button quaternary block round @click="handleBack">
						<template #icon
							><n-icon :component="GoBackIcon"
						/></template>
						返回登录
					</n-button>
				</div>
			</n-form>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ArrowBackCircleOutline as GoBackIcon } from '@vicons/ionicons5'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { regionData } from 'element-china-area-data'

/* ================== 配置 ================== */
const API = {
	REGISTER: 'http://localhost:8080/user/register',
	UPLOAD: 'http://localhost:8080/files/update/avatar',
}

const emailSuffix = '@oakevergames.com'
const router = useRouter()
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const isSubmitting = ref(false)

/* ================== 数据模型 ================== */
const formModel = reactive({
	userName: '',
	email: '',
	gender: null,
	address: null,
	password: '',
	confirmPassword: '',
	avatarUrl: '',
})

const sexOptions = [
	{ label: '男', value: 'male' },
	{ label: '女', value: 'female' },
]

const chinaAreaOptions = regionData

/* ================== 校验规则 ================== */
const rules: FormRules = {
	avatarUrl: { required: true, message: '请上传个性头像', trigger: 'change' },
	userName: [
		{ required: true, message: '请输入用户名' },
		{ min: 6, message: '长度不能少于 6 位', trigger: 'blur' },
	],
	email: { required: true, message: '请输入邮箱前缀' },
	gender: { required: true, message: '请选择性别' },
	address: { required: true, message: '请选择地区' },
	password: { required: true, min: 6, message: '密码至少 6 位' },
	confirmPassword: [
		{ required: true, message: '请再次输入密码' },
		{
			validator: (_, v) => v === formModel.password,
			message: '两次密码输入不一致',
			trigger: ['blur', 'password-input'],
		},
	],
}

/* ================== 逻辑处理 ================== */
const onlyAlphaNumber = (v: string) => /^[a-zA-z0-9]*$/.test(v)

async function customUploadRequest({ file, onFinish, onError }: any) {
	const formData = new FormData()
	formData.append('file', file.file)
	try {
		const res = await axios.post(API.UPLOAD, formData)
		onFinish({ file })
		// 假设接口返回数据在 data.fileUrl
		formModel.avatarUrl = res.data.fileUrl
		message.success('头像处理成功')
	} catch (err) {
		onError()
		message.error('上传失败')
	}
}

function beforeUpload({ file }: any) {
	if (!file.type.startsWith('image/')) {
		message.error('只允许图片格式')
		return false
	}
	return true
}

const submitRegistration = () => {
	formRef.value?.validate(async (errors) => {
		if (errors) {
			message.error('请检查信息填写是否完整')
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
				message.success('注册成功，欢迎加入')
				window.electron.ipcRenderer.send(
					'register-success-open-loginWindow',
				)
			}
		} catch (err) {
			message.error('系统繁忙，请稍后再试')
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
.register-container {
	height: 100vh;
	width: 100vw;
	display: flex;
	justify-content: center;
	align-items: center;
	background: radial-gradient(circle at top left, #f8fafc, #e2e8f0);
}

.register-card {
	width: 440px;
	background: rgba(255, 255, 255, 0.9);
	backdrop-filter: blur(10px);
	border-radius: 24px;
	padding: 40px 0 20px 0;
}

/* 针对上传组件的圆形美化 */
:deep(.n-upload-trigger.n-upload-trigger--image-card) {
	border-radius: 50% !important;
	border: 2px dashed #e5e7eb;
	transition: all 0.3s ease;
}

:deep(.n-upload-trigger.n-upload-trigger--image-card:hover) {
	border-color: #10b981;
	background-color: #f0fdf4;
}

:deep(.n-upload-file-list.n-upload-file-list--grid) {
	justify-content: center;
}

:deep(.n-upload-file.n-upload-file--image-card) {
	border-radius: 50% !important;
}

/* 隐藏滚动条但保留功能 */
:deep(.n-scrollbar-rail) {
	width: 4px;
}
</style>
