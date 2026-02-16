import { ipcMain, app, shell, BrowserWindow, Notification } from 'electron'
import {
	openLoginWindow,
	openHomeWindow,
	openRegisterWindow,
	viewIMGWindow,
	setMinimizeToTray,
	getMinimizeToTray,
	openChatWindow,
	windowRegistry,
} from '../windowState/windowManage'
import {
	chatService,
	DbChatItem,
	DbMessage,
} from '../database/chatService'
import { initDatabase, purgeDatabaseFiles } from '../database/db'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { fileURLToPath } from 'url'

const NOTIFICATION_ICON_CACHE_DIR = join(
	app.getPath('userData'),
	'notification-icons',
)

const ensureNotificationIconCacheDir = (): void => {
	if (!existsSync(NOTIFICATION_ICON_CACHE_DIR)) {
		mkdirSync(NOTIFICATION_ICON_CACHE_DIR, { recursive: true })
	}
}

const toCachedIconPath = (key: string, ext = 'png'): string => {
	const digest = createHash('sha1').update(key).digest('hex')
	return join(NOTIFICATION_ICON_CACHE_DIR, `${digest}.${ext}`)
}

const resolveNotificationIcon = async (
	rawIcon?: string,
): Promise<string | undefined> => {
	const icon = String(rawIcon || '').trim()
	if (!icon) return undefined

	try {
		if (icon.startsWith('file://')) {
			return fileURLToPath(icon)
		}
	} catch {
		// ignore malformed file url
	}

	// absolute local path
	if (icon.startsWith('/') || /^[A-Za-z]:[\\/]/.test(icon)) {
		return existsSync(icon) ? icon : undefined
	}

	// data:image/*;base64,...
	if (icon.startsWith('data:image/')) {
		const matched = icon.match(
			/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/,
		)
		if (!matched) return undefined
		const ext = matched[1] === 'jpeg' ? 'jpg' : matched[1]
		const cached = toCachedIconPath(icon, ext)
		if (existsSync(cached)) return cached
		ensureNotificationIconCacheDir()
		const binary = Buffer.from(matched[2], 'base64')
		writeFileSync(cached, binary)
		return cached
	}

	// remote url
	if (/^https?:\/\//i.test(icon)) {
		const cached = toCachedIconPath(icon, 'png')
		if (existsSync(cached)) return cached
		ensureNotificationIconCacheDir()
		const response = await fetch(icon)
		if (!response.ok) return undefined
		const bytes = Buffer.from(await response.arrayBuffer())
		writeFileSync(cached, bytes)
		return cached
	}

	return undefined
}

export function setupIpcHandlers(): void {
	// --- 数据库相关 IPC ---
	ipcMain.handle('db-get-all-chats', (_, userAccount: string) => {
		return chatService.getAllChats(userAccount)
	})

	ipcMain.handle(
		'db-save-chat',
		(_, userAccount: string, chat: DbChatItem) => {
			return chatService.saveChat(userAccount, chat)
		},
	)

	ipcMain.handle('db-delete-chat', (_, userAccount: string, id: number) => {
		return chatService.deleteChat(userAccount, id)
	})

	ipcMain.handle(
		'db-get-messages',
		(_, userAccount: string, chatId: number) => {
			return chatService.getMessages(userAccount, chatId)
		},
	)

	ipcMain.handle(
		'db-get-messages-segment',
		(
			_,
			userAccount: string,
			chatId: number,
			limit: number,
			offsetFromLatest: number,
		) => {
			return chatService.getMessagesSegment(
				userAccount,
				chatId,
				limit,
				offsetFromLatest,
			)
		},
	)

	ipcMain.handle(
		'db-search-messages',
		(_, userAccount: string, keyword: string, limit: number) => {
			return chatService.searchMessages(userAccount, keyword, limit)
		},
	)

	ipcMain.handle(
		'db-save-message',
		(_, userAccount: string, message: DbMessage) => {
			return chatService.saveMessage(userAccount, message)
		},
	)

	ipcMain.handle(
		'db-update-last-message',
		(
			_,
			userAccount: string,
			id: number,
			message: string,
			timestamp: string,
			lastMessageAt: string,
		) => {
			return chatService.updateLastMessage(
				userAccount,
				id,
				message,
				timestamp,
				lastMessageAt,
			)
		},
	)

	ipcMain.handle(
		'db-set-pinned',
		(_, userAccount: string, id: number, isPinned: boolean) => {
			return chatService.setPinned(userAccount, id, isPinned)
		},
	)

	// 登录成功
	ipcMain.on('login-success-open-home', () => {
		openHomeWindow()
	})

	// 打开注册（单例模式由 windowManage 保证）
	ipcMain.on('open-register-window', () => {
		openRegisterWindow()
	})

	// 注册成功回登录
	ipcMain.on('register-success-open-loginWindow', () => {
		openLoginWindow()
	})

	// 退出登录
	ipcMain.on('logout-open-loginWindow', () => {
		openLoginWindow()
	})

	//打开图片预览【测试】
	ipcMain.on('view-img', (_, imgUrl) => {
		viewIMGWindow(imgUrl)
	})

	// --- 设置相关 API ---

	// 获取版本号
	ipcMain.handle('get-app-version', () => {
		return app.getVersion()
	})

	// 开机自启动控制
	ipcMain.handle('get-auto-start', () => {
		return app.getLoginItemSettings().openAtLogin
	})

	ipcMain.handle('set-auto-start', (_, openAtLogin: boolean) => {
		app.setLoginItemSettings({
			openAtLogin,
			path: process.execPath,
		})
		return true
	})

	// 最小化到托盘控制
	ipcMain.handle('get-minimize-to-tray', () => {
		return getMinimizeToTray()
	})

	ipcMain.on('set-minimize-to-tray', (_, value: boolean) => {
		setMinimizeToTray(value)
	})

	// 清理缓存
	ipcMain.handle('clear-app-cache', async () => {
		const sessions = (await import('electron')).session.defaultSession
		await sessions.clearCache()
		await sessions.clearStorageData({
			storages: [
				'cookies',
				'filesystem',
				'indexdb',
				'localstorage',
				'cachestorage',
				'serviceworkers',
				'shadercache',
				'websql',
			],
		})

		// 清理应用数据库文件（聊天/会话持久化）
		await purgeDatabaseFiles()
		await initDatabase()

		// 清理 Electron 持久化存储目录残留
		const userDataPath = app.getPath('userData')
		const persistentDirs = [
			'Cache',
			'Code Cache',
			'GPUCache',
			'Local Storage',
			'Session Storage',
			'IndexedDB',
			'Service Worker',
		]
		for (const dir of persistentDirs) {
			const target = join(userDataPath, dir)
			if (existsSync(target)) {
				rmSync(target, { recursive: true, force: true })
			}
		}
		return true
	})

	// 打开外部链接
	ipcMain.on('open-external-url', (_, url: string) => {
		shell.openExternal(url)
	})

	// 在新窗口打开聊天
	ipcMain.on('open-chat-window', (_, chatId: number, chatName: string) => {
		openChatWindow(chatId, chatName)
	})

	ipcMain.on(
		'show-system-notification',
		(
			_,
			payload: {
				title?: string
				body?: string
				icon?: string
			},
		) => {
			void (async () => {
				if (!Notification.isSupported()) return
				const title = String(payload?.title || '新消息提醒').trim()
				const body = String(payload?.body || '').trim()
				const icon = await resolveNotificationIcon(payload?.icon)
				const notification = new Notification({
					title,
					body,
					icon,
					silent: false,
				})
				notification.show()
			})()
		},
	)

	// 跨窗口 Store 同步
	ipcMain.on(
		'sync-store',
		(event, payload: { action: string; data: Record<string, unknown> }) => {
			// 向所有其他窗口广播该同步消息
			import('electron').then(({ BrowserWindow }) => {
				const allWindows = BrowserWindow.getAllWindows()
				allWindows.forEach((win) => {
					if (win.webContents !== event.sender) {
						win.webContents.send('store-update', payload)
					}
				})
			})
		},
	)

	// 跨窗口 Store 数据请求 (用于新开窗口同步历史记录)
	ipcMain.on('request-store-data', (event) => {
		const senderWin = BrowserWindow.fromWebContents(event.sender)
		if (!senderWin) return

		// 优先从主窗口获取数据
		const homeWin = windowRegistry.get('home')
		if (homeWin && homeWin.webContents !== event.sender) {
			homeWin.webContents.send('provide-store-data', senderWin.id)
			return
		}

		// 兜底：从任意其他已打开窗口获取
		const allWindows = BrowserWindow.getAllWindows()
		for (const win of allWindows) {
			if (win.webContents !== event.sender) {
				win.webContents.send('provide-store-data', senderWin.id)
				break
			}
		}
	})

	ipcMain.on(
		'report-store-data',
		(_, targetId: number, payload: Record<string, unknown>) => {
			const targetWin = BrowserWindow.fromId(targetId)
			if (targetWin) {
				targetWin.webContents.send('hydrate-store-data', payload)
			}
		},
	)

	// 设置窗口置顶
	ipcMain.on('set-window-pin', (event, isPinned: boolean) => {
		const win = BrowserWindow.fromWebContents(event.sender)
		if (win) {
			win.setAlwaysOnTop(isPinned)
		}
	})

	// 窗口控制
	ipcMain.on('minimize-window', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender)
		if (win) win.minimize()
	})

	ipcMain.on('maximize-window', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender)
		if (win) {
			if (win.isMaximized()) {
				win.unmaximize()
			} else {
				win.maximize()
			}
		}
	})

	ipcMain.on('close-window', (event) => {
		const win = BrowserWindow.fromWebContents(event.sender)
		if (win) win.close()
	})
}
