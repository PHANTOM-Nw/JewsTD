interface RateWindow {
  count: number
  resetsAt: number
}

export class MemoryRateLimiter {
  private readonly windows = new Map<string, RateWindow>()

  constructor(
    private readonly maximum: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now
  ) {}

  consume(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const currentTime = this.now()
    const current = this.windows.get(key)

    if (!current || current.resetsAt <= currentTime) {
      this.windows.set(key, {
        count: 1,
        resetsAt: currentTime + this.windowMs
      })
      this.removeExpiredWindows(currentTime)
      return { allowed: true, retryAfterSeconds: 0 }
    }

    current.count += 1
    if (current.count <= this.maximum) {
      return { allowed: true, retryAfterSeconds: 0 }
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.resetsAt - currentTime) / 1000)
      )
    }
  }

  private removeExpiredWindows(currentTime: number): void {
    if (this.windows.size < 1000) return
    for (const [key, window] of this.windows) {
      if (window.resetsAt <= currentTime) this.windows.delete(key)
    }
  }
}
