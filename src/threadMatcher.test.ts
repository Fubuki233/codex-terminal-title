import assert from "node:assert/strict";
import test from "node:test";
import { AppServerClient, CodexThread } from "./appServerClient.js";
import { ThreadMatcher } from "./threadMatcher.js";

class FakeClient {
  threads: CodexThread[] = [];

  async listThreads(): Promise<CodexThread[]> {
    return this.threads;
  }
}

test("does not bind an old thread when the baseline is unavailable", async () => {
  const client = new FakeClient();
  client.threads = [{ id: "old", createdAt: 100 }];
  const matcher = new ThreadMatcher(client as unknown as AppServerClient);
  assert.equal(await matcher.matchNewThread("/repo", new Set(), 200), undefined);
});

test("claims new threads independently", async () => {
  const client = new FakeClient();
  client.threads = [
    { id: "second", createdAt: 202 },
    { id: "first", createdAt: 201 }
  ];
  const matcher = new ThreadMatcher(client as unknown as AppServerClient);
  assert.equal((await matcher.matchNewThread("/repo", new Set(), 200))?.id, "first");
  assert.equal((await matcher.matchNewThread("/repo", new Set(), 200))?.id, "second");
});
