import * as ts from 'typescript'
import * as vscode from 'vscode'
import * as path from 'path'
import * as fs from 'fs'
import { minimatch } from 'minimatch'

import type { DeprecatedUsage, FileDeprecations } from './types'

/** Deprecated 相关的诊断码 */
const DEPRECATED_DIAGNOSTIC_CODES = new Set([
  6385, // '{0}' is deprecated.
  6386, // '{0}' is deprecated. Use '{1}' instead.
  6387, // The signature '{0}' is deprecated.
])

/** 扫描选项 */
interface ScanOptions {
  includePattern?: string,
  excludePattern?: string,
  onProgress?: (message: string) => void,
  onResult?: (file: FileDeprecations) => void,
  signal?: AbortSignal,
}

/**
 * 使用 TypeScript Language Service 扫描项目中的 deprecated 使用
 */
export async function scanWithLanguageService(
  workspaceFolder: vscode.WorkspaceFolder,
  options: ScanOptions = {},
): Promise<FileDeprecations[]> {
  const { includePattern, excludePattern, onProgress, onResult, signal } = options
  const rootPath = workspaceFolder.uri.fsPath
  console.info('[Deprecation Lens] Looking for tsconfig in:', rootPath)

  const configPath = ts.findConfigFile(rootPath, ts.sys.fileExists, 'tsconfig.json')

  if (!configPath) {
    console.info('[Deprecation Lens] No tsconfig.json found in', rootPath)
    return []
  }

  onProgress?.('Reading tsconfig.json...')

  // 读取 tsconfig.json
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  if (configFile.error) {
    console.error('[Deprecation Lens] Error reading tsconfig.json:', configFile.error)
    return []
  }

  const configDir = path.dirname(configPath)
  const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, configDir)

  if (parsedConfig.errors.length > 0) {
    console.error('[Deprecation Lens] Error parsing tsconfig.json:', parsedConfig.errors)
    return []
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
        if (!fs.existsSync(fileName)) {
          return undefined
        }
        content = fs.readFileSync(fileName, 'utf-8')
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
  if (includePattern || excludePattern) {
    filesToScan = parsedConfig.fileNames.filter(fileName => {
      const relativePath = path.relative(rootPath, fileName)

      if (includePattern && !minimatch(relativePath, includePattern, { matchBase: true })) {
        return false
      }

      if (excludePattern && minimatch(relativePath, excludePattern, { matchBase: true })) {
        return false
      }

      return true
    })
  }

  onProgress?.(`Initializing TypeScript (${filesToScan.length} files)...`)

  const fileMap = new Map<string, FileDeprecations>()
  const totalFiles = filesToScan.length

  // 辅助函数：让出控制权以便检测 abort 信号
  const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve))

  for (let i = 0; i < totalFiles; i++) {
    // 每 50 个文件让出一次控制权，检查是否需要中断
    if (i % 50 === 0) {
      await yieldToEventLoop()
      if (signal?.aborted) {
        console.info('[Deprecation Lens] Scan cancelled')
        languageService.dispose()
        return Array.from(fileMap.values())
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

      const uri = vscode.Uri.file(fileName)
      const usages: DeprecatedUsage[] = []

      for (const diag of deprecatedDiags) {
        if (diag.start === undefined || diag.length === undefined) {
          continue
        }

        const sourceFile = languageService.getProgram()?.getSourceFile(fileName)
        if (!sourceFile) continue

        const startPos = ts.getLineAndCharacterOfPosition(sourceFile, diag.start)
        const endPos = ts.getLineAndCharacterOfPosition(sourceFile, diag.start + diag.length)

        const range = new vscode.Range(
          new vscode.Position(startPos.line, startPos.character),
          new vscode.Position(endPos.line, endPos.character),
        )

        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n')

        usages.push({
          uri,
          range,
          message,
          severity: vscode.DiagnosticSeverity.Warning,
        })
      }

      if (usages.length > 0) {
        const fileResult: FileDeprecations = { uri, usages }
        fileMap.set(uri.toString(), fileResult)
        onResult?.(fileResult)
      }
    } catch (error) {
      console.error(`[Deprecation Lens] Error scanning ${fileName}:`, error)
    }
  }

  languageService.dispose()

  return Array.from(fileMap.values()).sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath))
}
