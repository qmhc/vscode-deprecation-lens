/**
 * @deprecation-lens/cli
 * CLI tool and programmatic API for scanning TypeScript deprecation usages
 */

// 主要 API
export { scan, extractPackageName } from './scanner'

// 格式化工具
export { formatResults } from './reporter'
export type { OutputFormat, ReporterOptions } from './reporter'

// 类型导出
export type {
  Position,
  Range,
  DeprecatedUsage,
  FileDeprecations,
  ScanOptions,
  ScanResult,
} from './types'

export const VERSION = '1.0.0'
