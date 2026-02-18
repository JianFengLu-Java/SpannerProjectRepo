import sqlite3 from 'sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'

let db: sqlite3.Database | null = null

interface TableInfoRow {
	name: string
}

export function initDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		const userDataPath = app.getPath('userData')
		const dbDir = join(userDataPath, 'database')

		if (!existsSync(dbDir)) {
			mkdirSync(dbDir, { recursive: true })
		}

		const dbPath = join(dbDir, 'spanner.db')
		db = new sqlite3.Database(dbPath, (err) => {
			if (err) {
				console.error('Database opening error: ', err)
				reject(err)
			} else {
				// Enable WAL mode
				const database = db
				if (!database) {
					reject(new Error('Database not initialized'))
					return
				}
				database.run('PRAGMA journal_mode = WAL', (err) => {
					if (err) console.error('WAL mode error: ', err)
					createTables().then(resolve).catch(reject)
				})
			}
		})
	})
}

function createTables(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!db) {
			reject(new Error('Database not initialized'))
			return
		}
		const database = db
		database.serialize(() => {
			// 旧聊天表（保留兼容，不再写入）
			database.run(`
				CREATE TABLE IF NOT EXISTS chats (
					id INTEGER PRIMARY KEY,
					name TEXT,
					avatar TEXT,
					lastMessage TEXT,
					timestamp TEXT,
					online INTEGER,
					unreadCount INTEGER DEFAULT 0,
					isPinned INTEGER DEFAULT 0
				)
			`)

			// 旧消息表（保留兼容，不再写入）
			database.run(
				`
				CREATE TABLE IF NOT EXISTS messages (
					id INTEGER PRIMARY KEY,
					chatId INTEGER,
					senderId TEXT,
					text TEXT,
					timestamp TEXT,
					type TEXT,
					hasResult INTEGER DEFAULT 0,
					result TEXT,
					FOREIGN KEY (chatId) REFERENCES chats (id) ON DELETE CASCADE
				)
			`,
				(err) => {
					if (err) {
						reject(err)
						return
					}
					// 按账号隔离的新聊天表
						database.run(
						`
							CREATE TABLE IF NOT EXISTS user_chats (
								userAccount TEXT NOT NULL,
								id INTEGER NOT NULL,
								chatType TEXT DEFAULT 'PRIVATE',
								peerAccount TEXT,
								groupNo TEXT,
								myRole TEXT,
								maxMembers INTEGER,
								memberCount INTEGER,
								announcement TEXT,
								name TEXT,
								avatar TEXT,
								lastMessage TEXT,
								timestamp TEXT,
								lastMessageAt TEXT,
								online INTEGER,
								unreadCount INTEGER DEFAULT 0,
								isPinned INTEGER DEFAULT 0,
								PRIMARY KEY (userAccount, id)
							)
					`,
						(err) => {
							if (err) {
								reject(err)
								return
							}
							// 按账号隔离的新消息表
								database.run(
								`
								CREATE TABLE IF NOT EXISTS user_messages (
									userAccount TEXT NOT NULL,
									id INTEGER NOT NULL,
									chatId INTEGER NOT NULL,
									senderId TEXT,
									text TEXT,
									timestamp TEXT,
									type TEXT,
									hasResult INTEGER DEFAULT 0,
									result TEXT,
									clientMessageId TEXT,
									serverMessageId TEXT,
									deliveryStatus TEXT,
									sentAt TEXT,
									PRIMARY KEY (userAccount, chatId, id)
								)
								`,
								(err) => {
									if (err) {
										reject(err)
										return
									}
									ensureUserScopedTableColumns()
										.then(resolve)
										.catch(reject)
								},
							)
						},
					)
				},
			)
		})
	})
}

function hasColumn(tableName: string, columnName: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		if (!db) {
			reject(new Error('Database not initialized'))
			return
		}
		const database = db
		database.all(
			`PRAGMA table_info(${tableName})`,
			(err, rows: TableInfoRow[]) => {
				if (err) {
					reject(err)
					return
				}
				resolve(rows.some((row) => row.name === columnName))
			},
		)
	})
}

function addColumnIfMissing(
	tableName: string,
	columnName: string,
	columnDef: string,
): Promise<void> {
		return hasColumn(tableName, columnName).then((exists) => {
			if (exists) return
			return new Promise((resolve, reject) => {
				const database = getDb()
				database.run(
					`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`,
					(err) => {
					if (err) reject(err)
					else resolve()
				},
			)
		})
	})
}

async function ensureUserScopedTableColumns(): Promise<void> {
	await ensureUserMessagesPrimaryKey()

	// 兼容旧库：旧表可能缺少这些列，缺失时补列，避免消息只在内存存在。
	await addColumnIfMissing('user_chats', 'userAccount', 'TEXT')
	await addColumnIfMissing('user_chats', 'chatType', "TEXT DEFAULT 'PRIVATE'")
	await addColumnIfMissing('user_chats', 'peerAccount', 'TEXT')
	await addColumnIfMissing('user_chats', 'groupNo', 'TEXT')
	await addColumnIfMissing('user_chats', 'myRole', 'TEXT')
	await addColumnIfMissing('user_chats', 'maxMembers', 'INTEGER')
	await addColumnIfMissing('user_chats', 'memberCount', 'INTEGER')
	await addColumnIfMissing('user_chats', 'announcement', 'TEXT')
	await addColumnIfMissing('user_chats', 'unreadCount', 'INTEGER DEFAULT 0')
	await addColumnIfMissing('user_chats', 'isPinned', 'INTEGER DEFAULT 0')
	await addColumnIfMissing('user_chats', 'lastMessageAt', 'TEXT')

	await addColumnIfMissing('user_messages', 'userAccount', 'TEXT')
	await addColumnIfMissing('user_messages', 'hasResult', 'INTEGER DEFAULT 0')
	await addColumnIfMissing('user_messages', 'result', 'TEXT')
	await addColumnIfMissing('user_messages', 'clientMessageId', 'TEXT')
	await addColumnIfMissing('user_messages', 'serverMessageId', 'TEXT')
	await addColumnIfMissing('user_messages', 'deliveryStatus', 'TEXT')
	await addColumnIfMissing('user_messages', 'sentAt', 'TEXT')

	// 查询性能索引：会话排序、历史分页、全局检索定位
	await runSql(
		'CREATE INDEX IF NOT EXISTS idx_user_chats_account_lastMessageAt ON user_chats(userAccount, lastMessageAt DESC, id DESC)',
	)
	await runSql(
		'CREATE INDEX IF NOT EXISTS idx_user_messages_account_chat_sentAt_id ON user_messages(userAccount, chatId, sentAt DESC, id DESC)',
	)
	await runSql(
		'CREATE INDEX IF NOT EXISTS idx_user_messages_account_sentAt_id ON user_messages(userAccount, sentAt DESC, id DESC)',
	)
	await runSql(
		'CREATE INDEX IF NOT EXISTS idx_user_messages_account_serverId ON user_messages(userAccount, serverMessageId)',
	)
	await runSql(
		'CREATE INDEX IF NOT EXISTS idx_user_messages_account_clientId ON user_messages(userAccount, clientMessageId)',
	)
}

interface TableInfoWithPkRow extends TableInfoRow {
	pk?: number
}

function getPrimaryKeyColumns(tableName: string): Promise<string[]> {
	return new Promise((resolve, reject) => {
		const database = getDb()
		database.all(
			`PRAGMA table_info(${tableName})`,
			(err, rows: TableInfoWithPkRow[]) => {
				if (err) {
					reject(err)
					return
				}
				const cols = (rows || [])
					.filter((row) => Number(row.pk) > 0)
					.sort((a, b) => Number(a.pk) - Number(b.pk))
					.map((row) => row.name)
				resolve(cols)
			},
		)
	})
}

function runSql(sql: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!db) {
			reject(new Error('Database not initialized'))
			return
		}
		const database = db
		database.run(sql, (err) => {
			if (err) reject(err)
			else resolve()
		})
	})
}

async function ensureUserMessagesPrimaryKey(): Promise<void> {
	const primaryKeys = await getPrimaryKeyColumns('user_messages')
	const expected = ['userAccount', 'chatId', 'id']
	const isExpected =
		primaryKeys.length === expected.length &&
		primaryKeys.every((col, idx) => col === expected[idx])

	if (isExpected) return

	await runSql('BEGIN TRANSACTION')
	try {
		await runSql(`
			CREATE TABLE IF NOT EXISTS user_messages_v2 (
				userAccount TEXT NOT NULL,
				id INTEGER NOT NULL,
				chatId INTEGER NOT NULL,
				senderId TEXT,
				text TEXT,
				timestamp TEXT,
				type TEXT,
				hasResult INTEGER DEFAULT 0,
				result TEXT,
				clientMessageId TEXT,
				serverMessageId TEXT,
				deliveryStatus TEXT,
				sentAt TEXT,
				PRIMARY KEY (userAccount, chatId, id)
			)
		`)
		await runSql(`
			INSERT OR IGNORE INTO user_messages_v2 (userAccount, id, chatId, senderId, text, timestamp, type, hasResult, result, clientMessageId, serverMessageId, deliveryStatus, sentAt)
			SELECT userAccount, id, chatId, senderId, text, timestamp, type, hasResult, result, NULL, NULL, NULL, NULL
			FROM user_messages
		`)
		await runSql('DROP TABLE user_messages')
		await runSql('ALTER TABLE user_messages_v2 RENAME TO user_messages')
		await runSql('COMMIT')
	} catch (error) {
		await runSql('ROLLBACK')
		throw error
	}
}

export function getDb(): sqlite3.Database {
	if (!db) {
		throw new Error('Database not initialized. Call initDatabase first.')
	}
	return db
}

export function closeDatabase(): Promise<void> {
	return new Promise((resolve, reject) => {
		if (!db) {
			resolve()
			return
		}
		db.close((err) => {
			if (err) {
				reject(err)
				return
			}
			// sqlite 连接已关闭，清空引用，避免后续误用关闭连接
			db = null
			resolve()
		})
	})
}

export async function purgeDatabaseFiles(): Promise<void> {
	await closeDatabase()
	const userDataPath = app.getPath('userData')
	const dbDir = join(userDataPath, 'database')
	if (existsSync(dbDir)) {
		rmSync(dbDir, { recursive: true, force: true })
	}
}
