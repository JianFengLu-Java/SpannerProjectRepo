import { getDb } from './db'

export interface DbChatItem {
	id: number
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	online: number
	unreadCount: number
	isPinned: number
}

export interface DbMessage {
	id: number
	chatId: number
	senderId: 'me' | 'other'
	text: string
	timestamp: string
	type: string
	hasResult: number
	result?: string
}

export const chatService = {
	// 获取所有会话
	getAllChats(userAccount: string): Promise<DbChatItem[]> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.all(
				'SELECT id, name, avatar, lastMessage, timestamp, online, unreadCount, isPinned FROM user_chats WHERE userAccount = ? ORDER BY isPinned DESC, timestamp DESC',
				[userAccount],
				(err, rows) => {
					if (err) reject(err)
					else resolve(rows as DbChatItem[])
				},
			)
		})
	},

	// 保存或更新会话
	saveChat(userAccount: string, chat: DbChatItem): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				INSERT OR REPLACE INTO user_chats (userAccount, id, name, avatar, lastMessage, timestamp, online, unreadCount, isPinned)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`)
			stmt.run(
				userAccount,
				chat.id,
				chat.name,
				chat.avatar,
				chat.lastMessage,
				chat.timestamp,
				chat.online,
				chat.unreadCount,
				chat.isPinned,
				(err: Error | null) => {
					if (err) reject(err)
					else resolve()
				},
			)
			stmt.finalize()
		})
	},

	// 删除会话
	deleteChat(userAccount: string, id: number): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.serialize(() => {
				db.run(
					'DELETE FROM user_chats WHERE userAccount = ? AND id = ?',
					[userAccount, id],
				)
				db.run(
					'DELETE FROM user_messages WHERE userAccount = ? AND chatId = ?',
					[userAccount, id],
					(err: Error | null) => {
						if (err) reject(err)
						else resolve()
					},
				)
			})
		})
	},

	// 更新最后一条消息
	updateLastMessage(
		userAccount: string,
		id: number,
		message: string,
		timestamp: string,
	): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.run(
				'UPDATE user_chats SET lastMessage = ?, timestamp = ? WHERE userAccount = ? AND id = ?',
				[message, timestamp, userAccount, id],
				(err: Error | null) => {
					if (err) reject(err)
					else resolve()
				},
			)
		})
	},

	// 置顶控制
	setPinned(
		userAccount: string,
		id: number,
		isPinned: boolean,
	): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.run(
				'UPDATE user_chats SET isPinned = ? WHERE userAccount = ? AND id = ?',
				[isPinned ? 1 : 0, userAccount, id],
				(err: Error | null) => {
					if (err) reject(err)
					else resolve()
				},
			)
		})
	},

	// 获取某个会话的消息
	getMessages(userAccount: string, chatId: number): Promise<DbMessage[]> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.all(
				'SELECT id, chatId, senderId, text, timestamp, type, hasResult, result FROM user_messages WHERE userAccount = ? AND chatId = ? ORDER BY id ASC',
				[userAccount, chatId],
				(err, rows) => {
					if (err) reject(err)
					else resolve(rows as DbMessage[])
				},
			)
		})
	},

	// 保存消息
	saveMessage(userAccount: string, message: DbMessage): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				INSERT OR REPLACE INTO user_messages (userAccount, id, chatId, senderId, text, timestamp, type, hasResult, result)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`)
			stmt.run(
				[
					userAccount,
					message.id,
					message.chatId,
					message.senderId,
					message.text,
					message.timestamp,
					message.type,
					message.hasResult || 0,
					message.result || null,
				],
				(err: Error | null) => {
					if (err) reject(err)
					else resolve()
				},
			)
			stmt.finalize()
		})
	},
}
