/**
 * 核心扫描引擎
 * 从 packages/core/src/tsLanguageService.ts 重构而来
 * 纯 Node.js 实现，无 VSCode 依赖
 */

import { dirname, relative, resolve } from 'node:path'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

import ts from 'typescript'
import { minimatch } from 'minimatch'

import type { DeprecatedUsage, FileDeprecations, ScanOptions, ScanResult } from './types'

// ============================================================================
// 常量定义
// ============================================================================

/** Deprecated 相关的诊断码 */
const DEPRECATED_DIAGNOSTIC_CODES = new Set([
  6385, // '{0}' is deprecated.
  6386, // '{0}' is deprecated. Use '{1}' instead.
  6387, // The signature '{0}' is deprecated.
])

/** 默认编译选项（当 tsconfig.json 不存在时使用） */
const DEFAULT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowJs: true,
  checkJs: true,
  strict: true,
  skipLibCheck: true,
  esModuleInterop: true,
}

/** 默认扫描的文件模式 */
const DEFAULT_FILE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.mts',
  '**/*.cts',
  '**/*.js',
  '**/*.jsx',
  '**/*.mjs',
  '**/*.cjs',
]

/** 默认排除的目录 */
const DEFAULT_EXCLUDE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 从定义路径中提取包名
 * 支持 node_modules/<package> 和 node_modules/@scope/package 格式
 */
export function extractPackageName(definitionPath: string): string | undefined {
  // 匹配 node_modules/<package> 或 node_modules/@scope/package
  const match = definitionPath.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)
  return match?.[1]
}

/**
 * 根据包名过滤弃用用法
 * 只保留 sourcePackage 在 fromPackages 列表中的用法
 *
 * @param usages - 弃用用法列表
 * @param fromPackages - 要过滤的包名列表
 * @returns 过滤后的弃用用法列表
 */
export function filterUsagesByPackages(
  usages: DeprecatedUsage[],
  fromPackages: string[],
): DeprecatedUsage[] {
  if (!fromPackages || fromPackages.length === 0) {
    return usages
  }
  return usages.filter(usage => usage.sourcePackage && fromPackages.includes(usage.sourcePackage))
}

/**
 * 递归获取目录下所有文件
 */
function getAllFiles(dir: string, patterns: string[], excludePatterns: string[]): string[] {
  const files: string[] = []

  function walk(currentDir: string) {
    if (!existsSync(currentDir)) return

    const entries = readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = resolve(currentDir, entry.name)
      const relativePath = relative(dir, fullPath)

      // 检查是否应该排除
      const shouldExclude = excludePatterns.some(pattern =>
        minimatch(relativePath, pattern, { matchBase: true }),
      )
      if (shouldExclude) continue

      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile()) {
        // 检查是否匹配文件模式
        const matches = patterns.some(pattern =>
          minimatch(relativePath, pattern, { matchBase: true }),
        )
        if (matches) {
          files.push(fullPath)
        }
      }
    }
  }

  walk(dir)
  return files
}

/**
 * 让出控制权以便检测 abort 信号
 */
const yieldToEventLoop = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

/**
 * 规范化 glob 模式
 * 如果输入是目录路径（不含 glob 字符），自动追加 /** 使其匹配目录下所有文件
 *
 * @param pattern - 用户输入的模式
 * @returns 规范化后的 glob 模式
 */
function normalizeGlobPattern(pattern: string): string {
  // 移除尾部斜杠
  let normalized = pattern.replace(/\/+$/, '')

  // 检查是否包含 glob 特殊字符
  const hasGlobChars = /[*?[\]{}!]/.test(normalized)

  // 如果不含 glob 字符，视为目录路径，追加 /**
  if (!hasGlobChars) {
    normalized = `${normalized}/**`
  }

  return normalized
}

// ============================================================================
// 主扫描函数
// ============================================================================

/**
 * 执行弃用扫描
 *
 * @param options - 扫描选项
 * @returns 扫描结果
 */
export async function scan(options: ScanOptions = {}): Promise<ScanResult> {
  const {
    rootDir = process.cwd(),
    tsconfigPath,
    include,
    exclude,
    fromPackages,
    onProgress,
    onFile,
    signal,
  } = options

  const absoluteRootDir = resolve(rootDir)

  onProgress?.('Looking for tsconfig.json...')

  // 查找或使用指定的 tsconfig.json
  let configPath: string | undefined
  if (tsconfigPath) {
    configPath = resolve(absoluteRootDir, tsconfigPath)
    if (!existsSync(configPath)) {
      configPath = undefined
    }
  } else {
    // 只在 rootDir 中查找 tsconfig.json，不向上查找父目录
    const possibleConfigPath = resolve(absoluteRootDir, 'tsconfig.json')
    if (existsSync(possibleConfigPath)) {
      configPath = possibleConfigPath
    }
  }

  let parsedConfig: ts.ParsedCommandLine
  let configDir: string

  if (configPath) {
    onProgress?.('Reading tsconfig.json...')

    // 读取 tsconfig.json
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
    if (configFile.error) {
      throw new Error(
        `Error reading tsconfig.json: ${ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n')}`,
      )
    }

    configDir = dirname(configPath)
    parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, configDir)

    if (parsedConfig.errors.length > 0) {
      const errorMessages = parsedConfig.errors
        .map(e => ts.flattenDiagnosticMessageText(e.messageText, '\n'))
        .join('\n')
      throw new Error(`Error parsing tsconfig.json: ${errorMessages}`)
    }
  } else {
    // 使用默认配置
    onProgress?.('No tsconfig.json found, using default configuration...')
    configDir = absoluteRootDir

    // 获取所有 TS/JS 文件
    const fileNames = getAllFiles(absoluteRootDir, DEFAULT_FILE_PATTERNS, DEFAULT_EXCLUDE_PATTERNS)

    parsedConfig = {
      options: DEFAULT_COMPILER_OPTIONS,
      fileNames,
      errors: [],
    }
  }

  onProgress?.('Creating language service...')

  // 创建 Language Service Host
  const files = new Map<string, { version: number, content: string }>()

  const serviceHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => parsedConfig.fileNames,
    getScriptVersion: fileName => {
      const file = files.get(fileName)
      return file ? file.version.toString() : '0'
    },
    getScriptSnapshot: fileName => {
      let content: string
      const cached = files.get(fileName)

      if (cached) {
        content = cached.content
      } else {
        if (!existsSync(fileName)) {
          return undefined
        }
        content = readFileSync(fileName, 'utf-8')
        files.set(fileName, { version: 0, content })
      }

      return ts.ScriptSnapshot.fromString(content)
    },
    getCurrentDirectory: () => configDir,
    getCompilationSettings: () => parsedConfig.options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
  }

  const languageService = ts.createLanguageService(serviceHost, ts.createDocumentRegistry())

  // 根据 include/exclude 模式过滤文件
  let filesToScan = parsedConfig.fileNames
  if (include || exclude) {
    // 规范化 glob 模式（目录路径自动追加 /**）
    const normalizedInclude = include ? normalizeGlobPattern(include) : undefined
    const normalizedExclude = exclude ? normalizeGlobPattern(exclude) : undefined

    filesToScan = parsedConfig.fileNames.filter(fileName => {
      const relativePath = relative(absoluteRootDir, fileName)

      if (normalizedInclude && !minimatch(relativePath, normalizedInclude, { matchBase: true })) {
        return false
      }

      if (normalizedExclude && minimatch(relativePath, normalizedExclude, { matchBase: true })) {
        return false
      }

      return true
    })
  }

  onProgress?.(`Initializing TypeScript (${filesToScan.length} files)...`)

  const fileResults: FileDeprecations[] = []
  const totalFiles = filesToScan.length
  let totalUsages = 0

  for (let i = 0; i < totalFiles; i++) {
    // 每 50 个文件让出一次控制权，检查是否需要中断
    if (i % 50 === 0) {
      await yieldToEventLoop()
      if (signal?.aborted) {
        onProgress?.('Scan cancelled')
        languageService.dispose()
        return {
          files: fileResults,
          totalUsages,
          scannedFiles: i,
        }
      }
    }

    const fileName = filesToScan[i]

    if (i % 100 === 0) {
      onProgress?.(`Scanning files... (${i + 1}/${totalFiles})`)
    }

    try {
      // deprecated 诊断在 suggestion diagnostics 中
      const diagnostics = languageService.getSuggestionDiagnostics(fileName)

      const deprecatedDiags = diagnostics.filter(
        d => d.code && DEPRECATED_DIAGNOSTIC_CODES.has(d.code),
      )

      if (deprecatedDiags.length === 0) {
        continue
      }

      const usages: DeprecatedUsage[] = []

      for (const diag of deprecatedDiags) {
        if (diag.start === undefined || diag.length === undefined) {
          continue
        }

        const sourceFile = languageService.getProgram()?.getSourceFile(fileName)
        if (!sourceFile) continue

        const startPos = ts.getLineAndCharacterOfPosition(sourceFile, diag.start)
        const endPos = ts.getLineAndCharacterOfPosition(sourceFile, diag.start + diag.length)

        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n')

        // 获取符号定义位置以提取包名
        let sourcePackage: string | undefined
        const definitions = languageService.getDefinitionAtPosition(fileName, diag.start)
        if (definitions && definitions.length > 0) {
          const defPath = definitions[0].fileName
          sourcePackage = extractPackageName(defPath)
        }

        // 如果指定了 fromPackages 过滤，检查是否匹配
        if (fromPackages && fromPackages.length > 0) {
          if (!sourcePackage || !fromPackages.includes(sourcePackage)) {
            continue
          }
        }

        usages.push({
          filePath: fileName,
          range: {
            start: { line: startPos.line, character: startPos.character },
            end: { line: endPos.line, character: endPos.character },
          },
          message,
          sourcePackage,
        })
      }

      if (usages.length > 0) {
        const fileResult: FileDeprecations = {
          filePath: fileName,
          usages,
        }
        fileResults.push(fileResult)
        totalUsages += usages.length
        onFile?.(fileResult)
      }
    } catch (error) {
      // 跳过该文件，记录警告，继续扫描
      onProgress?.(`Warning: Error scanning ${fileName}: ${error}`)
    }
  }

  languageService.dispose()

  // 按文件路径排序
  fileResults.sort((a, b) => a.filePath.localeCompare(b.filePath))

  return {
    files: fileResults,
    totalUsages,
    scannedFiles: totalFiles,
  }
}
