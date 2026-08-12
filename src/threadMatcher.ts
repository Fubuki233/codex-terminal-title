import { AppServerClient, CodexThread } from "./appServerClient.js";

export class ThreadMatcher {
  private readonly claimed = new Set<string>();

  constructor(private readonly client: AppServerClient) {}

  async snapshot(cwd: string): Promise<Set<string>> {
    try {
      return new Set((await this.client.listThreads(cwd)).map(thread => thread.id));
    } catch {
      return new Set();
    }
  }

  async matchNewThread(
    cwd: string,
    baseline: ReadonlySet<string>,
    notBeforeEpochSeconds: number
  ): Promise<CodexThread | undefined> {
    const threads = await this.client.listThreads(cwd);
    const candidate = threads
      .filter(thread => !baseline.has(thread.id) && !this.claimed.has(thread.id))
      .filter(thread => thread.createdAt === undefined || thread.createdAt >= notBeforeEpochSeconds)
      .sort((left, right) => (left.createdAt ?? 0) - (right.createdAt ?? 0))[0];
    if (candidate) {
      this.claimed.add(candidate.id);
    }
    return candidate;
  }

  release(threadId: string | undefined): void {
    if (threadId) {
      this.claimed.delete(threadId);
    }
  }
}
