import { BrowserWindow } from 'electron'
import { join } from 'path'
import crypto from 'crypto'

// 定义窗口类型，方便维护
type WindowType = 'login' | 'register' | 'home' | 'view-img'

// 窗口注册表：保存所有正在运行的窗口实例
const windowRegistry = new Map<WindowType, BrowserWindow>()

function createBaseWindow(
	options: Electron.BrowserWindowConstructorOptions,
): BrowserWindow {
	const win = new BrowserWindow({
		show: false,
		frame: process.platform === 'darwin' ? false : true,
		titleBarStyle:
			process.platform === 'darwin' ? 'hiddenInset' : 'default',

		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: false,
			contextIsolation: true,
		},
		autoHideMenuBar: true,
		...options,
	})

	// 窗口关闭时自动从注册表中移除
	win.on('closed', () => {
		windowRegistry.forEach((instance, key) => {
			if (instance === win) windowRegistry.delete(key)
		})
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
	type: WindowType,
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
	const win = createBaseWindow(options)
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
	// 查找注册窗口实例，如果存在则关闭它
	const regWin = windowRegistry.get('register')
	if (regWin && !regWin.isDestroyed()) {
		regWin.close() // 触发 close 事件，windowRegistry 会在监听里自动 delete 它
	}

	// 3. 如果是从主页登出的，也关闭主页
	windowRegistry.get('home')?.close()
}

export function openRegisterWindow(): void {
	const regWin = getOrCreateWindow('register', {
		width: 620,
		height: 840,
		resizable: false,
	})
	loadPage(regWin, 'register')

	// 逻辑建议：通常打开注册时，登录窗口可以隐藏或关闭。
	// 如果你希望打开注册时登录窗口消失：
	windowRegistry.get('login')?.close()
}

export function openHomeWindow(): void {
	const homeWin = getOrCreateWindow('home', {
		width: 1000,
		height: 750,
		minWidth: 800,
		minHeight: 600,
	})
	loadPage(homeWin, 'home')

	// 成功进入首页后，销毁登录相关的窗口
	windowRegistry.get('login')?.close()
	windowRegistry.get('register')?.close()
}

export function viewIMGWindow(imgURL: string): void {
	// 1. 对 URL 进行 MD5 哈希处理，生成唯一的固定长度 ID
	const hash = crypto.createHash('md5').update(imgURL).digest('hex')
	const winKey = `view-img-${hash}` as WindowType

	// 2. 检查该图片的窗口是否已经打开
	const existingWin = windowRegistry.get(winKey)

	if (existingWin && !existingWin.isDestroyed()) {
		// 如果窗口存在，聚焦并置顶
		existingWin.focus()
		return
	}

	// 3. 如果不存在，则创建新窗口
	const win = createBaseWindow({
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
