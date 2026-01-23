<template>
	<div
		class="h-full w-full rounded-2xl flex flex-col overflow-hidden transition-colors duration-300"
		:class="
			themeStore.isDark
				? 'bg-[#18181c] text-gray-200'
				: 'bg-white text-gray-800'
		"
	>
		<div
			class="h-16 flex items-center px-3 border-b transition-colors duration-300"
			:class="themeStore.isDark ? 'border-gray-800' : 'border-gray-100'"
		>
			<span class="text-xl tracking-tight">设置</span>
		</div>

		<div class="flex-1 flex overflow-hidden">
			<div
				class="w-44 h-full p-2 border-r flex flex-col gap-1 transition-colors duration-300"
				:class="
					themeStore.isDark ? 'border-gray-800' : 'border-gray-100'
				"
			>
				<div
					v-for="menu in menus"
					:key="menu.key"
					:class="[
						'flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all duration-200 group',
						activeKey === menu.key
							? themeStore.isDark
								? 'bg-white text-black '
								: 'bg-[#6666668e] text-white '
							: themeStore.isDark
								? 'text-gray-400 hover:bg-white/5'
								: 'text-gray-600 hover:bg-gray-100',
					]"
					@click="activeKey = menu.key"
				>
					<span class="text-sm">{{ menu.label }}</span>
				</div>
			</div>

			<div class="flex-1 h-full overflow-y-auto p-6 custom-scrollbar">
				<div
					v-if="activeKey === 'appearance'"
					class="max-w-2xl animate-fade-in"
				>
					<header class="mb-2">
						<h2 class="text-lg mb-2">
							{{ menus[0].label }}
						</h2>
						<p class="text-gray-400 text-xs">
							在这里您可以自定义应用的外观和布局
						</p>
					</header>

					<div class="space-y-4">
						<div
							v-for="item in appearanceSettings"
							:key="item.title"
							class="setting-item-card"
						>
							<div class="setting-info">
								<span class="setting-title">{{
									item.title
								}}</span>
								<span class="setting-desc">{{
									item.desc
								}}</span>
							</div>

							<n-switch
								v-if="item.title === '深色模式'"
								v-model:value="themeStore.isDark"
								size="large"
								:rail-style="railStyle"
							>
							</n-switch>

							<n-switch
								v-else-if="item.type === 'switch'"
								v-model:value="item.value.value"
								size="large"
								:rail-style="railStyle"
							>
							</n-switch>

							<n-checkbox
								v-else-if="item.type === 'checkbox'"
								size="large"
							/>
						</div>
					</div>
				</div>

				<div
					v-else
					class="h-full flex flex-col items-center justify-center opacity-50"
				>
					<n-empty description="该配置项暂未开放" />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, CSSProperties } from 'vue'
import { NSwitch, NEmpty, NCheckbox } from 'naive-ui'
import { useTitleStore } from '@renderer/stores/title'
import { useThemeStore } from '@renderer/stores/theme'

const title = useTitleStore()
const themeStore = useThemeStore()
const activeKey = ref('appearance')

const menus = [
	{ label: '外观设置', key: 'appearance' },
	{ label: '通知提醒', key: 'notify' },
	{ label: '隐私权限', key: 'privacy' },
	{ label: '关于软件', key: 'about' },
]

// 将设置项抽象化，方便渲染
const appearanceSettings = [
	{
		title: '深色模式',
		desc: '在光线较弱的环境下保护您的双眼',
		type: 'switch',
		value: ref(themeStore.isDark),
	},
	{
		title: '侧边栏毛玻璃效果',
		desc: '为左侧导航栏增加高斯模糊质感',
		type: 'switch',
		value: ref(false),
	},
	{
		title: '紧凑布局',
		desc: '在屏幕上展示更多内容',
		type: 'checkbox',
		value: ref(false),
	},
]

const railStyle = ({ checked }: { checked: boolean }): CSSProperties => {
	return checked ? { background: '#10b981' } : {}
}

onMounted(() => {
	title.setTitle('设置')
})
</script>

<style scoped>
/* 1. 使用标准 CSS 定义变量，实现主题自动切换 */
.setting-item-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1.25rem; /* 20px */
	border-radius: 1rem; /* 16px */
	border: 1px solid transparent;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 浅色模式样式 */
.bg-white .setting-item-card {
	background-color: rgba(249, 250, 251, 0.5); /* gray-50/50 */
	border-color: #f3f4f6; /* gray-100 */
}
.bg-white .setting-item-card:hover {
	border-color: #e5e7eb; /* gray-200 */
	background-color: rgba(249, 250, 251, 1);
}

/* 深色模式样式 */
.bg-\[\#18181c\] .setting-item-card {
	background-color: rgba(255, 255, 255, 0.05);
	border-color: rgba(255, 255, 255, 0.05);
}
.bg-\[\#18181c\] .setting-item-card:hover {
	border-color: rgba(255, 255, 255, 0.1);
	background-color: rgba(255, 255, 255, 0.08);
}

.setting-info {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.setting-title {
	font-size: 0.875rem;
	font-weight: 700;
}

.setting-desc {
	font-size: 0.75rem;
	color: #9ca3af; /* gray-400 */
}

/* 动画 */
.animate-fade-in {
	animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(10px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

/* 自定义滚动条样式 */
.custom-scrollbar::-webkit-scrollbar {
	width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
	background-color: rgba(0, 0, 0, 0.1);
	border-radius: 10px;
}
.bg-\[\#18181c\] .custom-scrollbar::-webkit-scrollbar-thumb {
	background-color: rgba(255, 255, 255, 0.1);
}
</style>
