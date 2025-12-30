# Deprecation Lens

A VSCode extension that dynamically collects and displays all usages of `@deprecated` marked variables, methods, types, etc. in your project.

## Features

- 🔍 Scan your entire project for deprecated API usages
- 🌲 View results grouped by file in a tree structure
- 🎯 Filter files with include/exclude patterns
- 🖱️ Click to jump directly to the code location

## Supported File Types

- `.ts` / `.tsx`
- `.js` / `.jsx`
- `.mjs` / `.mts`
- `.cjs` / `.cts`

## Usage

### Explorer Panel (Current Deprecations)

Located in the Explorer sidebar, this panel shows deprecated usages in currently open files. It updates automatically as you open/close files.

### Activity Bar Panel (Project Deprecations)

Click the Deprecation Lens icon in the Activity Bar to access the full project scanner:

1. Optionally set "Files to include" (e.g., `src/**/*.ts`)
2. Optionally set "Files to exclude" (e.g., `**/*.test.ts`)
3. Click "Start Scan" to scan the project
4. Results stream in real-time as files are scanned
5. Click "Cancel" to stop scanning at any time
6. Click any item to jump to its location

## How It Works

The extension uses TypeScript Language Service's `getSuggestionDiagnostics()` API to detect deprecated usages (diagnostic codes 6385, 6386, 6387). This provides accurate detection based on TypeScript's type analysis.

## Development

This is a monorepo with two packages:

- `packages/core` - VSCode extension core (TypeScript)
- `packages/ui` - WebView UI (Vite + TypeScript)

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Watch mode (core only)
pnpm run watch

# Run tests
pnpm run test

# Lint
pnpm run lint

# Package
pnpm dlx @vscode/vsce package --no-dependencies
```

## License

[MIT](./LICENSE.md)

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details.
