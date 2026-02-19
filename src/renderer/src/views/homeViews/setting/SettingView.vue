<template>
	<div
		class="h-full w-full rounded-2xl flex flex-col overflow-hidden transition-colors duration-300 bg-page-bg text-text-main"
	>
		<div
			class="px-6 border-b border-border-default transition-colors duration-300 setting-header"
		>
			<div class="setting-header-inner">
				<div>
					<div class="text-xl font-bold tracking-tight">系统设置</div>
					<p class="text-xs mt-1 text-gray-500 dark:text-gray-400">
						管理应用外观、通知和隐私偏好
					</p>
				</div>
				<div class="hidden md:flex items-center gap-2">
					<span class="stat-chip">
						{{ themeStore.isDark ? '深色主题' : '浅色主题' }}
					</span>
					<span class="stat-chip">
						{{
							appSettings.notificationsEnabled
								? '通知已开启'
								: '通知已关闭'
						}}
					</span>
				</div>
			</div>
		</div>

		<div class="setting-main flex-1 flex overflow-hidden">
			<!-- Sidebar Menu -->
			<div
				class="w-52 h-full p-3 border-r border-border-default flex flex-col gap-1 transition-colors duration-300 setting-sidebar"
			>
				<div
					v-for="(menu, index) in menus"
					:key="menu.key"
					:ref="(el) => setMenuRef(el, index)"
					role="button"
					tabindex="0"
					:aria-selected="activeKey === menu.key"
					:class="[
						'menu-item flex items-center gap-3 px-4 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group',
						activeKey === menu.key
							? 'menu-item-active'
							: themeStore.isDark
								? 'text-gray-400 hover:bg-white/5 hover:text-white'
								: 'text-gray-600 hover:bg-gray-50 dark:hover:bg-zinc-800/60',
					]"
					@click="selectMenu(menu.key)"
					@keydown="onMenuKeydown($event, index)"
				>
					<component :is="menu.icon" class="w-4 h-4" />
					<span class="text-sm font-medium">{{ menu.label }}</span>
				</div>
			</div>

			<!-- Content Area -->
			<div
				class="setting-content flex-1 h-full overflow-y-auto p-8 custom-scrollbar"
			>
				<transition name="settings-panel" mode="out-in">
					<div
						:key="activeKey"
						class="setting-panel max-w-3xl animate-fade-in"
					>
						<header class="setting-section-header mb-6">
							<h2 class="setting-section-title">
								{{ currentMenu?.label }}
							</h2>
							<p class="setting-section-desc">
								{{ currentMenu?.desc }}
							</p>
						</header>

						<!-- Appearance Settings -->
						<div
							v-if="activeKey === 'appearance'"
							class="space-y-4 section-shell"
						>
							<div class="setting-item-card">
								<div class="setting-info">
									<span class="setting-title">深色模式</span>
									<span class="setting-desc"
										>切换到夜间视觉风格</span
									>
								</div>
								<div class="setting-control">
									<span class="setting-state">{{
										themeStore.isDark ? '已开启' : '已关闭'
									}}</span>
									<n-switch
										v-model:value="themeStore.isDark"
										size="large"
										:rail-style="railStyle"
									/>
								</div>
							</div>
							<div class="setting-item-card">
								<div class="setting-info">
									<span class="setting-title">紧凑模式</span>
									<span class="setting-desc"
										>在列表和消息中展示更多内容</span
									>
								</div>
								<div class="setting-control">
									<span class="setting-state">{{
										appSettings.compactMode
											? '已开启'
											: '已关闭'
									}}</span>
									<n-switch
										v-model:value="appSettings.compactMode"
										size="large"
										:rail-style="railStyle"
									/>
								</div>
							</div>
						</div>

						<!-- Task Settings -->
						<div
							v-else-if="activeKey === 'task'"
							class="space-y-4 section-shell"
						>
							<div class="setting-item-card">
								<div class="setting-info">
									<span class="setting-title"
										>应用内链接使用侧栏网页槽</span
									>
									<span class="setting-desc"
										>开启后，应用内链接将通过侧栏临时
										WebView 打开</span
									>
								</div>
								<div class="setting-control">
									<span class="setting-state">{{
										appSettings.routeLinksThroughSidebarWebview
											? '已开启'
											: '已关闭'
									}}</span>
									<n-switch
										v-model:value="
											appSettings.routeLinksThroughSidebarWebview
										"
										size="large"
										:rail-style="railStyle"
									/>
								</div>
							</div>
							<div class="setting-item-card">
								<div class="setting-info">
									<span class="setting-title">开机启动</span>
									<span class="setting-desc"
										>电脑启动时自动运行应用</span
									>
								</div>
								<div class="setting-control">
									<span class="setting-state">{{
										settings.autoStart ? '已开启' : '已关闭'
									}}</span>
									<n-switch
										v-model:value="settings.autoStart"
										size="large"
										:rail-style="railStyle"
										@update:value="handleAutoStartToggle"
									/>
								</div>
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
								<div class="setting-control">
									<span class="setting-state">{{
										settings.minimizeToTray
											? '已开启'
											: '已关闭'
									}}</span>
									<n-switch
										v-model:value="settings.minimizeToTray"
										size="large"
										:rail-style="railStyle"
										@update:value="
											handleMinimizeToTrayToggle
										"
									/>
								</div>
							</div>
						</div>

						<!-- Notification Settings -->
						<div
							v-else-if="activeKey === 'notify'"
							class="space-y-4 section-shell"
						>
							<div class="setting-item-card">
								<div class="setting-info">
									<span class="setting-title">消息通知</span>
									<span class="setting-desc"
										>接收来自系统和聊天的通知推送</span
									>
								</div>
								<div class="setting-control">
									<span class="setting-state">{{
										appSettings.notificationsEnabled
											? '已开启'
											: '已关闭'
									}}</span>
									<n-switch
										v-model:value="
											appSettings.notificationsEnabled
										"
										size="large"
										:rail-style="railStyle"
									/>
								</div>
							</div>
							<div class="setting-item-card">
								<div class="setting-info">
									<span class="setting-title"
										>新消息提醒显示类型</span
									>
									<span class="setting-desc"
										>选择系统提醒展示的消息内容级别</span
									>
								</div>
								<n-radio-group
									v-model:value="
										appSettings.messageReminderDisplayType
									"
									size="small"
									:disabled="
										!appSettings.notificationsEnabled
									"
								>
									<n-radio value="detail">显示正文</n-radio>
									<n-radio value="sender"
										>仅显示联系人</n-radio
									>
									<n-radio value="summary"
										>仅提示新消息</n-radio
									>
								</n-radio-group>
							</div>
						</div>

						<!-- Privacy Settings -->
						<div
							v-else-if="activeKey === 'privacy'"
							class="space-y-4 section-shell"
						>
							<div class="setting-item-card">
								<div class="setting-info">
									<span class="setting-title">安全 PIN</span>
									<span class="setting-desc"
										>6 位数字，用于聊天转账消费校验</span
									>
								</div>
								<div class="setting-control">
									<span class="setting-state">{{
										securityPasswordSet
											? 'PIN已设置'
											: 'PIN未设置'
									}}</span>
									<n-button
										type="primary"
										@click="openSecurityPasswordModal"
									>
										{{
											securityPasswordSet
												? '修改 PIN'
												: '设置 PIN'
										}}
									</n-button>
								</div>
							</div>
							<div class="setting-item-card">
								<div class="setting-info">
									<span class="setting-title"
										>清除应用缓存</span
									>
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
						<div
							v-else-if="activeKey === 'about'"
							class="space-y-6 section-shell"
						>
							<div
								class="about-card flex flex-col items-center justify-center p-8 rounded-2xl"
							>
								<div
									class="w-20 h-20 rounded-2xl mb-4 flex items-center justify-center app-logo-box"
								>
									<span class="text-white text-3xl font-bold"
										>S</span
									>
								</div>
								<h3 class="text-xl font-bold">Spanner</h3>
								<p
									class="text-gray-500 dark:text-gray-300 text-sm mt-1"
								>
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
									<span class="setting-desc"
										>访问我们的主页</span
									>
								</div>
								<n-button
									quaternary
									type="info"
									@click="
										openExternal(
											'https://electron-vite.org',
										)
									"
								>
									访问
								</n-button>
							</div>
						</div>
					</div>
				</transition>
			</div>
		</div>

			<n-modal
				v-model:show="showSecurityPasswordModal"
				preset="card"
				class="app-modal-card"
				:title="securityPasswordSet ? '修改安全 PIN' : '设置安全 PIN'"
				style="width: min(440px, 94vw)"
				:mask-closable="false"
			>
			<n-form label-placement="left" label-width="90">
				<n-form-item v-if="securityPasswordSet" label="当前 PIN">
					<n-input
						v-model:value="oldSecurityPassword"
						type="password"
						show-password-on="mousedown"
						:maxlength="6"
						placeholder="请输入当前6位PIN"
					/>
				</n-form-item>
				<n-form-item label="新 PIN">
					<n-input
						v-model:value="newSecurityPassword"
						type="password"
						show-password-on="mousedown"
						:maxlength="6"
						placeholder="请输入新的6位PIN"
					/>
				</n-form-item>
				<n-form-item label="确认 PIN">
					<n-input
						v-model:value="confirmSecurityPassword"
						type="password"
						show-password-on="mousedown"
						:maxlength="6"
						placeholder="请再次输入新的6位PIN"
					/>
				</n-form-item>
			</n-form>
			<div class="mt-3 flex justify-end gap-2">
				<n-button @click="showSecurityPasswordModal = false"
					>取消</n-button
				>
				<n-button
					type="primary"
					:loading="securityPasswordLoading"
					@click="submitSecurityPassword"
					>确认</n-button
				>
			</div>
		</n-modal>
	</div>
</template>

<script setup lang="ts">
import {
	ref,
	onMounted,
	onUnmounted,
	computed,
	CSSProperties,
	reactive,
	nextTick,
	ComponentPublicInstance,
	watch,
} from 'vue'
import {
	NSwitch,
	NButton,
	NRadioGroup,
	NRadio,
	NModal,
	NForm,
	NFormItem,
	NInput,
	useMessage,
} from 'naive-ui'
import { useTitleStore } from '@renderer/stores/title'
import { useThemeStore } from '@renderer/stores/theme'
import { useAppSettingsStore } from '@renderer/stores/appSettings'
import { useInAppBrowserStore } from '@renderer/stores/inAppBrowser'
import { useUserInfoStore } from '@renderer/stores/userInfo'
import { useWalletStore } from '@renderer/stores/wallet'
import { storeToRefs } from 'pinia'
import { tokenManager } from '@renderer/services/tokenManager'
import { useRouter } from 'vue-router'
import {
	ColorPaletteOutline,
	NotificationsOutline,
	ShieldCheckmarkOutline,
	InformationCircleOutline,
	SettingsOutline,
} from '@vicons/ionicons5'

const title = useTitleStore()
const themeStore = useThemeStore()
const appSettings = useAppSettingsStore()
const inAppBrowserStore = useInAppBrowserStore()
const userInfoStore = useUserInfoStore()
const walletStore = useWalletStore()
const { securityPasswordSet } = storeToRefs(walletStore)
const message = useMessage()
const router = useRouter()
const activeKey = ref('appearance')
const appVersion = ref('1.0.0')
const menuRefs = ref<(HTMLElement | null)[]>([])
const showSecurityPasswordModal = ref(false)
const oldSecurityPassword = ref('')
const newSecurityPassword = ref('')
const confirmSecurityPassword = ref('')
const securityPasswordLoading = ref(false)
const PIN_PATTERN = /^\d{6}$/

const settings = reactive({
	autoStart: false,
	minimizeToTray: false,
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

const setMenuRef = (
	el: Element | ComponentPublicInstance | null,
	index: number,
): void => {
	if (!el) {
		menuRefs.value[index] = null
		return
	}
	if (el instanceof Element) {
		menuRefs.value[index] = el as HTMLElement
		return
	}
	if ('$el' in el) {
		menuRefs.value[index] = (el.$el as HTMLElement | null) ?? null
		return
	}
	menuRefs.value[index] = null
}

const selectMenu = (key: string): void => {
	activeKey.value = key
}

const focusMenuByIndex = async (index: number): Promise<void> => {
	await nextTick()
	menuRefs.value[index]?.focus()
}

const onMenuKeydown = (event: KeyboardEvent, index: number): void => {
	if (event.key === 'ArrowDown') {
		event.preventDefault()
		const next = index >= menus.length - 1 ? 0 : index + 1
		selectMenu(menus[next].key)
		void focusMenuByIndex(next)
		return
	}
	if (event.key === 'ArrowUp') {
		event.preventDefault()
		const prev = index <= 0 ? menus.length - 1 : index - 1
		selectMenu(menus[prev].key)
		void focusMenuByIndex(prev)
		return
	}
	if (event.key === 'Enter' || event.key === ' ') {
		event.preventDefault()
		selectMenu(menus[index].key)
	}
}

const railStyle = ({ checked }: { checked: boolean }): CSSProperties => {
	return checked ? { background: '#3695ff' } : {}
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

const clearRendererPersistentStorage = async (): Promise<void> => {
	// Pinia 持久化、token、偏好等都在 localStorage
	window.localStorage.clear()
	window.sessionStorage.clear()

	// 删除浏览器侧 IndexedDB
	try {
		const dbFactory = indexedDB as IDBFactory & {
			databases?: () => Promise<Array<{ name?: string }>>
		}
		if (typeof dbFactory.databases === 'function') {
			const databases = await dbFactory.databases()
			await Promise.all(
				(databases || [])
					.map((item) => item?.name)
					.filter((name): name is string => !!name)
					.map(
						(name) =>
							new Promise<void>((resolve) => {
								const req = indexedDB.deleteDatabase(name)
								req.onsuccess = () => resolve()
								req.onerror = () => resolve()
								req.onblocked = () => resolve()
							}),
					),
			)
		}
	} catch (error) {
		console.warn('清理 IndexedDB 失败:', error)
	}

	// 删除 CacheStorage（service worker 缓存）
	try {
		if ('caches' in window) {
			const keys = await caches.keys()
			await Promise.all(keys.map((key) => caches.delete(key)))
		}
	} catch (error) {
		console.warn('清理 CacheStorage 失败:', error)
	}
}

const handleClearCache = async (): Promise<void> => {
	try {
		await window.electron.ipcRenderer.invoke('clear-app-cache')
		await clearRendererPersistentStorage()
		tokenManager.clear()
		userInfoStore.logout()
		message.success('本地持久化数据已全部清除')
		await router.replace({ name: 'Login' })
		window.location.reload()
	} catch {
		message.error('清理失败')
	}
}

const handleCheckUpdate = (): void => {
	message.info('当前已是最新版本')
}

const openExternal = (url: string): void => {
	if (
		appSettings.routeLinksThroughSidebarWebview &&
		/^https?:\/\//i.test(url)
	) {
		const session = inAppBrowserStore.openUrl(url)
		if (session) return
	}
	window.electron.ipcRenderer.send('open-external-url', url)
}

const openSecurityPasswordModal = (): void => {
	oldSecurityPassword.value = ''
	newSecurityPassword.value = ''
	confirmSecurityPassword.value = ''
	showSecurityPasswordModal.value = true
}

const submitSecurityPassword = async (): Promise<void> => {
	if (securityPasswordLoading.value) return
	const wasSet = securityPasswordSet.value
	const oldPin = oldSecurityPassword.value.trim()
	const newPin = newSecurityPassword.value.trim()
	const confirmPin = confirmSecurityPassword.value.trim()
	if (wasSet && !PIN_PATTERN.test(oldPin)) {
		message.warning('请输入当前6位数字PIN')
		return
	}
	if (!PIN_PATTERN.test(newPin)) {
		message.warning('新PIN必须为6位数字')
		return
	}
	if (newPin !== confirmPin) {
		message.warning('两次输入的新PIN不一致')
		return
	}
	securityPasswordLoading.value = true
	try {
		await walletStore.setSecurityPassword({
			oldSecurityPassword: wasSet ? oldPin : undefined,
			newSecurityPassword: newPin,
		})
		showSecurityPasswordModal.value = false
		message.success(wasSet ? '安全PIN修改成功' : '安全PIN设置成功')
	} catch (error) {
		const maybeResponse = (
			error as { response?: { data?: { message?: string } } }
		).response
		message.error(maybeResponse?.data?.message || 'PIN设置失败，请稍后重试')
	} finally {
		securityPasswordLoading.value = false
	}
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

onUnmounted(() => {
	showSecurityPasswordModal.value = false
})

watch(
	() => userInfoStore.account,
	(account) => {
		if (!account) {
			walletStore.reset()
			return
		}
		void walletStore.fetchWallet(true)
	},
	{ immediate: true },
)
</script>

<style scoped>
.setting-page {
	background:
		radial-gradient(
			circle at 100% 0%,
			rgba(98, 164, 255, 0.11),
			transparent 46%
		),
		linear-gradient(158deg, #f8fbff 0%, #f1f6ff 45%, #e8f1ff 100%);
}

.dark .setting-page {
	background:
		radial-gradient(
			circle at 100% 0%,
			rgba(74, 134, 255, 0.16),
			transparent 48%
		),
		linear-gradient(160deg, #111827 0%, #111b2e 48%, #15223a 100%);
}

.setting-header,
.setting-sidebar {
	background-color: rgba(255, 255, 255, 0.45);
	backdrop-filter: blur(18px);
}

.setting-header-inner {
	min-height: 5rem;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
}

.setting-section-header {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
}

.setting-section-title {
	font-size: 1.2rem;
	line-height: 1.35;
	font-weight: 650;
	letter-spacing: 0.01em;
}

.setting-section-desc {
	font-size: 0.84rem;
	line-height: 1.45;
	color: #9ca3af;
}

.dark .setting-section-desc {
	color: #6b7280;
}

.dark .setting-header,
.dark .setting-sidebar {
	background-color: rgba(18, 18, 20, 0.45);
}

.stat-chip {
	padding: 0.25rem 0.6rem;
	border-radius: 999px;
	font-size: 0.75rem;
	font-weight: 500;
	color: rgb(15, 118, 110);
	background: rgba(54, 149, 255, 0.15);
	border: 1px solid rgba(54, 149, 255, 0.2);
}

.dark .stat-chip {
	color: rgb(167, 243, 208);
	background: rgba(54, 149, 255, 0.16);
	border-color: rgba(52, 211, 153, 0.2);
}

.menu-item {
	position: relative;
	outline: none;
}

.menu-item-active {
	color: #2f7fe7;
	background: rgba(54, 149, 255, 0.14);
}

.dark .menu-item-active {
	color: #6ee7b7;
	background: rgba(54, 149, 255, 0.18);
}

.menu-item:focus-visible {
	outline: 2px solid rgba(54, 149, 255, 0.35);
	outline-offset: 0;
}

.section-shell {
	background: rgba(255, 255, 255, 0.45);
	border: 1px solid rgba(15, 23, 42, 0.06);
	padding: 1rem;
	border-radius: 1.25rem;
}

.dark .section-shell {
	background: rgba(255, 255, 255, 0.03);
	border-color: rgba(255, 255, 255, 0.08);
}

.setting-item-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1.5rem;
	border-radius: 1.25rem;
	border: 1px solid transparent;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.setting-item-card {
	background: rgba(255, 255, 255, 0.72);
	border-color: rgba(15, 23, 42, 0.08);
}

.setting-item-card:hover {
	border-color: rgba(54, 149, 255, 0.32);
	background-color: #ffffff;
}

.dark .setting-item-card {
	background-color: rgba(255, 255, 255, 0.02);
	border-color: rgba(255, 255, 255, 0.08);
}

.dark .setting-item-card:hover {
	border-color: rgba(52, 211, 153, 0.34);
	background-color: rgba(255, 255, 255, 0.06);
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

.setting-control {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.setting-state {
	display: inline-flex;
	align-items: center;
	padding: 0.22rem 0.55rem;
	border-radius: 999px;
	font-size: 0.75rem;
	color: #0f766e;
	background-color: rgba(54, 149, 255, 0.12);
	border: 1px solid rgba(54, 149, 255, 0.22);
}

.dark .setting-state {
	color: #99f6e4;
	background-color: rgba(20, 184, 166, 0.18);
	border-color: rgba(45, 212, 191, 0.28);
}

.about-card {
	background:
		radial-gradient(
			1200px circle at 10% 0%,
			rgba(112, 176, 255, 0.14),
			transparent 55%
		),
		rgba(255, 255, 255, 0.5);
	border: 1px solid rgba(15, 23, 42, 0.06);
}

.dark .about-card {
	background:
		radial-gradient(
			1200px circle at 10% 0%,
			rgba(82, 146, 255, 0.18),
			transparent 55%
		),
		rgba(255, 255, 255, 0.05);
	border-color: rgba(255, 255, 255, 0.08);
}

.app-logo-box {
	background: linear-gradient(135deg, #5fa9ff, #7abaff);
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
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
	background-color: rgba(255, 255, 255, 0.05);
}

.settings-panel-enter-active,
.settings-panel-leave-active {
	transition:
		opacity 0.22s ease,
		transform 0.22s ease;
}

.settings-panel-enter-from,
.settings-panel-leave-to {
	opacity: 0;
	transform: translateY(6px);
}

@media (max-width: 900px) {
	.setting-header {
		padding-left: 1rem;
		padding-right: 1rem;
	}

	.setting-header-inner {
		min-height: 4.5rem;
	}

	.setting-main {
		flex-direction: column;
	}

	.setting-sidebar {
		width: 100%;
		height: auto;
		padding: 0.6rem 0.8rem;
		border-right: 0;
		border-bottom: 1px solid rgba(15, 23, 42, 0.08);
		flex-direction: row;
		gap: 0.5rem;
		overflow-x: auto;
		white-space: nowrap;
		position: relative;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.setting-sidebar::-webkit-scrollbar {
		display: none;
	}

	.setting-content {
		padding: 1.25rem;
	}

	.setting-panel {
		max-width: 100%;
	}

	.setting-section-title {
		font-size: 1.12rem;
	}

	.setting-section-desc {
		font-size: 0.8rem;
	}

	.menu-item {
		flex: 0 0 auto;
		padding-left: 0.85rem;
		padding-right: 0.85rem;
	}

	.setting-item-card {
		padding: 1rem;
	}

	.setting-control {
		gap: 0.5rem;
	}
}

@media (max-width: 640px) {
	.setting-header {
		padding-left: 0.85rem;
		padding-right: 0.85rem;
	}

	.setting-header-inner {
		min-height: 4rem;
	}

	.setting-sidebar {
		padding-top: 0.55rem;
		padding-bottom: 0.55rem;
	}

	.setting-content {
		padding: 1rem 0.85rem 1.2rem;
	}

	.setting-section-header {
		gap: 0.25rem;
	}

	.setting-section-title {
		font-size: 1.02rem;
	}

	.setting-section-desc {
		font-size: 0.76rem;
		line-height: 1.4;
	}

	.section-shell {
		padding: 0.75rem;
		border-radius: 1rem;
	}

	.setting-item-card {
		flex-direction: column;
		align-items: flex-start;
		gap: 0.85rem;
		padding: 0.9rem;
		border-radius: 1rem;
	}

	.setting-control {
		width: 100%;
		justify-content: space-between;
	}

	.about-card {
		padding: 1.1rem;
	}

	:deep(.n-radio-group) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 0.8rem;
	}
}
</style>
