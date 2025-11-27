import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import api from './routes';
import { migrate } from './db/migrate';

const app = new Hono();

// 中间件
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:7003'],
  credentials: true,
}));

// API 路由
app.route('/api', api);

// 静态文件服务（前端）
app.use('/assets/*', serveStatic({ root: './frontend/dist' }));
app.use('/favicon.ico', serveStatic({ path: './frontend/dist/favicon.ico' }));

// SPA 回退路由
app.get('*', serveStatic({ path: './frontend/dist/index.html' }));

// 初始化数据库
console.log('Initializing database...');
migrate();

// 启动服务器
const port = parseInt(process.env.PORT || '7003');
console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 PromptPub Server                                     ║
║                                                           ║
║   Server running at: http://localhost:${port}               ║
║   API endpoint:      http://localhost:${port}/api           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`);

export default {
  port,
  fetch: app.fetch,
};
