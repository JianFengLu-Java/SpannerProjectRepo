import { BrowserWindow, Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'path'
import iconPath from '../../../resources/icon.png?asset'

// 定义窗口类型，方便维护
type WindowType =
	| 'login'
	| 'register'
	| 'home'
	| 'view-img'
	| 'chat'
	| 'mock-video-call'
	| 'incoming-call'

// 窗口注册表：保存所有正在运行的窗口实例
export const windowRegistry = new Map<string, BrowserWindow>()
let tray: Tray | null = null
let minimizeToTray = false // 默认关闭

export function setMinimizeToTray(value: boolean): void {
	minimizeToTray = value
}

export function getMinimizeToTray(): boolean {
	return minimizeToTray
}

function createTray(): void {
	if (tray) return

	const icon = nativeImage.createFromPath(iconPath)
	tray = new Tray(icon.resize({ width: 16, height: 16 }))
	const contextMenu = Menu.buildFromTemplate([
		{
			label: '显示应用',
			click: () => {
				const homeWin = windowRegistry.get('home')
				if (homeWin) {
					homeWin.show()
					homeWin.focus()
				}
			},
		},
		{ type: 'separator' },
		{
			label: '退出',
			click: () => {
				app.quit()
			},
		},
	])

	tray.setToolTip('Spanner App')
	tray.setContextMenu(contextMenu)
	tray.on('click', () => {
		const homeWin = windowRegistry.get('home')
		if (homeWin) {
			if (homeWin.isVisible()) {
				homeWin.hide()
			} else {
				homeWin.show()
				homeWin.focus()
			}
		}
	})
}

function createBaseWindow(
	type: WindowType,
	options: Electron.BrowserWindowConstructorOptions,
): BrowserWindow {
	const win = new BrowserWindow({
		show: false,
		frame: false,
		transparent: false,
		resizable: true,
		thickFrame: true,
		backgroundColor: '#ffffff',
		titleBarStyle: 'hidden',
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: false,
			contextIsolation: true,
			webSecurity: false,
			webviewTag: true,
		},
		autoHideMenuBar: true, // 默认开启缩放
		...options,
	})

	// 窗口关闭时逻辑
	win.on('close', (e) => {
		if (type === 'home' && minimizeToTray) {
			e.preventDefault()
			win.hide()
			return
		}
		// 其他情况下，或者不允许最小化到托盘时，正常关闭
		windowRegistry.delete(type)
	})

	win.on('maximize', () => {
		win.webContents.send('window-maximized', true)
	})

	win.on('unmaximize', () => {
		win.webContents.send('window-maximized', false)
	})

	return win
}

function loadPage(window: BrowserWindow, page: string): void {
	const url = process.env.ELECTRON_RENDERER_URL
		? `${process.env.ELECTRON_RENDERER_URL}#/${page}`
		: `file://${join(__dirname, '../renderer/index.html')}#/${page}`

	window.loadURL(url)
	window.once('ready-to-show', () => window.show())
}

/**
 * 核心：打开窗口的方法（支持单例）
 */
function getOrCreateWindow(
	type: WindowType | string,
	options: Electron.BrowserWindowConstructorOptions,
): BrowserWindow {
	// 单例检查：如果窗口已存在，直接聚焦
	const existingWin = windowRegistry.get(type)
	if (existingWin && !existingWin.isDestroyed()) {
		existingWin.focus()
		if (existingWin.isMinimized()) existingWin.restore()
		return existingWin
	}

	// 创建新窗口
	const win = createBaseWindow(type as WindowType, options)
	windowRegistry.set(type, win)
	return win
}

/* ================== 导出方法 ================== */

export function openLoginWindow(): void {
	// 1. 获取或创建登录窗口
	const loginWin = getOrCreateWindow('login', {
		width: 1120,
		height: 760,
		minWidth: 860,
		minHeight: 620,
		resizable: true,
	})
	loginWin.setResizable(true)
	loginWin.setMinimumSize(860, 620)
	loadPage(loginWin, 'login')

	// 2. 关键：关闭注册窗口
	const regWin = windowRegistry.get('register')
	if (regWin && !regWin.isDestroyed()) {
		regWin.destroy() // 直接销毁，避开 close 事件的阻止逻辑
	}

	// 3. 如果是从主页登出的，也关闭主页
	const homeWin = windowRegistry.get('home')
	if (homeWin && !homeWin.isDestroyed()) {
		homeWin.destroy()
	}
}

export function openRegisterWindow(): void {
	const regWin = getOrCreateWindow('register', {
		width: 980,
		height: 800,
		minWidth: 760,
		minHeight: 620,
		resizable: true,
	})
	regWin.setResizable(true)
	regWin.setMinimumSize(760, 620)
	loadPage(regWin, 'register')

	windowRegistry.get('login')?.destroy()
}

export function openHomeWindow(): void {
	const homeWin = getOrCreateWindow('home', {
		width: 1000,
		height: 750,
		minWidth: 550,
		minHeight: 600,
		resizable: true,
	})
	loadPage(homeWin, 'home')

	// 成功进入首页后，销毁登录相关的窗口
	windowRegistry.get('login')?.destroy()
	windowRegistry.get('register')?.destroy()

	// 初始化托盘
	createTray()
}

export function viewIMGWindow(imgURL: string): void {
	// IM 预览器：使用单实例窗口，后续点击图片时复用并更新内容，减少窗口抖动
	const win = getOrCreateWindow('view-img', {
		width: 1200,
		height: 820,
		minWidth: 860,
		minHeight: 560,
		resizable: true,
		backgroundColor: '#0b1020',
	})
	win.setMinimumSize(860, 560)
	const page = `view-img?url=${encodeURIComponent(imgURL)}`
	loadPage(win, page)
	if (win.isMinimized()) win.restore()
	win.focus()
}
export function openChatWindow(chatId: number, chatName: string): void {
	const winKey = `chat-${chatId}`
	const existingWin = windowRegistry.get(winKey)

	if (existingWin && !existingWin.isDestroyed()) {
		existingWin.show()
		existingWin.focus()
		return
	}

	const win = createBaseWindow('chat', {
		width: 600,
		height: 700,
		minWidth: 400,
		minHeight: 500,
		title: chatName,
	})

	const page = `chat-standalone?id=${chatId}&name=${encodeURIComponent(chatName)}`
	loadPage(win, page)

	windowRegistry.set(winKey, win)

	win.on('closed', () => {
		windowRegistry.delete(winKey)
	})
}

export function openMockVideoCallWindow(
	chatId: number,
	chatName: string,
	chatAvatar?: string,
	options?: {
		startConnected?: boolean
	},
): void {
	const winKey = `mock-video-call-${chatId}`
	const existingWin = windowRegistry.get(winKey)
	if (existingWin && !existingWin.isDestroyed()) {
		existingWin.show()
		existingWin.focus()
		return
	}

	const win = new BrowserWindow({
		width: 960,
		height: 640,
		minWidth: 760,
		minHeight: 520,
		show: false,
		resizable: true,
		title: `与 ${chatName} 视频通话`,
		backgroundColor: '#0f172a',
		autoHideMenuBar: true,
		frame: process.platform === 'darwin',
		titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
		trafficLightPosition: process.platform === 'darwin'
			? { x: 14, y: 12 }
			: undefined,
		vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
		visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: false,
			contextIsolation: true,
			webSecurity: false,
			webviewTag: true,
		},
	})

	const page = `mock-video-call?chatId=${chatId}&name=${encodeURIComponent(chatName)}&avatar=${encodeURIComponent(chatAvatar || '')}&startConnected=${options?.startConnected ? '1' : '0'}`
	loadPage(win, page)
	windowRegistry.set(winKey, win)

	win.on('closed', () => {
		windowRegistry.delete(winKey)
	})
}

export function openIncomingCallWindow(payload: {
	callId: string
	fromAccount: string
	fromName: string
	fromAvatar?: string
	chatId?: number
	type?: 'video' | 'audio'
}): void {
	const callId = payload.callId.trim()
	if (!callId) return
	const winKey = `incoming-call-${callId}`
	const existingWin = windowRegistry.get(winKey)
	if (existingWin && !existingWin.isDestroyed()) {
		existingWin.show()
		existingWin.focus()
		return
	}

	const win = new BrowserWindow({
		width: 420,
		height: 560,
		minWidth: 360,
		minHeight: 500,
		show: false,
		resizable: false,
		backgroundColor: '#f8fafc',
		autoHideMenuBar: true,
		frame: process.platform === 'darwin',
		titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
		trafficLightPosition: process.platform === 'darwin'
			? { x: 12, y: 12 }
			: undefined,
		vibrancy: process.platform === 'darwin' ? 'window' : undefined,
		visualEffectState: process.platform === 'darwin' ? 'active' : undefined,
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: false,
			contextIsolation: true,
			webSecurity: false,
			webviewTag: true,
		},
	})

	const page =
		`incoming-call?callId=${encodeURIComponent(callId)}` +
		`&fromAccount=${encodeURIComponent(payload.fromAccount)}` +
		`&fromName=${encodeURIComponent(payload.fromName)}` +
		`&fromAvatar=${encodeURIComponent(payload.fromAvatar || '')}` +
		`&chatId=${Number.isFinite(payload.chatId) ? payload.chatId : ''}` +
		`&type=${encodeURIComponent(payload.type || 'video')}`
	loadPage(win, page)
	windowRegistry.set(winKey, win)

	win.on('closed', () => {
		windowRegistry.delete(winKey)
	})
}
