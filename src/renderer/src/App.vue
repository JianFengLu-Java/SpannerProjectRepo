<script setup lang="ts">
import { computed, watchEffect } from 'vue' // 引入 watchEffect
import {
	darkTheme,
	NConfigProvider,
	NMessageProvider,
	NGlobalStyle,
} from 'naive-ui'
import Dragable from './components/Dragable.vue'
import { useThemeStore } from '@renderer/stores/theme'
import { getThemeOverrides } from '@renderer/config/theme'

const themeStore = useThemeStore()

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
</script>

<template>
	<n-config-provider
		:theme="currentTheme"
		:theme-overrides="currentOverrides"
	>
		<n-global-style />
		<dragable />
		<div class="h-screen w-screen overflow-hidden relative">
			<div class="h-full w-full overflow-hidden">
				<n-message-provider
					:container-style="{ marginTop: '22px' }"
					:max="5"
				>
					<router-view />
				</n-message-provider>
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
</style>
