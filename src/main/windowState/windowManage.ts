import { BrowserWindow, Tray, Menu, app, nativeImage } from 'electron'
import { join } from 'path'
import crypto from 'crypto'
import iconPath from '../../../resources/icon.png?asset'

// 定义窗口类型，方便维护
type WindowType = 'login' | 'register' | 'home' | 'view-img' | 'chat'

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
		width: 420,
		height: 640,
		resizable: false,
	})
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
		width: 620,
		height: 840,
		resizable: false,
	})
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
	// 1. 对 URL 进行 MD5 哈希处理，生成唯一的固定长度 ID
	const hash = crypto.createHash('md5').update(imgURL).digest('hex')
	const winKey = `view-img-${hash}`

	// 2. 检查该图片的窗口是否已经打开
	const existingWin = windowRegistry.get(winKey)

	if (existingWin && !existingWin.isDestroyed()) {
		// 如果窗口存在，聚焦并置顶
		existingWin.focus()
		return
	}

	// 3. 如果不存在，则创建新窗口
	const win = createBaseWindow('view-img', {
		width: 600,
		height: 600,
	})

	// 注意：加载页面仍需使用原始 imgURL
	const page = `view-img?url=${encodeURIComponent(imgURL)}`
	loadPage(win, page)

	// 4. 将新窗口存入 Registry
	windowRegistry.set(winKey, win)

	// 5. 监听窗口关闭，清理 Registry
	win.on('closed', () => {
		windowRegistry.delete(winKey)
	})
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
