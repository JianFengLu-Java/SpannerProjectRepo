<template>
	<div class="h-full w-full flex justify-center items-center">
		<div class="grid grid-cols-5 grid-rows-9 h-[700px] w-[600px] rounded-lg border bg-white border-gray-200">
			<!-- 标题 -->
			<div class="col-span-5 row-span-1 flex flex-col justify-center items-center mt-5">
				<h1 class="text-xl font-bold text-gray-800">
					注册 Spanner Tools 账号
				</h1>
			</div>

			<!-- 表单主体 -->
			<div class="col-span-5 row-span-8 rounded-lg ml-30 mr-30 mb-10">
				<!-- 头像上传 -->

				<!-- 注册表单 -->
				<n-form ref="formRef" :model="formModel" :rules="rules" label-placement="left" class="flex flex-col">
					<n-form-item path="avatarUrl" show-feedback="false" class="hidden">
						<div class="w-full flex justify-center items-center">
							<div class="w-30 mb-3">
								<n-upload list-type="image-card" :max="1" :custom-request="customUploadRequest"
									:on-before-upload="beforeUpload" :on-finish="handleUploadFinish"
									:on-error="handleUploadError" :show-preview-button="false" />
							</div>
						</div>
						<n-input v-model:value="formModel.avatarUrl" class="hidden!" />
					</n-form-item>
					<n-form-item path="userName" label="用户名:">
						<n-input :allow-input="onlyAlphaNumber" v-model:value="formModel.userName" placeholder="用户名"
							clearable />
					</n-form-item>

					<n-form-item path="email" label="邮箱地址:">
						<n-input-group>
							<n-input v-model:value="formModel.email" placeholder="邮箱" clearable />
							<n-input-group-label>
								{{ emailSuffix }}
							</n-input-group-label>
						</n-input-group>
					</n-form-item>

					<n-form-item path="sex" label="性别:">
						<div class="pl-6 w-full">
							<n-radio-group v-model:value="formModel.gender">
								<n-radio v-for="option in sexChange" :key="option.value" :value="option.value">
									{{ option.label }}
								</n-radio>
							</n-radio-group>
						</div>
					</n-form-item>

					<n-form-item path="address" label="地址:">
						<n-cascader v-model:value="formModel.address" :options="chinaAreaOptions"
							placeholder="请选择省/市/区（县）" clearable check-strategy="child" expanded-trigger="hover" />
					</n-form-item>

					<n-form-item path="password">
						<n-input v-model:value="formModel.password" type="password" placeholder="密码"
							show-password-on="mousedown" clearable />
					</n-form-item>

					<n-form-item path="confirmPassword">
						<n-input v-model:value="formModel.confirmPassword" type="password" placeholder="确认密码"
							clearable />
					</n-form-item>

					<div class="grid grid-cols-5 gap-2 mt-2">
						<n-button type="primary" class="w-full col-span-5" @click="submitRegistration">
							注册
						</n-button>

						<n-button class="w-full col-span-5" :render-icon="goBackIcon" @click="handleBack">
							返回
						</n-button>
					</div>
				</n-form>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * Register.vue
 * 注册页面（含表单校验）
 */
import { h, ref } from 'vue'
import { ArrowBackCircleOutline as GoBackIcon } from '@vicons/ionicons5'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import axios from 'axios'
import { useRouter } from 'vue-router'
import { useTitleStore } from '../../stores/title'
import { regionData } from 'element-china-area-data'

/* ================== 常量 ================== */
const registerUrl = 'http://localhost:8080/user/register'
const uploadAvatarUrl = 'http://localhost:8080/files/update/avatar'

/* ================== 基础 ================== */
const router = useRouter()
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const emailSuffix = ref('@oakevergames.com')
const avatarUrl = ref('')

/* ================== 表单模型 ================== */
const formModel = ref({
	userName: '',
	email: '',
	gender: null as string | null,
	address: [] as string[],
	password: '',
	confirmPassword: '',
	avatarUrl: '',
})

/* ================== 校验规则 ================== */
const rules: FormRules = {
	avatarUrl: [{ required: true, message: '请上传头像', trigger: 'change' }],
	userName: [
		{ required: true, message: '请输入用户名', trigger: ['blur', 'input'] },
		{ min: 6, message: '用户名至少 6 个字符', trigger: 'blur' },
	],
	email: [
		{ required: true, message: '请输入邮箱', trigger: ['blur', 'input'] },
		{
			pattern: /^[a-zA-Z0-9_.-]+$/,
			message: '邮箱格式不正确',
			trigger: 'blur',
		},
	],
	gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
	address: [{ required: true, message: '请输入地址', trigger: 'blur' }],
	password: [
		{ required: true, message: '请输入密码', trigger: 'blur' },
		{ min: 6, message: '密码至少 6 位', trigger: 'blur' },
	],
	confirmPassword: [
		{ required: true, message: '请确认密码', trigger: 'blur' },
		{
			validator: (_, value) => value === formModel.value.password,
			message: '两次密码输入不一致',
			trigger: 'blur',
		},
	],
}

function onlyAlphaNumber(value: string) {
	return /^[a-zA-z0-9]*$/.test(value)
}

/* ================== 性别选项 ================== */
const sexChange = [
	{ value: 'male', label: '男' },
	{ value: 'female', label: '女' },
]

/* ================== 提交 ================== */
function submitRegistration() {
	formRef.value?.validate(async (errors) => {
		if (errors) {
			message.error('请正确填写表单信息')
			return
		}

		const submitData = {
			...formModel.value,
			email: formModel.value.email + emailSuffix.value,
			avatarUrl: avatarUrl.value,
		}

		const response = await axios.post(registerUrl, submitData)

		if (response.data.code === 200) {
			message.success('注册成功，请登录')
			router.push('/login')
		} else {
			message.error(response.data.message || '注册失败')
		}
	})
}

/* ================== 头像上传 ================== */
async function customUploadRequest({ file, onFinish, onError }: any) {
	const formData = new FormData()
	formData.append('file', file.file)

	try {
		const response = await axios.post(uploadAvatarUrl, formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
		})

		file.response = response.data
		onFinish({ file })
	} catch (error) {
		onError(error)
	}
}

function beforeUpload({ file }: any) {
	const isImage = file.type.startsWith('image/')
	if (!isImage) message.error('只能上传图片文件')
	return isImage
}

function handleUploadFinish({ file }: any) {
	const response = file.response
	if (response?.status === 'success') {
		formModel.value.avatarUrl = response.fileUrl
		avatarUrl.value = response.fileUrl
		message.success('头像上传成功')
	} else {
		message.error('头像上传失败')
	}
}

function handleUploadError() {
	message.error('头像上传失败')
}


function handleBack() {
	window.electron.ipcRenderer.send('register-success-open-loginWindow')
}

/* ================== 图标 & 标题 ================== */
function goBackIcon() {
	return h(GoBackIcon)
}

const titleStore = useTitleStore()
titleStore.setTitle('注册账号')



const chinaAreaOptions = regionData
</script>

<style scoped></style>
