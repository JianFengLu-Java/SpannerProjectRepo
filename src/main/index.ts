import { app, shell, BrowserWindow, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import login from './controller/login'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { openLoginWindow } from './windowStatue/windowManage'

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
		},
		frame: false,
		titleBarStyle: 'hiddenInset',
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

app.whenReady().then(() => {
	// Set app user model id for windows
	electronApp.setAppUserModelId('com.electron')

	app.on('browser-window-created', (_, window) => {
		optimizer.watchWindowShortcuts(window)
	})

	openLoginWindow()
	login()

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', () => {
	app.quit()
})
