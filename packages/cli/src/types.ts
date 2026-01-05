/**
 * CLI 包类型定义
 * 纯 Node.js 类型，无 VSCode 依赖
 */

// ============================================================================
// 基础位置类型
// ============================================================================

/**
 * 位置（行列号，0-based）
 */
export interface Position {
  /** 行号（0-based） */
  line: number,
  /** 列号（0-based） */
  character: number,
}

/**
 * 范围（起止位置）
 */
export interface Range {
  /** 起始位置 */
  start: Position,
  /** 结束位置 */
  end: Position,
}

// ============================================================================
// 弃用用法类型
// ============================================================================

/**
 * 单个弃用用法记录
 */
export interface DeprecatedUsage {
  /** 文件路径 */
  filePath: string,
  /** 位置范围 */
  range: Range,
  /** 诊断消息 */
  message: string,
  /** 来源包名（如果来自 node_modules） */
  sourcePackage?: string,
}

/**
 * 按文件分组的弃用
 */
export interface FileDeprecations {
  /** 文件路径 */
  filePath: string,
  /** 该文件中的弃用用法列表 */
  usages: DeprecatedUsage[],
}

// ============================================================================
// 扫描选项与结果
// ============================================================================

/**
 * 扫描选项
 */
export interface ScanOptions {
  /** 项目根目录，默认 process.cwd() */
  rootDir?: string,
  /** tsconfig.json 路径，默认自动查找 */
  tsconfigPath?: string,
  /** 包含的文件 glob 模式 */
  include?: string,
  /** 排除的文件 glob 模式 */
  exclude?: string,
  /** 只查找来自指定包的弃用 */
  fromPackages?: string[],
  /** 进度回调 */
  onProgress?: (message: string) => void,
  /** 单文件结果回调（流式处理） */
  onFile?: (file: FileDeprecations) => void,
  /** 中断信号 */
  signal?: AbortSignal,
}

/**
 * 扫描结果
 */
export interface ScanResult {
  /** 按文件分组的弃用列表 */
  files: FileDeprecations[],
  /** 弃用总数 */
  totalUsages: number,
  /** 扫描的文件数 */
  scannedFiles: number,
}
