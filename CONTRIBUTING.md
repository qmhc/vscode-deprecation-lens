# Contributing Guide

Thank you for your interest in Deprecation Lens! Contributions of any kind are welcome.

## How to Contribute

### Reporting Issues

- Use [GitHub Issues](https://github.com/qmhc/vscode-deprecation-lens/issues) to report bugs or suggest features
- Please search for existing issues first
- Provide clear descriptions and reproduction steps

### Submitting Code

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add some feature'`
4. Push the branch: `git push origin feature/your-feature`
5. Create a Pull Request

### Commit Convention

Please follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation update
- `style`: Code formatting
- `refactor`: Code refactoring
- `test`: Test related
- `chore`: Build/tooling related

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10.26+

### Project Structure

```text
vscode-deprecation-lens/
├── packages/
│   ├── cli/           # CLI tool and programmatic API
│   │   └── src/
│   │       ├── cli.ts         # CLI entry point
│   │       ├── scanner.ts     # Core scanning engine
│   │       ├── reporter.ts    # Output formatters
│   │       ├── types.ts       # Type definitions
│   │       └── index.ts       # API exports
│   ├── core/          # VSCode extension core
│   │   └── src/
│   │       ├── extension.ts           # Extension entry
│   │       ├── globalScanWebviewProvider.ts # Activity Bar WebView
│   │       ├── tsLanguageService.ts   # Calls CLI scanner
│   │       └── ...
│   └── ui/            # WebView UI (Vite)
│       └── src/
│           ├── App.ts         # Main application
│           ├── virtualTree.ts # Virtual scrolling tree
│           └── ...
├── dist/              # Compiled output
│   ├── extension.js   # Core extension
│   └── webview/       # WebView assets
└── assets/            # Icons
```

### Development Workflow

```bash
# Clone the repository
git clone https://github.com/qmhc/vscode-deprecation-lens.git
cd vscode-deprecation-lens

# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Or build separately
pnpm run compile      # Build core
pnpm run compile:ui   # Build UI

# Watch mode (core only)
pnpm run watch

# Start debugging
# Press F5 in VSCode to launch Extension Development Host
```

### Testing

```bash
# Run tests
pnpm run test

# Lint
pnpm run lint

# Format
pnpm run prettier
```

### Code Standards

- Write in TypeScript
- Keep code clean and concise
- Add necessary comments
- Ensure compilation passes without errors
- Follow existing code style (ESLint + Prettier configured)

## Code of Conduct

Please read and follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

Contributed code will be licensed under [MIT](./LICENSE.md).
