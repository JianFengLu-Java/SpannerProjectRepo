import type { PrivateIncomingCallFrame } from './privateChatWs'

export interface IncomingCallEvent {
	callId: string
	fromAccount: string
	fromName: string
	fromAvatar: string
	type: 'video' | 'audio'
	chatId?: number
	createdAt?: string
}

type IncomingCallListener = (payload: IncomingCallEvent) => void

const incomingCallListeners = new Set<IncomingCallListener>()

const normalizeIncomingCall = (
	payload: Partial<PrivateIncomingCallFrame>,
): IncomingCallEvent | null => {
	const fromAccount = String(payload.from || '').trim()
	if (!fromAccount) return null
	const callId =
		String(payload.callId || '').trim() ||
		`incoming-${fromAccount}-${Date.now()}`
	const fromName = String(payload.fromName || '').trim() || fromAccount
	const fromAvatar = String(payload.fromAvatar || '').trim()
	const type: 'video' | 'audio' =
		String(payload.type || '').toLowerCase() === 'audio'
			? 'audio'
			: 'video'
	const chatIdRaw = Number(payload.chatId)
	return {
		callId,
		fromAccount,
		fromName,
		fromAvatar,
		type,
		chatId: Number.isFinite(chatIdRaw) ? Math.floor(chatIdRaw) : undefined,
		createdAt: String(payload.createdAt || '').trim() || undefined,
	}
}

export const onIncomingCall = (listener: IncomingCallListener): (() => void) => {
	incomingCallListeners.add(listener)
	return () => incomingCallListeners.delete(listener)
}

export const emitIncomingCall = (
	payload: Partial<PrivateIncomingCallFrame>,
): void => {
	const normalized = normalizeIncomingCall(payload)
	if (!normalized) return
	for (const listener of incomingCallListeners) {
		listener(normalized)
	}
}
