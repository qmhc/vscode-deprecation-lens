/**
 * TypeScript Language Service 扫描模块
 * 调用 @deprecation-lens/cli 包的 scan() 函数，并转换为 VSCode 类型
 */

import * as vscode from 'vscode'

import {
  type FileDeprecations as CliFileDeprecations,
  type ScanOptions as CliScanOptions,
  scan,
} from '@deprecation-lens/cli'

import type { DeprecatedUsage, FileDeprecations } from './types'

/** 扫描选项 */
interface ScanOptions {
  includePattern?: string,
  excludePattern?: string,
  msgGrep?: string[],
  msgGrepCaseSensitive?: boolean,
  msgGrepIsRegex?: boolean,
  fromPackages?: string[],
  onProgress?: (message: string) => void,
  onResult?: (file: FileDeprecations) => void,
  signal?: AbortSignal,
}

/**
 * 将 CLI 包的 FileDeprecations 转换为 VSCode 类型
 */
function convertToVscodeTypes(cliFile: CliFileDeprecations): FileDeprecations {
  const uri = vscode.Uri.file(cliFile.filePath)

  const usages: DeprecatedUsage[] = cliFile.usages.map(usage => ({
    uri,
    range: new vscode.Range(
      new vscode.Position(usage.range.start.line, usage.range.start.character),
      new vscode.Position(usage.range.end.line, usage.range.end.character),
    ),
    message: usage.message,
    severity: vscode.DiagnosticSeverity.Warning,
  }))

  return { uri, usages }
}

/**
 * 使用 TypeScript Language Service 扫描项目中的 deprecated 使用
 * 委托给 @deprecation-lens/cli 包的 scan() 函数
 */
export async function scanWithLanguageService(
  workspaceFolder: vscode.WorkspaceFolder,
  options: ScanOptions = {},
): Promise<FileDeprecations[]> {
  const {
    includePattern,
    excludePattern,
    msgGrep,
    msgGrepCaseSensitive,
    msgGrepIsRegex,
    fromPackages,
    onProgress,
    onResult,
    signal,
  } = options
  const rootPath = workspaceFolder.uri.fsPath

  console.info('[Deprecation Lens] Scanning workspace:', rootPath)

  // 构建 CLI 包的扫描选项
  const cliOptions: CliScanOptions = {
    rootDir: rootPath,
    include: includePattern,
    exclude: excludePattern,
    msgGrep,
    msgGrepCaseSensitive,
    msgGrepIsRegex,
    fromPackages,
    onProgress,
    signal,
  }

  // 如果有 onResult 回调，设置 onFile 回调进行类型转换
  if (onResult) {
    cliOptions.onFile = cliFile => {
      const vscodeFile = convertToVscodeTypes(cliFile)
      onResult(vscodeFile)
    }
  }

  try {
    // 调用 CLI 包的 scan 函数
    const result = await scan(cliOptions)

    // 转换所有结果为 VSCode 类型
    const vscodeResults = result.files.map(convertToVscodeTypes)

    console.info(
      `[Deprecation Lens] Found ${result.totalUsages} deprecations in ${result.files.length} files`,
    )

    return vscodeResults
  } catch (error) {
    console.error('[Deprecation Lens] Scan error:', error)
    // 返回空结果而不是抛出错误，保持与原有行为一致
    return []
  }
}
