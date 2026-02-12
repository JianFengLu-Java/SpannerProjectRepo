import sqlite3 from 'sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: sqlite3.Database

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
				db.run('PRAGMA journal_mode = WAL', (err) => {
					if (err) console.error('WAL mode error: ', err)
					createTables().then(resolve).catch(reject)
				})
			}
		})
	})
}

function createTables(): Promise<void> {
	return new Promise((resolve, reject) => {
		db.serialize(() => {
			// 旧聊天表（保留兼容，不再写入）
			db.run(`
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
			db.run(
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
					db.run(
						`
						CREATE TABLE IF NOT EXISTS user_chats (
							userAccount TEXT NOT NULL,
							id INTEGER NOT NULL,
							name TEXT,
							avatar TEXT,
							lastMessage TEXT,
							timestamp TEXT,
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
							db.run(
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
									PRIMARY KEY (userAccount, id)
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
		db.all(`PRAGMA table_info(${tableName})`, (err, rows: TableInfoRow[]) => {
			if (err) {
				reject(err)
				return
			}
			resolve(rows.some((row) => row.name === columnName))
		})
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
			db.run(
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
	// 兼容旧库：旧表可能缺少这些列，缺失时补列，避免消息只在内存存在。
	await addColumnIfMissing('user_chats', 'userAccount', 'TEXT')
	await addColumnIfMissing('user_chats', 'unreadCount', 'INTEGER DEFAULT 0')
	await addColumnIfMissing('user_chats', 'isPinned', 'INTEGER DEFAULT 0')

	await addColumnIfMissing('user_messages', 'userAccount', 'TEXT')
	await addColumnIfMissing('user_messages', 'hasResult', 'INTEGER DEFAULT 0')
	await addColumnIfMissing('user_messages', 'result', 'TEXT')
}

export function getDb(): sqlite3.Database {
	if (!db) {
		throw new Error('Database not initialized. Call initDatabase first.')
	}
	return db
}
