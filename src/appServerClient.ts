import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import readline from "node:readline";
import { commandForPlatform } from "./processCommand.js";

export interface CodexThread {
  id: string;
  preview?: string | null;
  name?: string | null;
  createdAt?: number;
  updatedAt?: number;
  cwd?: string | null;
}

interface RpcResponse {
  id?: number;
  result?: unknown;
  error?: { code?: number; message?: string };
}

export class AppServerClient {
  private process: ChildProcessWithoutNullStreams | undefined;
  private nextId = 1;
  private pending = new Map<number, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timeout: NodeJS.Timeout;
  }>();
  private starting: Promise<void> | undefined;
  private ready = false;

  constructor(
    private readonly executable: string,
    private readonly env: NodeJS.ProcessEnv,
    private readonly log: (message: string) => void
  ) {}

  async listThreads(cwd: string): Promise<CodexThread[]> {
    await this.start();
    const result = await this.request<{ data?: CodexThread[] }>("thread/list", {
      cursor: null,
      limit: 100,
      sortKey: "created_at",
      sortDirection: "desc",
      sourceKinds: ["cli"],
      cwd
    });
    return result.data ?? [];
  }

  async readThread(threadId: string): Promise<CodexThread | undefined> {
    await this.start();
    const result = await this.request<{ thread?: CodexThread }>("thread/read", {
      threadId,
      includeTurns: false
    });
    return result.thread;
  }

  dispose(): void {
    this.process?.kill();
    this.process = undefined;
    this.ready = false;
    this.rejectPending(new Error("Codex app-server stopped."));
  }

  private async start(): Promise<void> {
    if (this.process && !this.process.killed && this.ready) {
      return;
    }
    if (this.starting) {
      return this.starting;
    }
    this.starting = this.startProcess();
    try {
      await this.starting;
    } catch (error) {
      this.process?.kill();
      this.process = undefined;
      this.ready = false;
      throw error;
    } finally {
      this.starting = undefined;
    }
  }

  private async startProcess(): Promise<void> {
    const command = commandForPlatform(
      this.executable,
      ["app-server", "--listen", "stdio://"],
      this.env
    );
    const child = spawn(command.file, command.args, {
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    this.process = child;
    readline.createInterface({ input: child.stdout }).on("line", line => this.onLine(line));
    child.stderr.on("data", data => this.log(`[app-server] ${String(data).trimEnd()}`));
    child.on("error", error => {
      this.log(`[app-server error] ${error.message}`);
      this.rejectPending(error);
      this.process = undefined;
      this.ready = false;
    });
    child.on("exit", (code, signal) => {
      this.log(`[app-server exited] code=${String(code)} signal=${String(signal)}`);
      this.rejectPending(new Error(`Codex app-server exited with code ${String(code)}.`));
      this.process = undefined;
      this.ready = false;
    });

    await new Promise<void>((resolve, reject) => {
      const onSpawn = (): void => {
        child.off("error", onError);
        resolve();
      };
      const onError = (error: Error): void => {
        child.off("spawn", onSpawn);
        reject(error);
      };
      child.once("spawn", onSpawn);
      child.once("error", onError);
    });

    await this.request("initialize", {
      clientInfo: {
        name: "codex_task_terminal",
        title: "Codex Terminal Title",
        version: "0.1.0"
      }
    });
    this.notify("initialized", {});
    this.ready = true;
  }

  private request<T = unknown>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    const child = this.process;
    if (!child?.stdin.writable) {
      return Promise.reject(new Error("Codex app-server is not writable."));
    }
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex app-server request timed out: ${method}`));
      }, 5000);
      this.pending.set(id, {
        resolve: value => resolve(value as T),
        reject,
        timeout
      });
      child.stdin.write(`${JSON.stringify({ method, id, params })}\n`, error => {
        if (error) {
          const pending = this.pending.get(id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pending.delete(id);
          }
          reject(error);
        }
      });
    });
  }

  private notify(method: string, params: unknown): void {
    this.process?.stdin.write(`${JSON.stringify({ method, params })}\n`);
  }

  private onLine(line: string): void {
    let message: RpcResponse;
    try {
      message = JSON.parse(line) as RpcResponse;
    } catch {
      this.log(`[app-server invalid JSON] ${line}`);
      return;
    }
    if (message.id === undefined) {
      return;
    }
    const pending = this.pending.get(message.id);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new Error(message.error.message ?? `RPC error ${String(message.error.code)}`));
    } else {
      pending.resolve(message.result);
    }
  }

  private rejectPending(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    this.pending.clear();
  }
}
