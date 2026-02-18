import { getDb } from './db'

export interface DbChatItem {
	id: number
	chatType?: 'PRIVATE' | 'GROUP'
	peerAccount?: string
	groupNo?: string
	myRole?: 'OWNER' | 'ADMIN' | 'MEMBER'
	maxMembers?: number
	memberCount?: number
	announcement?: string
	name: string
	avatar: string
	lastMessage: string
	timestamp: string
	lastMessageAt?: string
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
	clientMessageId?: string
	serverMessageId?: string
	deliveryStatus?: 'sending' | 'sent' | 'failed'
	sentAt?: string
}

export interface DbMessageSearchResult extends DbMessage {
	chatName: string
}

export const chatService = {
	// 获取所有会话
	getAllChats(userAccount: string): Promise<DbChatItem[]> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.all(
				'SELECT id, chatType, peerAccount, groupNo, myRole, maxMembers, memberCount, announcement, name, avatar, lastMessage, timestamp, lastMessageAt, online, unreadCount, isPinned FROM user_chats WHERE userAccount = ? ORDER BY isPinned DESC, COALESCE(lastMessageAt, \'\') DESC, id DESC',
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
				INSERT OR REPLACE INTO user_chats (
					userAccount,
					id,
					chatType,
					peerAccount,
					groupNo,
					myRole,
					maxMembers,
					memberCount,
					announcement,
					name,
					avatar,
					lastMessage,
					timestamp,
					lastMessageAt,
					online,
					unreadCount,
					isPinned
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			`)
			stmt.run(
				userAccount,
				chat.id,
				chat.chatType || 'PRIVATE',
				chat.peerAccount || null,
				chat.groupNo || null,
				chat.myRole || null,
				chat.maxMembers || null,
				chat.memberCount || null,
				chat.announcement || null,
				chat.name,
				chat.avatar,
				chat.lastMessage,
				chat.timestamp,
				chat.lastMessageAt || null,
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
		lastMessageAt: string,
	): Promise<void> {
		const db = getDb()
		return new Promise((resolve, reject) => {
			db.run(
				'UPDATE user_chats SET lastMessage = ?, timestamp = ?, lastMessageAt = ? WHERE userAccount = ? AND id = ?',
				[message, timestamp, lastMessageAt, userAccount, id],
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
				'SELECT id, chatId, senderId, text, timestamp, type, hasResult, result, clientMessageId, serverMessageId, deliveryStatus, sentAt FROM user_messages WHERE userAccount = ? AND chatId = ? ORDER BY CASE WHEN sentAt IS NULL OR sentAt = \'\' THEN 1 ELSE 0 END ASC, sentAt ASC, id ASC',
				[userAccount, chatId],
				(err, rows) => {
					if (err) reject(err)
					else resolve(rows as DbMessage[])
				},
			)
		})
	},

	// 按“从新到旧”的偏移分页读取，然后按时间正序返回，便于前端 prepend
	getMessagesSegment(
		userAccount: string,
		chatId: number,
		limit: number,
		offsetFromLatest = 0,
	): Promise<DbMessage[]> {
		const db = getDb()
		const safeLimit = Math.max(1, Math.min(200, Number(limit) || 20))
		const safeOffset = Math.max(0, Number(offsetFromLatest) || 0)
		return new Promise((resolve, reject) => {
			db.all(
				`
				SELECT id, chatId, senderId, text, timestamp, type, hasResult, result, clientMessageId, serverMessageId, deliveryStatus, sentAt
				FROM (
					SELECT id, chatId, senderId, text, timestamp, type, hasResult, result, clientMessageId, serverMessageId, deliveryStatus, sentAt
					FROM user_messages
					WHERE userAccount = ? AND chatId = ?
					ORDER BY CASE WHEN sentAt IS NULL OR sentAt = '' THEN 1 ELSE 0 END ASC, sentAt DESC, id DESC
					LIMIT ? OFFSET ?
				) segmented
				ORDER BY CASE WHEN sentAt IS NULL OR sentAt = '' THEN 1 ELSE 0 END ASC, sentAt ASC, id ASC
				`,
				[userAccount, chatId, safeLimit, safeOffset],
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
				INSERT OR REPLACE INTO user_messages (userAccount, id, chatId, senderId, text, timestamp, type, hasResult, result, clientMessageId, serverMessageId, deliveryStatus, sentAt)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
					message.clientMessageId || null,
					message.serverMessageId || null,
					message.deliveryStatus || null,
					message.sentAt || null,
				],
				(err: Error | null) => {
					if (err) reject(err)
					else resolve()
				},
			)
			stmt.finalize()
		})
	},

	// 跨会话检索消息（本地落库）
	searchMessages(
		userAccount: string,
		keyword: string,
		limit = 60,
	): Promise<DbMessageSearchResult[]> {
		const db = getDb()
		const safeKeyword = String(keyword || '').trim()
		const safeLimit = Math.max(1, Math.min(200, Number(limit) || 60))
		if (!safeKeyword) return Promise.resolve([])
		const likeKeyword = `%${safeKeyword.replace(/[\\%_]/g, '\\$&')}%`

		return new Promise((resolve, reject) => {
			db.all(
				`
				SELECT
					m.id,
					m.chatId,
					m.senderId,
					m.text,
					m.timestamp,
					m.type,
					m.hasResult,
					m.result,
					m.clientMessageId,
					m.serverMessageId,
					m.deliveryStatus,
					m.sentAt,
					c.name AS chatName
				FROM user_messages m
				INNER JOIN user_chats c
					ON c.userAccount = m.userAccount
					AND c.id = m.chatId
				WHERE m.userAccount = ?
					AND LOWER(COALESCE(m.text, '')) LIKE LOWER(?) ESCAPE '\\'
				ORDER BY
					CASE WHEN m.sentAt IS NULL OR m.sentAt = '' THEN 1 ELSE 0 END ASC,
					m.sentAt DESC,
					m.id DESC
				LIMIT ?
				`,
				[userAccount, likeKeyword, safeLimit],
				(err, rows) => {
					if (err) reject(err)
					else resolve(rows as DbMessageSearchResult[])
				},
			)
		})
	},
}
