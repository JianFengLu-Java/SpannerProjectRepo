import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
	interface Window {
		electron: ElectronAPI
		api: {
			hello: () => void
			setWindowPin: (isPinned: boolean) => void
			platform: string
			minimizeWindow: () => void
			maximizeWindow: () => void
			closeWindow: () => void
			onWindowMaximizeChange: (
				callback: (isMaximized: boolean) => void,
			) => void
		}
	}
}
