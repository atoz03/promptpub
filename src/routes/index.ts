import { Hono } from 'hono';
import auth from './auth';
import prompts from './prompts';
import categories from './categories';
import tags from './tags';
import workspaces from './workspaces';
import exportRouter from './export';

const api = new Hono();

// 挂载路由
api.route('/auth', auth);
api.route('/prompts', prompts);
api.route('/categories', categories);
api.route('/tags', tags);
api.route('/workspaces', workspaces);
api.route('/export', exportRouter);

// 健康检查
api.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

export default api;
