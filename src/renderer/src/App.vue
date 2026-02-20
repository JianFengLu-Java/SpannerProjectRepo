<script setup lang="ts">
import { computed, watchEffect, ref, onMounted } from 'vue' // 引入 watchEffect
import {
	darkTheme,
	NConfigProvider,
	NDialogProvider,
	NMessageProvider,
} from 'naive-ui'
import Dragable from './components/Dragable.vue'
import { useThemeStore } from '@renderer/stores/theme'
import { getThemeOverrides } from '@renderer/config/theme'
import WinTitleBar from './components/WinTitleBar.vue'

const themeStore = useThemeStore()
const isWin: boolean = window.api.platform === 'win32'
const isMaximized = ref(false)

// --- 新增：同步 Tailwind v4 的黑夜模式类名 ---
watchEffect(() => {
	if (themeStore.isDark) {
		document.documentElement.classList.add('dark')
	} else {
		document.documentElement.classList.remove('dark')
	}
})

const currentTheme = computed(() => (themeStore.isDark ? darkTheme : null))
const currentOverrides = computed(() => getThemeOverrides(themeStore.isDark))

onMounted(() => {
	if (isWin) {
		window.api.onWindowMaximizeChange((val) => {
			isMaximized.value = val
		})
	}
})
</script>

<template>
	<n-config-provider
		:theme="currentTheme"
		:theme-overrides="currentOverrides"
	>
		<dragable v-if="!isWin" />
		<div
			class="h-screen w-screen overflow-hidden flex flex-col relative bg-page-bg"
			:class="[
				isWin && !isMaximized ? 'rounded-[12px] shadow-xl' : '',
			]"
		>
			<win-title-bar
				v-if="isWin"
				class="shrink-0 absolute top-0 z-1000!"
			/>
			<div class="h-full w-full overflow-hidden flex flex-row">
				<n-dialog-provider>
					<n-message-provider
						:container-style="{ marginTop: '22px' }"
						:max="5"
					>
						<router-view />
					</n-message-provider>
				</n-dialog-provider>
			</div>
		</div>
	</n-config-provider>
</template>

<style>
/* 建议去掉这里的 * { transition }，因为这会导致所有元素（包括图标和文字）在页面加载时闪烁 */
/* 仅针对需要平滑变色的背景和边框设置过渡 */
body {
	transition:
		background-color 0.5s ease,
		color 0.5s ease;
}

* {
	user-select: none;
	-webkit-user-select: none;
}

input,
textarea {
	user-select: text !important;
	-webkit-user-select: text !important;
}

/* 适配黑夜模式的滚动条 */
::-webkit-scrollbar {
	width: 6px;
}
::-webkit-scrollbar-thumb {
	background: rgba(128, 128, 128, 0.3);
	border-radius: 10px;
}
/* 当处于黑夜模式时，滚动条可以调亮一点点 */
.dark ::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.2);
}

.n-modal {
	border-radius: 6px !important;
}

.n-modal .n-card {
	border-radius: 6px !important;
}
</style>
