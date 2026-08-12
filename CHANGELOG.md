# Codex Terminal Title changelog

## 0.2.1

- Keep automatic detection active when NVM or a Bash profile prepends another directory to PATH.
- Inject a temporary Bash `codex` function without modifying shell configuration files.

## 0.2.0

- Automatically detect Codex CLI in every newly created integrated terminal.
- Route ordinary `codex` commands through a lightweight platform proxy.
- Remove the requirement to launch a special extension-controlled terminal.
- Preserve the real Codex CLI input, output, arguments and exit code.

## 0.1.1

- Update both the extension terminal name and its OSC sequence title.
- Support custom tab templates that use `${sequence}`.

## 0.1.0

- Create extension-controlled Codex CLI terminals.
- Show a truncated first prompt until Codex generates a task title.
- Synchronize later task name changes.
- Filter competing OSC terminal-title sequences.
- Support local and remote Windows, macOS and Linux extension hosts.
