import request from '@renderer/utils/request'

interface ApiResponse<T> {
	code: number
	status: string
	message: string
	data: T
}

export interface ReactionItemDto {
	key: string
	emoji?: string
	imageUrl?: string
	count?: number
	userIds?: string[]
	updatedAt?: string
}

export interface MessageReactionSnapshotDto {
	chatId?: number
	messageId?: number | string
	serverMessageId?: string
	clientMessageId?: string
	reactions?: ReactionItemDto[]
}

export interface ToggleMessageReactionPayload {
	chatId: number
	serverMessageId?: string
	clientMessageId?: string
	reaction: {
		key: string
		emoji?: string
		imageUrl?: string
	}
	operatorId?: string
	requestId: string
}

export const messageReactionApi = {
	toggle(messageId: string | number, payload: ToggleMessageReactionPayload) {
		return request.put<ApiResponse<MessageReactionSnapshotDto>>(
			`/messages/${encodeURIComponent(String(messageId))}/reactions/toggle`,
			payload,
		)
	},
	getByMessageId(
		messageId: string | number,
		params: {
			chatId: number
			serverMessageId?: string
			clientMessageId?: string
		},
	) {
		return request.get<ApiResponse<MessageReactionSnapshotDto>>(
			`/messages/${encodeURIComponent(String(messageId))}/reactions`,
			{ params },
		)
	},
}

