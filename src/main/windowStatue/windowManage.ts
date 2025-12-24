import { BrowserWindow } from 'electron'
import { join } from 'path'

let currentWindow: BrowserWindow | null = null

function createBaseWindows(
	options: Electron.BrowserWindowConstructorOptions,
): BrowserWindow {
	return new BrowserWindow({
		show: false,
		...options,

		frame: false,
		titleBarStyle: 'hiddenInset',
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			sandbox: false,
			contextIsolation: true,
			partition: 'persist:default',
		},
	})
}

function destroyCurrentWindow(): void {
	if (currentWindow) {
		currentWindow.removeAllListeners()
		currentWindow.close()
		currentWindow = null
	}
}

function loadPage(window: BrowserWindow, page: string): void {
	if (process.env.ELECTRON_RENDERER_URL) {
		window.loadURL(process.env['ELECTRON_RENDERER_URL'] + `#/${page}`)
	} else {
		window.loadFile(join(__dirname, '../renderer/index.html'), {
			hash: `#/${page}`,
		})
	}

	window.once('ready-to-show', () => {
		window.show()
	})
}

export function openLoginWindow(): void {
	destroyCurrentWindow()
	currentWindow = createBaseWindows({
		width: 320,
		height: 540,
		resizable: false,
	})
	loadPage(currentWindow, 'login')
}

export function openRegisterWindow(): void {
	destroyCurrentWindow()
	currentWindow = createBaseWindows({ width: 620, height: 740 })
	loadPage(currentWindow, 'register')
}
export function openHomeWindow(): void {
	destroyCurrentWindow()
	currentWindow = createBaseWindows({
		width: 800,
		height: 600,
		minHeight: 600,
		minWidth: 800,
	})
	loadPage(currentWindow, 'home')
}
