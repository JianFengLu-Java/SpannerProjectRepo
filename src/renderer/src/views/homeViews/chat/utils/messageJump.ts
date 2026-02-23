import type { Message } from '@renderer/stores/chat'

interface ChatStoreJumpBridge {
	requestMessageJump: (payload: {
		chatId: number
		messageId: number
		serverMessageId?: string
		clientMessageId?: string
		keyword?: string
	}) => void
}

interface JumpByIdentifierInput {
	chatStore: ChatStoreJumpBridge
	chatId: number
	loadedMessages: Message[]
	targetIdentifier: string
	fallbackMessage: Message
}

export const requestMessageJumpByIdentifier = ({
	chatStore,
	chatId,
	loadedMessages,
	targetIdentifier,
	fallbackMessage,
}: JumpByIdentifierInput): void => {
	const normalizedTarget = targetIdentifier.trim()
	if (!normalizedTarget) return

	const target = loadedMessages.find(
		(message) => message.serverMessageId?.trim() === normalizedTarget,
	)
	if (target) {
		chatStore.requestMessageJump({
			chatId,
			messageId: target.id,
			serverMessageId: target.serverMessageId,
		})
		return
	}

	const pending = loadedMessages.find(
		(message) => message.clientMessageId?.trim() === normalizedTarget,
	)
	if (pending) {
		chatStore.requestMessageJump({
			chatId,
			messageId: pending.id,
			clientMessageId: pending.clientMessageId,
		})
		return
	}

	chatStore.requestMessageJump({
		chatId,
		messageId: fallbackMessage.id,
		serverMessageId: normalizedTarget,
	})
}

export const requestMessageJumpFromSearchResult = (input: {
	chatStore: ChatStoreJumpBridge
	chatId: number
	loadedMessages: Message[]
	message: Message
}): void => {
	const { chatStore, chatId, loadedMessages, message } = input
	const targetIdentifier =
		message.serverMessageId?.trim() || message.clientMessageId?.trim() || ''
	if (targetIdentifier) {
		requestMessageJumpByIdentifier({
			chatStore,
			chatId,
			loadedMessages,
			targetIdentifier,
			fallbackMessage: message,
		})
		return
	}
	chatStore.requestMessageJump({
		chatId,
		messageId: message.id,
	})
}
