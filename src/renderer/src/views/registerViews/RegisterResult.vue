<template>
	<div
		class="flex h-screen w-screen items-center justify-center bg-linear-to-br from-grad-start to-grad-end"
	>
		<div
			class="w-[420px] bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center"
		>
			<div class="mb-6 flex justify-center">
				<div
					class="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center"
				>
					<n-icon size="32" color="#10b981">
						<CheckmarkCircle />
					</n-icon>
				</div>
			</div>

			<h2 class="text-2xl font-bold text-gray-800 mb-2">注册成功</h2>
			<p class="text-gray-500 text-sm mb-8">
				欢迎加入 LinkR，您的专属账号已生成
			</p>

			<div
				class="bg-gray-50 rounded-xl p-5 border border-dashed border-gray-200 mb-8 relative group"
			>
				<p
					class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2"
				>
					Spanner ID
				</p>
				<div class="flex items-center justify-center gap-3">
					<span
						class="text-3xl font-mono font-bold text-gray-800 tracking-wider"
					>
						{{ prop.userInfo }}
					</span>
				</div>
				<div class="mt-3 flex justify-center">
					<n-button size="tiny" secondary strong @click="handleCopy">
						<template #icon>
							<n-icon><CopyOutline /></n-icon>
						</template>
						复制账号
					</n-button>
				</div>
			</div>

			<div class="space-y-3">
				<n-button
					type="primary"
					block
					size="large"
					class="shadow-lg shadow-primary/20"
					@click="handleLogin"
				>
					立即登录
				</n-button>
				<n-button quaternary block size="medium" @click="handleLogin">
					返回首页
				</n-button>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import { CheckmarkCircle, CopyOutline } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import confetti from 'canvas-confetti'

const prop = defineProps({
	userInfo: { type: String, default: '10000015' },
})

const message = useMessage()

const fireCelebrationConfetti = () => {
	confetti({
		particleCount: 150,
		spread: 70,
		origin: { y: 0.6 },
		colors: ['#10b981', '#34d399', '#fcd34d'],
	})
}

onMounted(() => {
	setTimeout(fireCelebrationConfetti, 500)
})

const handleCopy = () => {
	if (prop.userInfo) {
		navigator.clipboard.writeText(prop.userInfo)
		message.success('账号已复制到剪贴板')
	}
}

const handleLogin = () => {
	window.electron?.ipcRenderer.send('register-success-open-loginWindow')
}
</script>

<style scoped>
/* 字体优化 */
.font-mono {
	font-family:
		'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo,
		Monaco, Consolas, monospace;
}
</style>
