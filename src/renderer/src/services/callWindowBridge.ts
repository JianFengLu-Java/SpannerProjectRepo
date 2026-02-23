import type { PrivateCallSignalFrame } from './privateChatWs'

type BridgeMessage =
	| {
			type: 'call.signal'
			payload: PrivateCallSignalFrame
	  }
	| {
			type: 'noop'
	  }

const CHANNEL_NAME = 'spanner-call-bridge-v1'
const STORAGE_KEY = '__spanner_call_bridge__'

let channel: BroadcastChannel | null = null

const getChannel = (): BroadcastChannel | null => {
	if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
		return null
	}
	if (!channel) channel = new BroadcastChannel(CHANNEL_NAME)
	return channel
}

const postStorageMessage = (message: BridgeMessage): void => {
	try {
		window.localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				...message,
				nonce: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			}),
		)
	} catch {
		// ignore
	}
}

export const publishCallSignal = (payload: PrivateCallSignalFrame): void => {
	const message: BridgeMessage = { type: 'call.signal', payload }
	const bc = getChannel()
	if (bc) {
		bc.postMessage(message)
	}
	postStorageMessage(message)
}

export const subscribeCallSignal = (
	listener: (payload: PrivateCallSignalFrame) => void,
): (() => void) => {
	const onBridgeMessage = (event: MessageEvent<BridgeMessage>): void => {
		const data = event.data
		if (!data || data.type !== 'call.signal') return
		listener(data.payload || {})
	}
	const onStorage = (event: StorageEvent): void => {
		if (event.key !== STORAGE_KEY || !event.newValue) return
		try {
			const data = JSON.parse(event.newValue) as BridgeMessage
			if (data.type !== 'call.signal') return
			listener(data.payload || {})
		} catch {
			// ignore
		}
	}
	const bc = getChannel()
	if (bc) {
		bc.addEventListener('message', onBridgeMessage)
	}
	window.addEventListener('storage', onStorage)
	return () => {
		if (bc) {
			bc.removeEventListener('message', onBridgeMessage)
		}
		window.removeEventListener('storage', onStorage)
	}
}
