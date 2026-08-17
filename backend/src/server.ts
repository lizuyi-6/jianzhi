import { buildApp } from './app.js';
import { env } from './config.js';
const app = await buildApp(undefined, { logger: { level: env.LOG_LEVEL } });
const shutdown = async (signal: string) => { app.log.info({ signal }, 'shutdown requested'); await app.close(); process.exit(0); };
process.once('SIGTERM', () => void shutdown('SIGTERM')); process.once('SIGINT', () => void shutdown('SIGINT'));
await app.listen({ port: env.PORT, host: env.HOST });
