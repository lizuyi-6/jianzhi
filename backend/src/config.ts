import { z } from 'zod';
const EnvSchema = z.object({ PORT: z.coerce.number().int().positive().max(65535).default(3001), HOST: z.string().default('0.0.0.0'), LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'), CORS_ORIGIN: z.string().default('*'), DATA_DIR: z.string().default('data'), ZHIHU_ACCESS_SECRET: z.string().min(1).optional() });
export const env = EnvSchema.parse(process.env);
