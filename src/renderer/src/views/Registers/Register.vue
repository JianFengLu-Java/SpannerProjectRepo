<template>
	<div class="register-container overflow-hidden">
		<div class="register-card shadow-sm border border-gray-300">
			<n-form
				ref="formRef"
				:model="formModel"
				:rules="rules"
				label-placement="top"
				class="px-8"
				size="medium"
				:show-label="true"
			>
				<div class="flex flex-col items-center mb-2">
					<n-form-item
						path="avatarUrl"
						:show-label="false"
						:show-feedback="false"
					>
						<div
							class="avatar-wrapper group"
							@click="triggerUpload"
						>
							<n-avatar
								round
								:size="80"
								:src="
									formModel.avatarUrl ||
									'https://http.cat/200'
								"
								fallback-src="https://http.cat/200"
								class="avatar-preview border-2 border-dashed border-gray-300 group-hover:border-green-500 transition-all"
							/>
							<div class="upload-mask">修改头像</div>
						</div>
						<input
							type="file"
							ref="fileInput"
							class="hidden"
							accept="image/*"
							@change="onFileChange"
						/>
					</n-form-item>
				</div>

				<div class="space-y-0">
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

					<div class="grid grid-cols-1 gap-3">
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
								expand-trigger="click"
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

				<div class="flex flex-col gap-2 mt-6">
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

		<n-modal
			v-model:show="showCropper"
			preset="card"
			title="编辑个人头像"
			style="width: 500px"
			:segmented="{ content: 'soft', footer: 'soft' }"
			:mask-closable="false"
		>
			<div class="flex gap-8">
				<div class="flex-1">
					<div
						class="h-[340px] bg-gray-50 rounded-xl overflow-hidden border border-gray-100 relative shadow-inner"
					>
						<vue-cropper
							ref="cropperRef"
							:img="tempImg"
							auto-crop
							fixed
							:fixed-number="[1, 1]"
							center-box
							mode="cover"
							@real-time="realTimePreview"
						/>
					</div>
				</div>

				<div
					class="w-[100px] flex flex-col items-center border-l border-gray-100 pl-8 pt-4"
				>
					<p
						class="text-xs font-bold text-gray-500 mb-6 uppercase tracking-wider"
					>
						预览效果
					</p>

					<div class="preview-container large shadow-sm">
						<div :style="getPreviewStyle(100)">
							<div :style="previews.div" class="preview-content">
								<img
									:src="previews.url"
									:style="previews.img"
									class="max-w-none"
								/>
							</div>
						</div>
					</div>
					<p class="text-[11px] text-gray-400 mt-2 mb-8">
						100 × 100 像素
					</p>

					<div class="preview-container small shadow-sm">
						<div :style="getPreviewStyle(48)">
							<div :style="previews.div" class="preview-content">
								<img
									:src="previews.url"
									:style="previews.img"
									class="max-w-none"
								/>
							</div>
						</div>
					</div>
					<p class="text-[11px] text-gray-400 mt-2">48 × 48 像素</p>
				</div>
			</div>

			<template #footer>
				<div class="flex justify-end gap-3">
					<n-button quaternary @click="showCropper = false"
						>取消</n-button
					>
					<n-button
						type="primary"
						class="px-8 shadow-md shadow-green-100"
						:loading="isUploading"
						@click="handleCropSave"
					>
						保存并应用
					</n-button>
				</div>
			</template>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ArrowBackCircleOutline as GoBackIcon } from '@vicons/ionicons5'
import { useMessage, type FormInst, type FormRules } from 'naive-ui'
import axios from 'axios'
import { regionData } from 'element-china-area-data'
import { VueCropper } from 'vue-cropper'
import 'vue-cropper/dist/index.css'

/* ================== 配置与常量 ================== */
const API = {
	REGISTER: 'http://localhost:8080/user/register',
	UPLOAD: 'http://localhost:8080/files/update/avatar',
}
const emailSuffix = '@oakevergames.com'
const message = useMessage()
const formRef = ref<FormInst | null>(null)
const chinaAreaOptions = regionData
const sexOptions = [
	{ label: '男', value: 'male' },
	{ label: '女', value: 'female' },
]

/* ================== 状态变量 ================== */
const isSubmitting = ref(false)
const isUploading = ref(false)
const showCropper = ref(false)
const tempImg = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const cropperRef = ref<any>(null)

const formModel = reactive({
	userName: '',
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
	userName: [
		{ required: true, message: '请输入用户名' },
		{ min: 6, message: '用户名至少 6 位', trigger: 'blur' },
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
/* ================== 实时预览逻辑 ================== */
const previews = ref<any>({})

const realTimePreview = (data: any) => {
	previews.value = data
}

/**
 * 核心：计算缩放比例
 * size: 预览圆圈的目标尺寸 (100 或 48)
 */
const getPreviewStyle = (size: number) => {
	if (!previews.value.w) return {}

	// 计算缩放比 = 目标圆圈大小 / 裁剪框当前的像素宽度
	const scale = size / previews.value.w

	return {
		width: previews.value.w + 'px',
		height: previews.value.h + 'px',
		transform: `scale(${scale})`,
		transformOrigin: 'top left', // 必须从左上角缩放，否则位移会乱
	}
}
/* ================== 逻辑处理：头像裁剪 ================== */
const triggerUpload = () => fileInput.value?.click()

const onlyAlphaNumber = (v: string) => /^[a-zA-z0-9]*$/.test(v)

const onFileChange = (e: Event) => {
	const file = (e.target as HTMLInputElement).files?.[0]
	if (!file) return
	if (!file.type.startsWith('image/')) {
		message.error('只能上传图片格式')
		return
	}
	const reader = new FileReader()
	reader.onload = (event) => {
		tempImg.value = event.target?.result as string
		showCropper.value = true
		if (fileInput.value) fileInput.value.value = '' // 清除input内容
	}
	reader.readAsDataURL(file)
}

const handleCropSave = () => {
	cropperRef.value.getCropBlob(async (blob: Blob) => {
		isUploading.value = true
		const formData = new FormData()
		formData.append(
			'file',
			new File([blob], 'avatar.png', { type: 'image/png' }),
		)

		try {
			const res = await axios.post(API.UPLOAD, formData)
			formModel.avatarUrl = res.data.fileUrl
			showCropper.value = false
			message.success('头像处理成功')
			// 触发一次局部验证，消除必填警告
			formRef.value?.validate(
				undefined,
				(rule) => rule.key === 'avatarUrl',
			)
		} catch (err) {
			message.error('上传失败，请稍后再试')
		} finally {
			isUploading.value = false
		}
	})
}

/* ================== 逻辑处理：提交注册 ================== */
const submitRegistration = () => {
	formRef.value?.validate(async (errors) => {
		if (errors) {
			message.warning('请检查信息是否完整')
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
				// 发送给 Electron 主进程：关闭子窗口并通知 Login 刷新
				window.electron.ipcRenderer.send(
					'register-success-open-loginWindow',
				)
			} else {
				message.error(res.data.message || '注册失败')
			}
		} catch (err) {
			message.error('网络错误或服务器异常')
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
	background: rgba(255, 255, 255, 0.95);
	backdrop-filter: blur(10px);
	border-radius: 20px;
	padding: 30px 0 15px 0;
}

.avatar-wrapper {
	position: relative;
	width: 80px;
	height: 80px;
	border-radius: 50%;
	overflow: hidden;
	cursor: pointer;
}

.avatar-preview {
	background-color: #f3f4f6;
}

.upload-mask {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.45);
	color: white;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	opacity: 0;
	transition: opacity 0.3s ease;
}

.avatar-wrapper:hover .upload-mask {
	opacity: 1;
}

.hidden {
	display: none;
}

/* 覆盖 Naive UI 一些默认边距 */
:deep(.n-form-item .n-form-item-label) {
	font-size: 13px;
	font-weight: 500;
	color: #4b5563;
	padding-bottom: 4px;
}

/* 预览容器：固定大小且裁切溢出 */
.preview-container {
	border-radius: 50%;
	overflow: hidden;
	background-color: #f3f4f6;
	border: 2px solid white;
	box-shadow: 0 0 0 1px #e5e7eb; /* 细边框线 */
}

.preview-container.large {
	width: 100px;
	height: 100px;
}

.preview-container.small {
	width: 48px;
	height: 48px;
}

/* 关键：取消图片的所有自动缩放限制 */
.preview-content img {
	max-width: none !important;
	max-height: none !important;
}
</style>
