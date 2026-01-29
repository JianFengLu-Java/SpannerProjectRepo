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
	getAllChats(): Promise<DbChatItem[]> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.all(
				'SELECT * FROM chats ORDER BY isPinned DESC, timestamp DESC',
				(err, rows) => {
					if (err) reject(err)
					else resolve(rows as DbChatItem[])
				},
			)
		})
	},

	// 保存或更新会话
	saveChat(chat: DbChatItem): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				INSERT OR REPLACE INTO chats (id, name, avatar, lastMessage, timestamp, online, unreadCount, isPinned)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`)
			stmt.run(
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
	deleteChat(id: number): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.serialize(() => {
				db.run('DELETE FROM chats WHERE id = ?', id)
				db.run(
					'DELETE FROM messages WHERE chatId = ?',
					id,
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
		id: number,
		message: string,
		timestamp: string,
	): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.run(
				'UPDATE chats SET lastMessage = ?, timestamp = ? WHERE id = ?',
				[message, timestamp, id],
				(err: Error | null) => {
					if (err) reject(err)
					else resolve()
				},
			)
		})
	},

	// 置顶控制
	setPinned(id: number, isPinned: boolean): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.run(
				'UPDATE chats SET isPinned = ? WHERE id = ?',
				[isPinned ? 1 : 0, id],
				(err: Error | null) => {
					if (err) reject(err)
					else resolve()
				},
			)
		})
	},

	// 获取某个会话的消息
	getMessages(chatId: number): Promise<DbMessage[]> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.all(
				'SELECT * FROM messages WHERE chatId = ? ORDER BY id ASC',
				[chatId],
				(err, rows) => {
					if (err) reject(err)
					else resolve(rows as DbMessage[])
				},
			)
		})
	},

	// 保存消息
	saveMessage(message: DbMessage): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			const stmt = db.prepare(`
				INSERT INTO messages (id, chatId, senderId, text, timestamp, type, hasResult, result)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`)
			stmt.run(
				[
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
