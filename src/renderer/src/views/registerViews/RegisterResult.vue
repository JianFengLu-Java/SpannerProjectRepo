<template>
	<div
		class="h-full w-full bg-neutral-50 flex relative items-center justify-center overflow-hidden"
	>
		<div class="h-40 w-full bg-neutral-50 absolute top-0 left-0 z-99"></div>
		<div
			class="absolute left-0 top-39 w-full z-88 h-2 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.2)_0%,transparent_70%)]"
		></div>
		<div class="printer-slot">
			<div class="ticket-card">
				<div class="h-2 w-full bg-neutral-800 rounded-t-xl"></div>

				<div class="p-8 flex flex-col items-center relative">
					<div class="mb-6 scale-125">
						<n-result status="success" />
					</div>

					<h2 class="text-2xl font-bold text-neutral-800 mb-2">
						注册成功
					</h2>
					<p class="text-neutral-400 text-sm mb-8">
						欢迎加入，开启您的全新旅程
					</p>

					<div
						class="w-full bg-neutral-50 rounded-xl p-6 border-2 border-dashed border-neutral-200 relative mb-4"
					>
						<p
							class="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 text-center"
						>
							您的专属账号
						</p>
						<div class="flex items-center justify-center">
							<span
								class="text-4xl font-black text-orange-600 tracking-tight can-select"
							>
								{{ prop.userInfo }}
							</span>
						</div>
					</div>

					<div class="tear-line w-full my-6"></div>

					<div class="w-full space-y-3">
						<n-button
							block
							type="primary"
							size="large"
							round
							color="#1a1a1a"
							@click="handleLogin"
						>
							<span class="font-bold">立即前往登录</span>
						</n-button>
					</div>
				</div>

				<div class="ticket-stub"></div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import confetti from 'canvas-confetti'

const prop = defineProps({
	userInfo: { type: String, default: '10000015' },
})

const fireCelebrationConfetti = () => {
	confetti({
		particleCount: 150,
		spread: 70,
		origin: { y: 0.6 },
		colors: ['#ea580c', '#1a1a1a', '#fbbf24'], // 使用与 UI 匹配的颜色
	})
}

onMounted(() => {
	setTimeout(fireCelebrationConfetti, 1200)
})

const handleLogin = () => {
	window.electron?.ipcRenderer.send('register-success-open-loginWindow')
}
</script>

<style scoped>
/* 容器：模拟打印机出纸口 */
.printer-slot {
	perspective: 1200px;
	padding-bottom: 50px; /* 为下方掉落预留空间 */
}

/* 票据主体 */
.ticket-card {
	width: 350px;
	background: white;
	position: relative;
	border-radius: 12px 12px 0 0;
	box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.1);
	animation: print-out 3s cubic-bezier(0.4, 1, 0.36, 1) forwards;
	/* 关键：去掉 overflow-hidden 才能看到两侧缺口 */
}

/* 撕裂线样式 */
.tear-line {
	border-top: 2px dotted #e5e5e5;
	position: relative;
}

/* 底部锯齿 */
.ticket-stub {
	position: absolute;
	bottom: -10px;
	left: 0;
	width: 100%;
	height: 10px;
	background: white;
	/* 使用 mask 完美裁剪锯齿 */
	-webkit-mask-image: radial-gradient(
		circle at 5px 10px,
		transparent 5px,
		black 5px
	);
	-webkit-mask-size: 10px 10px;
	mask-image: radial-gradient(circle at 5px 10px, transparent 5px, black 5px);
	mask-size: 10px 10px;
}

/* 出票动画：带有轻微的伸缩感 */
@keyframes print-out {
	0% {
		transform: translateY(-100%) scaleY(0.95);
		opacity: 0;
	}
	100% {
		transform: translateY(0) scaleY(1);
		opacity: 1;
	}
}

.can-select {
	user-select: text;
	cursor: text;
	display: inline-block;
	animation: pulse-soft 3s infinite ease-in-out;
}

@keyframes pulse-soft {
	0%,
	100% {
		transform: scale(1);
	}
	50% {
		transform: scale(1);
	}
}
</style>
