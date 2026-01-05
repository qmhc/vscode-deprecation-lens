# @deprecation-lens/cli

CLI tool and programmatic API for scanning TypeScript/JavaScript deprecation usages.

## Features

- 🔍 Scan projects for `@deprecated` API usages
- 📦 Track which npm package each deprecation comes from
- 🎯 Filter by file patterns or source packages
- 📊 Multiple output formats: log, JSON, Markdown, HTML
- 🔌 Programmatic API for custom tooling integration

## Installation

```bash
# Global install
npm install -g @deprecation-lens/cli

# Or use npx directly
npx @deprecation-lens/cli

# Or add to project
npm install -D @deprecation-lens/cli
```

## CLI Usage

```bash
deprecation-scanner [path] [options]
```

Or

```bash
dps [path] [options]
```

### Options

| Option                      | Alias | Description                                      | Default |
| --------------------------- | ----- | ------------------------------------------------ | ------- |
| `--include <pattern>`       | `-i`  | Include file pattern (glob)                      | -       |
| `--exclude <pattern>`       | `-e`  | Exclude file pattern (glob)                      | -       |
| `--from-package <packages>` | `-p`  | Filter by source packages (comma-separated)      | -       |
| `--format <format>`         | `-f`  | Output format: `log`, `json`, `markdown`, `html` | `log`   |
| `--output <file>`           | `-o`  | Write results to file                            | stdout  |
| `--help`                    | `-h`  | Show help                                        | -       |
| `--version`                 | `-v`  | Show version                                     | -       |

### Examples

```bash
# Scan current directory
deprecation-scanner

# Scan specific directory
deprecation-scanner ./src

# Filter by file pattern
deprecation-scanner -i "src/**/*.ts" -e "**/*.spec.ts"

# Filter by source package
deprecation-scanner -p lodash,moment

# Output as JSON
deprecation-scanner -f json

# Save report to file
deprecation-scanner -f markdown -o report.md

# Generate HTML report
deprecation-scanner -f html -o deprecations.html
```

## Programmatic API

### `scan(options?): Promise<ScanResult>`

Main scanning function.

```typescript
import { scan } from '@deprecation-lens/cli'

const result = await scan({
  rootDir: './my-project',
  include: 'src/**/*.ts',
  exclude: '**/*.spec.ts',
  fromPackages: ['lodash'],
  onProgress: (msg) => console.log(msg),
  onFile: (file) => console.log(`Found ${file.usages.length} in ${file.filePath}`),
})

console.log(`Found ${result.totalUsages} deprecations in ${result.scannedFiles} files`)
```

**ScanOptions:**

```typescript
interface ScanOptions {
  /** Project root directory (default: process.cwd()) */
  rootDir?: string,
  /** Path to tsconfig.json (default: auto-detect) */
  tsconfigPath?: string,
  /** Include file glob pattern */
  include?: string,
  /** Exclude file glob pattern */
  exclude?: string,
  /** Filter deprecations by source package names */
  fromPackages?: string[],
  /** Progress callback */
  onProgress?: (message: string) => void,
  /** Callback for each file with deprecations (streaming) */
  onFile?: (file: FileDeprecations) => void,
  /** AbortSignal for cancellation */
  signal?: AbortSignal,
}
```

**ScanResult:**

```typescript
interface ScanResult {
  /** Deprecations grouped by file */
  files: FileDeprecations[],
  /** Total deprecation count */
  totalUsages: number,
  /** Number of files scanned */
  scannedFiles: number,
}
```

### `formatResults(result, options): string`

Format scan results for output.

```typescript
import { formatResults, scan } from '@deprecation-lens/cli'

const result = await scan()

// Format as colored terminal output
console.log(formatResults(result, { format: 'log', colorize: true }))

// Format as JSON
const json = formatResults(result, { format: 'json' })

// Format as Markdown
const md = formatResults(result, { format: 'markdown' })

// Format as HTML
const html = formatResults(result, { format: 'html' })
```

**ReporterOptions:**

```typescript
interface ReporterOptions {
  /** Output format */
  format: 'log' | 'json' | 'markdown' | 'html',
  /** Enable colors (log format only) */
  colorize?: boolean,
  /** Root directory for relative paths */
  rootDir?: string,
}
```

## Types

All types are exported for TypeScript users:

```typescript
import type {
  DeprecatedUsage,
  FileDeprecations,
  OutputFormat,
  Position,
  Range,
  ReporterOptions,
  ScanOptions,
  ScanResult,
} from '@deprecation-lens/cli'
```

### Position

```typescript
interface Position {
  /** Line number (0-based) */
  line: number,
  /** Column number (0-based) */
  character: number,
}
```

### Range

```typescript
interface Range {
  start: Position,
  end: Position,
}
```

### DeprecatedUsage

```typescript
interface DeprecatedUsage {
  /** File path */
  filePath: string,
  /** Location range */
  range: Range,
  /** Diagnostic message */
  message: string,
  /** Source package name (if from node_modules) */
  sourcePackage?: string,
}
```

### FileDeprecations

```typescript
interface FileDeprecations {
  /** File path */
  filePath: string,
  /** Deprecation usages in this file */
  usages: DeprecatedUsage[],
}
```

## Output Formats

### Log (default)

Colored terminal output grouped by file:

```text
src/utils.ts
  12:5     'oldMethod' is deprecated.  [lodash]
  45:10    'legacyFn' is deprecated.   [moment]

Found 2 deprecations in 1 file.
```

### JSON

Structured JSON for programmatic processing:

```json
{
  "files": [
    {
      "filePath": "src/utils.ts",
      "usages": [
        {
          "range": { "start": { "line": 11, "character": 4 }, "end": { "line": 11, "character": 13 } },
          "message": "'oldMethod' is deprecated.",
          "sourcePackage": "lodash"
        }
      ]
    }
  ],
  "totalUsages": 2,
  "scannedFiles": 10
}
```

### Markdown

Table format for documentation:

```markdown
# Deprecation Report

## src/utils.ts

| Line | Message                    | Package |
| ---- | -------------------------- | ------- |
| 12:5 | 'oldMethod' is deprecated. | lodash  |

**Summary**: 2 deprecations in 1 file.
```

### HTML

Standalone HTML document with styling, suitable for sharing.

## How It Works

The scanner uses TypeScript Language Service's `getSuggestionDiagnostics()` API to detect deprecated usages (diagnostic codes 6385, 6386, 6387). This provides accurate detection based on TypeScript's type analysis.

When no `tsconfig.json` is found, the scanner uses sensible defaults:

- Scans all `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.mjs`, `.cts`, `.cjs` files
- Excludes `node_modules`, `dist`, `build` directories
- Uses ESNext target with bundler module resolution

## License

[MIT](./LICENSE.md)
