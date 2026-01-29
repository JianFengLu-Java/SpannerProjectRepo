import sqlite3 from 'sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: sqlite3.Database

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
			// 聊天列表表
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

			// 消息表
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
					if (err) reject(err)
					else resolve()
				},
			)
		})
	})
}

export function getDb(): sqlite3.Database {
	if (!db) {
		throw new Error('Database not initialized. Call initDatabase first.')
	}
	return db
}
