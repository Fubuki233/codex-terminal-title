# Codex Terminal Title

Stop guessing which `bash`, `PowerShell`, or `codex` terminal belongs to which task.

Codex Terminal Title automatically detects Codex CLI in every new VS Code terminal. Use your normal terminal and run `codex` as usual—there is no special terminal to remember.

While Codex prepares its generated task title, the tab shows a shortened version of your first prompt. As soon as the generated title is available, the extension switches to it and keeps following later title changes.

## What it does

- **Works in normal terminals.** Run `codex` from Bash, Zsh, Fish, PowerShell, CMD or Git Bash.
- **Detects Codex automatically.** New integrated terminals are prepared when the extension activates; other commands are unaffected.
- **Shows your task immediately.** Your first prompt becomes the temporary terminal name.
- **Switches to the generated title automatically.** The concise Codex task title replaces the prompt preview when available.
- **Follows renamed tasks.** Rename the current Codex task and the terminal title follows.
- **Keeps long prompts readable.** Long prompts are shortened without splitting Chinese characters or Emoji.
- **Prevents title overwrite.** The task title is periodically restored if a shell or CLI process tries to replace it.
- **Keeps multiple Codex tasks separate.** Every Codex process tracks the task created in its own working directory.

## How the title changes

```text
Codex
  ↓ after you submit a prompt
Codex: 修复登录流程并补充相关测…
  ↓ after Codex generates a title
Codex: 修复 OAuth 登录流程
```

## Usage

1. After installing or updating the extension, close existing terminal instances and open a new terminal.
2. Run `codex` normally.
3. Submit your prompt. The terminal title updates automatically.

The Command Palette action **Codex Terminal Title: New Codex Terminal** is available as a shortcut, but it uses the same automatic detection mechanism as every other terminal.

Both VS Code's default terminal title template and custom `${sequence}` templates are supported.

## Works where your Codex CLI works

- Windows
- macOS
- Linux
- WSL
- Remote SSH
- Dev Containers and Codespaces

In a remote workspace, install the extension and Codex CLI in the remote environment. VS Code runs the detector beside the CLI.

## Requirements

- VS Code 1.96 or newer.
- Codex CLI installed in the same local or remote environment as the terminal.
- A Codex CLI version that supports App Server task metadata.

If `codex` is not on your PATH, set **Codex Terminal Title: Codex Path** to its absolute path, then open a new terminal.

## Settings

| Setting | Default | What it changes |
| --- | --- | --- |
| `codexTaskTerminal.autoDetect` | `true` | Automatically manage Codex launched in new terminals. |
| `codexTaskTerminal.codexPath` | `codex` | Location of the real Codex CLI. |
| `codexTaskTerminal.codexArgs` | `[]` | Extra options passed whenever Codex starts. |
| `codexTaskTerminal.titlePrefix` | `Codex: ` | Text shown before each task name. |
| `codexTaskTerminal.promptMaxWidth` | `32` | Maximum width of the temporary prompt title. |
| `codexTaskTerminal.ellipsis` | `…` | Marker used when a prompt is shortened. |
| `codexTaskTerminal.pollIntervalMs` | `1000` | How quickly generated or renamed titles are detected. |

Setting changes apply to terminals opened afterward. Disable `autoDetect` if you do not want the extension to route the `codex` command through its local title proxy.

## Privacy

The title proxy and Codex App Server run locally in the same machine, WSL distribution, SSH host or container as the terminal. Prompt previews and task names are not sent to an additional service.

## Current limitation

VS Code cannot change the environment of terminals that were already running before extension activation. Open a new terminal once after installation, update or settings changes.

If an unrelated Codex CLI starts outside VS Code in the exact same folder at the same moment, task matching can be ambiguous. This does not normally affect separate working directories.

## Feedback

Found a problem or have an idea? [Open an issue](https://github.com/Fubuki233/codex-terminal-title/issues).

Codex is a product of OpenAI. This community extension is not affiliated with or endorsed by OpenAI.
