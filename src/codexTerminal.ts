import * as vscode from "vscode";
import * as pty from "node-pty";
import { AppServerClient, CodexThread } from "./appServerClient.js";
import { OscTitleFilter } from "./oscTitleFilter.js";
import { commandForPlatform } from "./processCommand.js";
import { ThreadMatcher } from "./threadMatcher.js";
import { normalizeTitle, terminalTitleSequence, titleForThread } from "./title.js";

interface TerminalOptions {
  cwd: string;
  executable: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  prefix: string;
  promptMaxWidth: number;
  ellipsis: string;
  pollIntervalMs: number;
}

export class CodexPseudoterminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<number | void>();
  private readonly nameEmitter = new vscode.EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidClose = this.closeEmitter.event;
  readonly onDidChangeName = this.nameEmitter.event;

  private process: pty.IPty | undefined;
  private pollTimer: NodeJS.Timeout | undefined;
  private threadId: string | undefined;
  private disposed = false;
  private readonly titleFilter = new OscTitleFilter();

  constructor(
    private readonly options: TerminalOptions,
    private readonly appServer: AppServerClient,
    private readonly matcher: ThreadMatcher,
    private readonly log: (message: string) => void
  ) {}

  open(initialDimensions: vscode.TerminalDimensions | undefined): void {
    void this.start(initialDimensions);
  }

  close(): void {
    this.dispose();
  }

  handleInput(data: string): void {
    this.process?.write(data);
  }

  setDimensions(dimensions: vscode.TerminalDimensions): void {
    this.process?.resize(dimensions.columns, dimensions.rows);
  }

  private async start(initialDimensions: vscode.TerminalDimensions | undefined): Promise<void> {
    this.setTitle("Codex");
    const notBeforeEpochSeconds = Math.floor(Date.now() / 1000) - 2;
    const baseline = await this.matcher.snapshot(this.options.cwd);
    if (this.disposed) {
      return;
    }

    const command = commandForPlatform(
      this.options.executable,
      this.options.args,
      this.options.env
    );
    try {
      this.process = pty.spawn(command.file, command.args, {
        name: this.options.env.TERM ?? "xterm-256color",
        cols: initialDimensions?.columns ?? 100,
        rows: initialDimensions?.rows ?? 30,
        cwd: this.options.cwd,
        env: environmentForPty(this.options.env)
      });
    } catch (error) {
      this.writeEmitter.fire(`\r\nUnable to start Codex CLI: ${errorMessage(error)}\r\n`);
      this.closeEmitter.fire(1);
      return;
    }

    this.process.onData(data => {
      const filtered = this.titleFilter.push(data);
      if (filtered) {
        this.writeEmitter.fire(filtered);
      }
    });
    this.process.onExit(event => {
      const pending = this.titleFilter.flush();
      if (pending) {
        this.writeEmitter.fire(pending);
      }
      this.dispose(false);
      this.closeEmitter.fire(event.exitCode);
    });
    this.beginMetadataPolling(baseline, notBeforeEpochSeconds);
  }

  private beginMetadataPolling(
    baseline: ReadonlySet<string>,
    notBeforeEpochSeconds: number
  ): void {
    const poll = async (): Promise<void> => {
      if (this.disposed) {
        return;
      }
      try {
        let thread: CodexThread | undefined;
        if (!this.threadId) {
          thread = await this.matcher.matchNewThread(
            this.options.cwd,
            baseline,
            notBeforeEpochSeconds
          );
          this.threadId = thread?.id;
        } else {
          thread = await this.appServer.readThread(this.threadId);
        }
        if (thread) {
          this.setTitle(titleForThread(
            thread.name,
            thread.preview,
            this.options.promptMaxWidth,
            this.options.ellipsis
          ));
        }
      } catch (error) {
        this.log(`[metadata polling] ${errorMessage(error)}`);
      } finally {
        if (!this.disposed) {
          this.pollTimer = setTimeout(poll, this.options.pollIntervalMs);
        }
      }
    };
    void poll();
  }

  private setTitle(title: string): void {
    const fullTitle = normalizeTitle(`${this.options.prefix}${title}`) || "Codex";
    this.nameEmitter.fire(fullTitle);
    this.writeEmitter.fire(terminalTitleSequence(fullTitle));
  }

  private dispose(killProcess = true): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    this.matcher.release(this.threadId);
    if (killProcess) {
      this.process?.kill();
    }
    this.writeEmitter.dispose();
    this.nameEmitter.dispose();
  }
}

function environmentForPty(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
