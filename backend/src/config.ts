import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // P0-10：生产必须显式配置允许的前端来源（逗号分隔）；默认 '*' 仅限本地开发。
  CORS_ORIGIN: z.string().default('*'),
  DATA_DIR: z.string().default('data'),
  ZHIHU_ACCESS_SECRET: z.string().min(1).optional(),
  // P0-10：搜索配额防护
  SEARCH_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(6),
  SEARCH_DAILY_BUDGET: z.coerce.number().int().positive().default(400),
  SEARCH_ALLOW_REFRESH: z.enum(['0', '1']).default('0'),
  // P0-07：真实模型接入（未配置时 Golden 走 extraction-cache 回放）
  MODEL_BASE_URL: z.string().url().optional(),
  MODEL_API_KEY: z.string().min(1).optional(),
  MODEL_NAME: z.string().min(1).optional(),
});
export const env = EnvSchema.parse(process.env);

// P0-10：生产环境禁止通配 CORS，启动即失败（fail fast），而不是带着风险上线。
export function parseCorsOrigin(raw: string): boolean | string[] {
  if (raw.trim() === '*') {
    if (env.NODE_ENV === 'production') throw new Error('CORS_ORIGIN_MUST_BE_SET_IN_PRODUCTION');
    return true;
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}
