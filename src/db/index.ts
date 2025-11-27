import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const dbPath = process.env.DATABASE_PATH || './data/promptpub.db';

// 创建 SQLite 数据库连接
const sqlite = new Database(dbPath, { create: true });

// 启用 WAL 模式以提升性能
sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

// 创建 Drizzle ORM 实例
export const db = drizzle(sqlite, { schema });

export { sqlite };
export * from './schema';
