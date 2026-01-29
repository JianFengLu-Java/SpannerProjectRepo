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
			class="h-16 flex items-center px-6 border-b transition-colors duration-300"
			:class="themeStore.isDark ? 'border-gray-800' : 'border-gray-100'"
		>
			<span class="text-xl font-bold tracking-tight">系统设置</span>
		</div>

		<div class="flex-1 flex overflow-hidden">
			<!-- Sidebar Menu -->
			<div
				class="w-48 h-full p-3 border-r flex flex-col gap-1 transition-colors duration-300"
				:class="
					themeStore.isDark ? 'border-gray-800' : 'border-gray-100'
				"
			>
				<div
					v-for="menu in menus"
					:key="menu.key"
					:class="[
						'flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group',
						activeKey === menu.key
							? themeStore.isDark
								? 'bg-blue-500/10 text-blue-400'
								: 'bg-blue-50 text-blue-600'
							: themeStore.isDark
								? 'text-gray-400 hover:bg-white/5'
								: 'text-gray-600 hover:bg-gray-50',
					]"
					@click="activeKey = menu.key"
				>
					<component :is="menu.icon" class="w-4 h-4" />
					<span class="text-sm font-medium">{{ menu.label }}</span>
				</div>
			</div>

			<!-- Content Area -->
			<div class="flex-1 h-full overflow-y-auto p-8 custom-scrollbar">
				<div class="max-w-3xl animate-fade-in">
					<header class="mb-8">
						<h2 class="text-2xl font-bold mb-2">
							{{ currentMenu?.label }}
						</h2>
						<p class="text-gray-400 text-sm">
							{{ currentMenu?.desc }}
						</p>
					</header>

					<!-- Appearance Settings -->
					<div v-if="activeKey === 'appearance'" class="space-y-4">
						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title">深色模式</span>
								<span class="setting-desc"
									>随系统或手动切换深色视觉风格</span
								>
							</div>
							<n-switch
								v-model:value="themeStore.isDark"
								size="large"
								:rail-style="railStyle"
							/>
						</div>
						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title">紧凑模式</span>
								<span class="setting-desc"
									>在列表和消息中展示更多内容</span
								>
							</div>
							<n-switch
								v-model:value="settings.compactMode"
								size="large"
								:rail-style="railStyle"
							/>
						</div>
					</div>

					<!-- Task Settings -->
					<div v-else-if="activeKey === 'task'" class="space-y-4">
						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title">开机启动</span>
								<span class="setting-desc"
									>电脑启动时自动运行应用</span
								>
							</div>
							<n-switch
								v-model:value="settings.autoStart"
								size="large"
								:rail-style="railStyle"
								@update:value="handleAutoStartToggle"
							/>
						</div>
						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title"
									>关闭窗口时最小化到托盘</span
								>
								<span class="setting-desc"
									>点击关闭按钮不退出程序，而是在后台运行</span
								>
							</div>
							<n-switch
								v-model:value="settings.minimizeToTray"
								size="large"
								:rail-style="railStyle"
								@update:value="handleMinimizeToTrayToggle"
							/>
						</div>
					</div>

					<!-- Notification Settings -->
					<div v-else-if="activeKey === 'notify'" class="space-y-4">
						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title">消息通知</span>
								<span class="setting-desc"
									>接收来自系统和聊天的通知推送</span
								>
							</div>
							<n-switch
								v-model:value="settings.notifications"
								size="large"
								:rail-style="railStyle"
							/>
						</div>
						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title">消息预览</span>
								<span class="setting-desc"
									>在通知弹窗中显示消息正文</span
								>
							</div>
							<n-switch
								v-model:value="settings.notifyPreview"
								size="large"
								:rail-style="railStyle"
							/>
						</div>
					</div>

					<!-- Privacy Settings -->
					<div v-else-if="activeKey === 'privacy'" class="space-y-4">
						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title">清除应用缓存</span>
								<span class="setting-desc"
									>清除所有本地缓存文件和存储数据</span
								>
							</div>
							<n-button
								secondary
								strong
								type="error"
								@click="handleClearCache"
							>
								立即清除
							</n-button>
						</div>
					</div>

					<!-- About Settings -->
					<div v-else-if="activeKey === 'about'" class="space-y-6">
						<div
							class="flex flex-col items-center justify-center p-8 bg-black/5 rounded-2xl"
						>
							<div
								class="w-20 h-20 bg-blue-500 rounded-2xl mb-4 flex items-center justify-center shadow-lg shadow-blue-500/20"
							>
								<span class="text-white text-3xl font-bold"
									>S</span
								>
							</div>
							<h3 class="text-xl font-bold">Spanner</h3>
							<p class="text-gray-500 text-sm mt-1">
								Version {{ appVersion }}
							</p>
						</div>

						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title">检查更新</span>
								<span class="setting-desc"
									>当前已是最新版本</span
								>
							</div>
							<n-button secondary @click="handleCheckUpdate">
								检查更新
							</n-button>
						</div>

						<div class="setting-item-card">
							<div class="setting-info">
								<span class="setting-title">官方网站</span>
								<span class="setting-desc">访问我们的主页</span>
							</div>
							<n-button
								quaternary
								type="info"
								@click="
									openExternal('https://electron-vite.org')
								"
							>
								访问
							</n-button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, CSSProperties, reactive } from 'vue'
import { NSwitch, NButton, useMessage } from 'naive-ui'
import { useTitleStore } from '@renderer/stores/title'
import { useThemeStore } from '@renderer/stores/theme'
import {
	ColorPaletteOutline,
	NotificationsOutline,
	ShieldCheckmarkOutline,
	InformationCircleOutline,
	SettingsOutline,
} from '@vicons/ionicons5'

const title = useTitleStore()
const themeStore = useThemeStore()
const message = useMessage()
const activeKey = ref('appearance')
const appVersion = ref('1.0.0')

const settings = reactive({
	compactMode: false,
	autoStart: false,
	minimizeToTray: true,
	notifications: true,
	notifyPreview: true,
})

const menus = [
	{
		label: '外观设置',
		key: 'appearance',
		icon: ColorPaletteOutline,
		desc: '在这里您可以自定义应用的外观和视觉风格',
	},
	{
		label: '常规设置',
		key: 'task',
		icon: SettingsOutline,
		desc: '管理应用的运行行为和基础配置',
	},
	{
		label: '通知提醒',
		key: 'notify',
		icon: NotificationsOutline,
		desc: '配置消息提醒和通知方式',
	},
	{
		label: '隐私安全',
		key: 'privacy',
		icon: ShieldCheckmarkOutline,
		desc: '保护您的账号隐私和数据安全',
	},
	{
		label: '关于软件',
		key: 'about',
		icon: InformationCircleOutline,
		desc: '了解软件详情和更新动态',
	},
]

const currentMenu = computed(() => menus.find((m) => m.key === activeKey.value))

const railStyle = ({ checked }: { checked: boolean }): CSSProperties => {
	return checked ? { background: '#10b981' } : {}
}

// API 调用
const handleAutoStartToggle = async (value: boolean): Promise<void> => {
	try {
		await window.electron.ipcRenderer.invoke('set-auto-start', value)
		message.success(value ? '已开启开机自启动' : '已关闭开机自启动')
	} catch {
		message.error('设置自启动失败')
		settings.autoStart = !value
	}
}

const handleMinimizeToTrayToggle = (value: boolean): void => {
	window.electron.ipcRenderer.send('set-minimize-to-tray', value)
	message.success(value ? '已开启关闭最小化到托盘' : '已关闭最小化到托盘')
}

const handleClearCache = async (): Promise<void> => {
	try {
		await window.electron.ipcRenderer.invoke('clear-app-cache')
		message.success('清理成功')
	} catch {
		message.error('清理失败')
	}
}

const handleCheckUpdate = (): void => {
	message.info('当前已是最新版本')
}

const openExternal = (url: string): void => {
	window.electron.ipcRenderer.send('open-external-url', url)
}

onMounted(async () => {
	title.setTitle('设置')

	// 获取初始状态
	try {
		appVersion.value =
			await window.electron.ipcRenderer.invoke('get-app-version')
		settings.autoStart =
			await window.electron.ipcRenderer.invoke('get-auto-start')
		settings.minimizeToTray = await window.electron.ipcRenderer.invoke(
			'get-minimize-to-tray',
		)
	} catch (e) {
		console.error('Failed to fetch initial settings', e)
	}
})
</script>

<style scoped>
.setting-item-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1.5rem;
	border-radius: 1.25rem;
	border: 1px solid transparent;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.bg-white .setting-item-card {
	background-color: #f9fafb;
	border-color: #f3f4f6;
}

.bg-white .setting-item-card:hover {
	border-color: #e5e7eb;
	background-color: #ffffff;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.bg-\[\#18181c\] .setting-item-card {
	background-color: rgba(255, 255, 255, 0.03);
	border-color: rgba(255, 255, 255, 0.05);
}

.bg-\[\#18181c\] .setting-item-card:hover {
	border-color: rgba(255, 255, 255, 0.1);
	background-color: rgba(255, 255, 255, 0.06);
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.setting-info {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
}

.setting-title {
	font-size: 0.95rem;
	font-weight: 600;
}

.setting-desc {
	font-size: 0.8rem;
	color: #9ca3af;
}

.animate-fade-in {
	animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
	from {
		opacity: 0;
		transform: translateY(8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.custom-scrollbar::-webkit-scrollbar {
	width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
	background-color: rgba(0, 0, 0, 0.05);
	border-radius: 10px;
}
.bg-\[\#18181c\] .custom-scrollbar::-webkit-scrollbar-thumb {
	background-color: rgba(255, 255, 255, 0.05);
}
</style>
