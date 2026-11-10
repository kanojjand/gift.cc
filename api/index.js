// Вход для тестовой копии на Vercel. Боевой сайт gift.cclab.kz работает через src/server.js в Docker.
// На Vercel нет постоянного диска: база и фото лежат во временной папке и могут пропадать.
import { getRequestListener } from '@hono/node-server';
import { bootApp } from '../src/bootstrap.js';
import { loadConfig } from '../src/config.js';

const { app } = bootApp(loadConfig({ DATA_DIR: '/tmp/flowers', TRUST_PROXY: '1', ...process.env }));

export default getRequestListener(app.fetch);
