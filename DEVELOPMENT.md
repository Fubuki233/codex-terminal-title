# Development and publishing

## Checks

```sh
npm ci
npm run check
npm test
npm run build
```

## Platform packages

`node-pty` contains native code. The GitHub Actions workflow builds these Marketplace targets on matching runners:

- `win32-x64`, `win32-arm64`
- `linux-x64`, `linux-arm64`
- `darwin-x64`, `darwin-arm64`

## Marketplace release

1. Add the final GitHub `repository`, `homepage` and `bugs` URLs to `package.json`.
2. Store a Marketplace Personal Access Token as `VSCE_PAT`.
3. Run the platform packaging workflow.
4. Install and smoke-test each VSIX on its target platform.
5. Publish each target package under the same extension identifier and version.
