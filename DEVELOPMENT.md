# Development and publishing

## Architecture

The workspace extension prepends a platform-specific proxy to the `PATH` of newly created integrated terminals. The proxy is named `codex`, locates the real Codex executable using the original PATH, starts it with inherited terminal input/output, and emits OSC title updates from local App Server metadata.

The proxy is written in dependency-free Go and builds with `CGO_ENABLED=0`. Ordinary commands never invoke it.

## Checks

```sh
npm ci
npm run check
npm test
npm run test:proxy
npm run build
```

## Platform packages

The GitHub Actions workflow builds the proxy and VSIX on matching runners for:

- `win32-x64`, `win32-arm64`
- `linux-x64`, `linux-arm64`
- `darwin-x64`, `darwin-arm64`

Set `VSCODE_TARGET` when cross-compiling the proxy manually.

## Marketplace release

1. Store a Marketplace Personal Access Token as `VSCE_PAT`.
2. Run the platform packaging workflow.
3. Install and smoke-test each VSIX on its target platform.
4. Publish every target package under the same extension identifier and version.
