import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

export type VideoCallType = 'VIDEO' | 'AUDIO'
export type VideoCallSignalType =
	| 'OFFER'
	| 'ANSWER'
	| 'ICE_CANDIDATE'
	| 'RENEGOTIATE'

export interface CreateCallResponse {
	callId: string
	id?: string
	callid?: string
	status: string
	expiresAt?: string
}

export interface CallSession {
	callId: string
	type: VideoCallType
	status: string
	callerAccount: string
	callerName?: string
	callerAvatar?: string
	calleeAccount: string
	calleeName?: string
	calleeAvatar?: string
	channelId?: string
	startedAt?: string
	expiresAt?: string
	answeredAt?: string
	connectedAt?: string
	endedAt?: string
	endReason?: string
	durationSeconds?: number
}

export interface IceServerConfig {
	urls: string[]
	username?: string
	credential?: string
	ttlSeconds?: number
}

const createRequestId = (prefix: string): string =>
	`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const videoCallApi = {
	createCall(payload: { calleeAccount: string; type: VideoCallType }) {
		return request.post<ApiResponse<CreateCallResponse>>('/calls', {
			requestId: createRequestId('req_call_create'),
			calleeAccount: payload.calleeAccount.trim(),
			type: payload.type,
		})
	},

	acceptCall(callId: string) {
		return request.post<ApiResponse<Record<string, unknown>>>(
			`/calls/${callId}/accept`,
			{
				requestId: createRequestId('req_call_accept'),
			},
		)
	},

	rejectCall(callId: string, reason = 'REJECTED_BY_USER') {
		return request.post<ApiResponse<Record<string, unknown>>>(
			`/calls/${callId}/reject`,
			{
				requestId: createRequestId('req_call_reject'),
				reason,
			},
		)
	},

	cancelCall(callId: string) {
		return request.post<ApiResponse<Record<string, unknown>>>(
			`/calls/${callId}/cancel`,
			{
				requestId: createRequestId('req_call_cancel'),
			},
		)
	},

	endCall(callId: string, reason = 'HANGUP') {
		return request.post<ApiResponse<Record<string, unknown>>>(
			`/calls/${callId}/end`,
			{
				requestId: createRequestId('req_call_end'),
				reason,
			},
		)
	},

	getCallSession(callId: string) {
		return request.get<ApiResponse<CallSession>>(`/calls/${callId}`)
	},

	sendSignal(
		callId: string,
		payload: {
			signalType: VideoCallSignalType
			to: string
			sdp?: string
			candidate?: string
			sdpMid?: string | null
			sdpMLineIndex?: number | null
		},
	) {
		return request.post<ApiResponse<{ accepted: boolean }>>(
			`/calls/${callId}/signals`,
			{
				requestId: createRequestId('req_call_signal'),
				...payload,
			},
		)
	},

	heartbeat(callId: string) {
		return request.post<ApiResponse<Record<string, unknown>>>(
			`/calls/${callId}/heartbeat`,
			{
				requestId: createRequestId('req_call_heartbeat'),
			},
		)
	},

	getIceServers() {
		return request.get<ApiResponse<{ servers?: IceServerConfig[] }>>(
			'/rtc/ice-servers',
		)
	},
}
