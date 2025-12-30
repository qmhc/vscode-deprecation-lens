import * as vscode from 'vscode'

import { hasDeprecatedTag } from './utils'
import { scanWithLanguageService } from './tsLanguageService'

import type { DeprecatedUsage, FileDeprecations } from './types'

/**
 * 扫描整个工作区的 deprecated 使用
 * 使用 TypeScript Language Service 进行完整分析
 */
export async function scanWorkspaceForDeprecations(
  onProgress?: (message: string) => void,
): Promise<FileDeprecations[]> {
  const fileMap = new Map<string, FileDeprecations>()
  const workspaceFolders = vscode.workspace.workspaceFolders

  if (!workspaceFolders || workspaceFolders.length === 0) {
    return []
  }

  // 对每个工作区文件夹执行扫描
  for (const folder of workspaceFolders) {
    onProgress?.(`Scanning ${folder.name}...`)

    try {
      const results = await scanWithLanguageService(folder, { onProgress })
      for (const file of results) {
        const key = file.uri.toString()
        if (fileMap.has(key)) {
          fileMap.get(key)!.usages.push(...file.usages)
        } else {
          fileMap.set(key, file)
        }
      }
    } catch (error) {
      console.error(`[Deprecation Lens] Failed to scan ${folder.name}:`, error)
    }
  }

  // 合并 VSCode 已有诊断
  onProgress?.('Merging VSCode diagnostics...')
  const vscodeResults = collectDeprecatedUsages()
  for (const file of vscodeResults) {
    const key = file.uri.toString()
    if (!fileMap.has(key)) {
      fileMap.set(key, file)
    } else {
      // 合并并去重
      const existing = fileMap.get(key)!
      const existingKeys = new Set(
        existing.usages.map(u => `${u.range.start.line}:${u.range.start.character}`),
      )
      for (const usage of file.usages) {
        const usageKey = `${usage.range.start.line}:${usage.range.start.character}`
        if (!existingKeys.has(usageKey)) {
          existing.usages.push(usage)
        }
      }
    }
  }

  return Array.from(fileMap.values()).sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath))
}

/**
 * 从当前已有诊断中收集 deprecated 使用
 */
export function collectDeprecatedUsages(): FileDeprecations[] {
  const allDiagnostics = vscode.languages.getDiagnostics()
  const fileMap = new Map<string, FileDeprecations>()

  for (const [uri, diagnostics] of allDiagnostics) {
    const deprecatedDiags = diagnostics.filter(diag =>
      hasDeprecatedTag(diag.tags, vscode.DiagnosticTag.Deprecated),
    )
    if (deprecatedDiags.length === 0) {
      continue
    }

    const usages: DeprecatedUsage[] = deprecatedDiags.map(diag => ({
      uri,
      range: diag.range,
      message: diag.message,
      severity: diag.severity,
    }))

    fileMap.set(uri.toString(), { uri, usages })
  }

  return Array.from(fileMap.values()).sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath))
}
