import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
	hello: () => {
		ipcRenderer.send('hello')
	},
	setWindowPin: (isPinned: boolean) => {
		ipcRenderer.send('set-window-pin', isPinned)
	},
	platform: process.platform,
	minimizeWindow: () => {
		ipcRenderer.send('minimize-window')
	},
	maximizeWindow: () => {
		ipcRenderer.send('maximize-window')
	},
	closeWindow: () => {
		ipcRenderer.send('close-window')
	},
	onWindowMaximizeChange: (callback: (isMaximized: boolean) => void) => {
		ipcRenderer.on('window-maximized', (_, isMaximized) =>
			callback(isMaximized),
		)
	},
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld('electron', electronAPI)
		contextBridge.exposeInMainWorld('api', api)
	} catch (error) {
		console.error(error)
	}
} else {
	// @ts-ignore (define in dts)
	window.electron = electronAPI
	// @ts-ignore (define in dts)
	window.api = api
}
