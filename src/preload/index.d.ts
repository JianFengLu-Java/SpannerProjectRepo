import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
	interface Window {
		electron: ElectronAPI
		api: {
			hello: () => void
			setWindowPin: (isPinned: boolean) => void
			platform: string
		}
	}
}
