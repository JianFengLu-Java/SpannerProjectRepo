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
			openMockVideoCallWindow: (payload: {
				chatId: number
				chatName: string
				chatAvatar?: string
				startConnected?: boolean
			}) => void
			openIncomingCallWindow: (payload: {
				callId: string
				fromAccount: string
				fromName: string
				fromAvatar?: string
				chatId?: number
				type?: 'video' | 'audio'
			}) => void
			onWindowMaximizeChange: (
				callback: (isMaximized: boolean) => void,
			) => void
		}
	}
}
