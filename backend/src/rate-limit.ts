// P0-10：进程内滑动窗口限流 + 每日预算计数（单实例部署够用，多实例需换 Redis）。
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(private readonly windowMs: number, private readonly max: number) {}
  check(key: string, now = Date.now()): { allowed: boolean; retryAfterMs: number } {
    const windowStart = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((ts) => ts > windowStart);
    if (list.length >= this.max) {
      const retryAfterMs = list[0]! + this.windowMs - now;
      this.hits.set(key, list);
      return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.hits.clear(); // 粗粒度防内存膨胀
    return { allowed: true, retryAfterMs: 0 };
  }
}

export class DailyBudget {
  private spent = 0;
  private dayKey = new Date().toISOString().slice(0, 10);
  constructor(private readonly budget: number) {}
  /** 返回是否还有额度；只在 reallySpend 时计数 */
  remaining(now = new Date()): number {
    const key = now.toISOString().slice(0, 10);
    if (key !== this.dayKey) { this.dayKey = key; this.spent = 0; }
    return Math.max(0, this.budget - this.spent);
  }
  spend(): void { this.spent += 1; }
}
