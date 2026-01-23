// src/stores/theme.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { darkTheme } from 'naive-ui'

export const useThemeStore = defineStore(
	'theme',
	() => {
		const isDark = ref(false)

		// 根据布尔值返回 Naive UI 的主题对象
		const naiveTheme = computed(() => (isDark.value ? darkTheme : null))

		function toggleTheme() {
			isDark.value = !isDark.value
		}

		return { isDark, naiveTheme, toggleTheme }
	},
	{
		persist: {
			key: 'theme',
			storage: window.localStorage, // Electron Renderer 可用
		},
	},
)
