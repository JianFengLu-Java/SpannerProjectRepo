import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

export type RecallMessageType = 'PRIVATE' | 'GROUP'

export interface RecallMessagePayload {
	messageType: RecallMessageType
	groupNo?: string
}

export interface RecallMessageResultDto {
	messageId?: string
	messageType?: RecallMessageType
	groupNo?: string | null
	from?: string
	to?: string | null
	recalled?: boolean
	recalledAt?: string
	recallDeadlineAt?: string
}

export const messageRecallApi = {
	recall(messageId: string, payload: RecallMessagePayload) {
		return request.post<ApiResponse<RecallMessageResultDto>>(
			`/messages/${encodeURIComponent(messageId)}/recall`,
			payload,
		)
	},
}

