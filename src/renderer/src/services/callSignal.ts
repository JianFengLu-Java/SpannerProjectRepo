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
export interface CallAnsweredEvent {
	callId: string
	answeredBy?: string
	answeredAt?: string
}
type CallAnsweredListener = (payload: CallAnsweredEvent) => void

export interface CallEndedEvent {
	callId: string
	status?: string
	endReason?: string
	endedAt?: string
	durationSeconds?: number
}
type CallEndedListener = (payload: CallEndedEvent) => void

export interface CallSignalEvent {
	callId: string
	signalType: 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'RENEGOTIATE'
	type?: 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'RENEGOTIATE'
	from: string
	to?: string
	sdp?: string | { type?: string; sdp?: string } | null
	candidate?:
		| string
		| { candidate?: string; sdpMid?: string; sdpMLineIndex?: number }
		| null
	sdpMid?: string | null
	sdpMLineIndex?: number | null
	createdAt?: string
}
type CallSignalListener = (payload: CallSignalEvent) => void

const incomingCallListeners = new Set<IncomingCallListener>()
const callAnsweredListeners = new Set<CallAnsweredListener>()
const callEndedListeners = new Set<CallEndedListener>()
const callSignalListeners = new Set<CallSignalListener>()

const normalizeIncomingCall = (
	payload: Partial<PrivateIncomingCallFrame>,
): IncomingCallEvent | null => {
	const raw = payload as Record<string, unknown>
	const fromAccount = String(
		payload.from ||
			raw.fromAccount ||
			raw.callerAccount ||
			raw.caller ||
			'',
	).trim()
	if (!fromAccount) return null
	const callId =
		String(
			payload.callId ||
				raw.call_id ||
				raw.callID ||
				raw.id ||
				raw.sessionId ||
				raw.session_id ||
				'',
		).trim()
	if (!callId) return null
	const fromName = String(
		payload.fromName ||
			raw.from_name ||
			raw.callerName ||
			raw.caller_name ||
			raw.fromRealName ||
			'',
	).trim() || fromAccount
	const fromAvatar = String(
		payload.fromAvatar ||
			raw.from_avatar ||
			raw.callerAvatar ||
			raw.caller_avatar ||
			raw.fromAvatarUrl ||
			'',
	).trim()
	const type: 'video' | 'audio' =
		String(payload.type || raw.callType || '').toLowerCase() === 'audio' ||
		String(payload.type || raw.callType || '').toUpperCase() === 'AUDIO'
			? 'audio'
			: 'video'
	const chatIdRaw = Number(payload.chatId || raw.chatNo || raw.sessionChatId)
	return {
		callId,
		fromAccount,
		fromName,
		fromAvatar,
		type,
		chatId: Number.isFinite(chatIdRaw) ? Math.floor(chatIdRaw) : undefined,
		createdAt:
			String(payload.createdAt || raw.startTime || raw.created || '').trim() ||
			undefined,
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

export const onCallAnswered = (
	listener: CallAnsweredListener,
): (() => void) => {
	callAnsweredListeners.add(listener)
	return () => callAnsweredListeners.delete(listener)
}

export const emitCallAnswered = (payload: Partial<CallAnsweredEvent>): void => {
	const callId = String(payload.callId || '').trim()
	if (!callId) return
	const event: CallAnsweredEvent = {
		callId,
		answeredBy: String(payload.answeredBy || '').trim() || undefined,
		answeredAt: String(payload.answeredAt || '').trim() || undefined,
	}
	for (const listener of callAnsweredListeners) {
		listener(event)
	}
}

export const onCallEnded = (listener: CallEndedListener): (() => void) => {
	callEndedListeners.add(listener)
	return () => callEndedListeners.delete(listener)
}

export const emitCallEnded = (payload: Partial<CallEndedEvent>): void => {
	const callId = String(payload.callId || '').trim()
	if (!callId) return
	const event: CallEndedEvent = {
		callId,
		status: String(payload.status || '').trim() || undefined,
		endReason: String(payload.endReason || '').trim() || undefined,
		endedAt: String(payload.endedAt || '').trim() || undefined,
		durationSeconds:
			typeof payload.durationSeconds === 'number'
				? payload.durationSeconds
				: undefined,
	}
	for (const listener of callEndedListeners) {
		listener(event)
	}
}

export const onCallSignal = (listener: CallSignalListener): (() => void) => {
	callSignalListeners.add(listener)
	return () => callSignalListeners.delete(listener)
}

export const emitCallSignal = (payload: Partial<CallSignalEvent>): void => {
	const raw = payload as Record<string, unknown>
	const callId = String(
		payload.callId ||
			raw.call_id ||
			raw.id ||
			raw.sessionId ||
			raw.session_id ||
			'',
	).trim()
	const signalType = String(
		payload.signalType || payload.type || '',
	).trim().toUpperCase() as
		| 'OFFER'
		| 'ANSWER'
		| 'ICE_CANDIDATE'
		| 'RENEGOTIATE'
	const from = String(
		payload.from || raw.fromAccount || raw.callerAccount || raw.caller || '',
	).trim() || 'unknown'
	if (!callId || !signalType) return
	const event: CallSignalEvent = {
		callId,
		signalType,
		type: signalType,
		from,
		to: String(payload.to || raw.toAccount || raw.receiver || '').trim() || undefined,
		sdp:
			typeof payload.sdp === 'string'
				? payload.sdp.trim() || undefined
				: payload.sdp || undefined,
		candidate:
			typeof payload.candidate === 'string'
				? payload.candidate.trim() || undefined
				: payload.candidate || undefined,
		sdpMid:
			payload.sdpMid === null
				? null
				: String(payload.sdpMid || '').trim() || undefined,
		sdpMLineIndex:
			typeof payload.sdpMLineIndex === 'number'
				? payload.sdpMLineIndex
				: null,
		createdAt: String(payload.createdAt || '').trim() || undefined,
	}
	for (const listener of callSignalListeners) {
		listener(event)
	}
}
