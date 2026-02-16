<template>
	<div class="relative h-screen w-full overflow-hidden bg-linear-to-br from-grad-start via-[#eef5ff] to-[#e9f4ff] dark:via-[#121620]">
		<div class="result-blob pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-sky-300/45 blur-3xl"></div>
		<div class="result-blob-delayed pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-indigo-300/35 blur-3xl"></div>

		<div class="relative z-10 flex h-full items-center justify-center px-3 py-4">
			<div
				class="register-result-shell w-full max-w-[560px] rounded-[12px] border border-white/65 bg-white/88 p-7 backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/88 sm:p-8"
			>
				<section class="register-result-main flex flex-col">
					<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-[#6cb6ff] to-[#2f7fe7]">
						<n-icon size="34" color="#ffffff">
							<CheckmarkCircle />
						</n-icon>
					</div>
					<div class="mb-6 text-center">
						<p class="inline-flex items-center rounded-full bg-[#2f7fe7]/12 px-3 py-1 text-xs font-semibold tracking-wide text-[#2f7fe7]">
							创建账号
						</p>
						<h2 class="mt-3 text-[30px] font-bold leading-tight text-text-main/90">注册成功，欢迎加入 LinkR</h2>
						<p class="mt-1 text-sm text-text-main/55">你的账号已创建完成，复制账号后返回登录即可开始使用。</p>
					</div>

					<div class="register-result-card rounded-[12px] border border-dashed border-[#dbe5f5] bg-white/72 p-5 dark:border-zinc-700 dark:bg-zinc-800/55">
						<p class="text-xs font-bold uppercase tracking-wider text-text-main/45">Spanner ID</p>
						<div class="mt-2 flex items-center gap-3">
							<n-icon size="28" color="#3695ff">
								<CheckmarkCircle />
							</n-icon>
							<p class="result-account text-[30px] font-bold tracking-wider text-text-main/92">{{ prop.userInfo }}</p>
						</div>
						<div class="mt-4">
							<n-button secondary strong size="small" @click="handleCopy">
								<template #icon>
									<n-icon><CopyOutline /></n-icon>
								</template>
								复制账号
							</n-button>
						</div>
					</div>

					<div class="pt-8">
						<div class="space-y-2">
							<n-button type="primary" block size="large" class="result-primary-btn" @click="handleLogin">
								立即登录
							</n-button>
							<n-button quaternary block size="medium" class="result-back-btn" @click="handleLogin">
								返回登录页
							</n-button>
						</div>
					</div>
				</section>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import { CheckmarkCircle, CopyOutline } from '@vicons/ionicons5'
import { useMessage } from 'naive-ui'
import confetti from 'canvas-confetti'
import { useTitleStore } from '@renderer/stores/title'

const prop = defineProps({
	userInfo: { type: String, default: '10000015' },
})

const title = useTitleStore()
const message = useMessage()

title.setTitle('注册成功')

const fireCelebrationConfetti = () => {
	confetti({
		particleCount: 150,
		spread: 70,
		origin: { y: 0.6 },
		colors: ['#3695ff', '#56a7ff', '#fcd34d'],
	})
}

onMounted(() => {
	setTimeout(fireCelebrationConfetti, 500)
})

const handleCopy = () => {
	if (prop.userInfo) {
		navigator.clipboard
			.writeText(prop.userInfo)
			.then(() => {
				message.success('账号已复制到剪贴板')
			})
			.catch(() => {
				message.error('复制失败，请手动记录账号')
			})
	}
}

const handleLogin = () => {
	window.electron?.ipcRenderer.send('register-success-open-loginWindow')
}
</script>

<style scoped>
.register-result-shell {
	animation: auth-fade-up 0.45s ease-out;
}

.result-blob {
	animation: blob-float 9s ease-in-out infinite;
}

.result-blob-delayed {
	animation: blob-float 10s ease-in-out infinite reverse;
}

.result-account {
	font-family:
		'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo,
		Monaco, Consolas, monospace;
	word-break: break-all;
}

:deep(.result-primary-btn.n-button--primary-type) {
	border: none;
	border-radius: 12px;
	background: linear-gradient(180deg, #3695ff 0%, #2f7fe7 100%);
	transition: transform 0.2s ease;
}

:deep(.result-primary-btn.n-button--primary-type:hover) {
	background: linear-gradient(180deg, #4aa2ff 0%, #2f7fe7 100%);
	transform: translateY(-1px);
}

:deep(.result-primary-btn.n-button--primary-type:active) {
	background: linear-gradient(180deg, #2f88f0 0%, #266fd3 100%);
}

:deep(.result-back-btn.n-button) {
	border-radius: 12px;
	color: rgba(31, 41, 55, 0.68);
	font-weight: 600;
	transition: transform 0.2s ease;
}

:deep(.result-back-btn.n-button:hover) {
	transform: translateY(-1px);
}

:deep(.dark .result-back-btn.n-button) {
	color: rgba(229, 231, 235, 0.76);
}

@media (max-height: 760px) {
	.register-result-shell {
		padding-top: 1.25rem;
		padding-bottom: 1.25rem;
	}

	.register-result-main {
		gap: 0.5rem;
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
