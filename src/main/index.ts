import { app, shell, BrowserWindow, dialog, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { setupIpcHandlers } from './controller/setupIpcHandlers'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { openLoginWindow } from './windowState/windowManage'
import { initDatabase } from './database/db'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let isQuitting = false

function createWindow(): void {
	// Create the browser window.
	let mainWindow: BrowserWindow | null = new BrowserWindow({
		width: 320,
		height: 540,
		resizable: false,
		show: false,
		autoHideMenuBar: true,
		...(process.platform === 'linux' ? { icon } : {}),
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: false,
			webviewTag: true,
		},
		frame: process.platform === 'darwin' ? false : true,
		titleBarStyle: 'hidden',
	})

	mainWindow.on('ready-to-show', () => {
		mainWindow!.show() //加上非空断言 ：！
	})

	mainWindow.on('close', async (e) => {
		if (!isQuitting) {
			e.preventDefault()
			const result = await dialog.showMessageBox(mainWindow!, {
				type: 'question',
				buttons: ['退出', '取消'],
				defaultId: 0,
				message: '确定要退出应用吗？',
			})

			if (result.response === 0) {
				isQuitting = true // 允许关闭
				app.quit() // 触发退出
			}
		}
	})
	mainWindow.on('closed', () => {
		mainWindow = null
	})

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url)
		return { action: 'deny' }
	})

	if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
		mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
	} else {
		mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
	}
}

app.whenReady().then(async () => {
	// Set app user model id for windows
	electronApp.setAppUserModelId('com.electron')

	const allowlist = new Set([
		'media',
		'notifications',
		'fullscreen',
		'clipboard-sanitized-write',
	])
	session.defaultSession.setPermissionCheckHandler(
		(_webContents, permission) => {
			return allowlist.has(permission)
		},
	)
	session.defaultSession.setPermissionRequestHandler(
		(_webContents, permission, callback) => {
			callback(allowlist.has(permission))
		},
	)

	app.on('browser-window-created', (_, window) => {
		optimizer.watchWindowShortcuts(window)
	})

	// 初始化数据库
	await initDatabase()

	openLoginWindow()
	setupIpcHandlers()

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', () => {
	app.quit()
})
