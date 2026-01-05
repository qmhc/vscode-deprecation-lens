/**
 * 格式化输出模块
 * 支持多种输出格式：log, json, markdown, html
 */

import pc from 'picocolors'

import type { DeprecatedUsage, ScanResult } from './types'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 输出格式类型
 */
export type OutputFormat = 'log' | 'json' | 'markdown' | 'html'

/**
 * 格式化选项
 */
export interface ReporterOptions {
  /** 输出格式 */
  format: OutputFormat,
  /** 是否启用颜色（仅对 log 格式有效） */
  colorize?: boolean,
  /** 根目录（用于显示相对路径） */
  rootDir?: string,
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 格式化位置为 "行:列" 格式（1-based 显示）
 */
function formatPosition(usage: DeprecatedUsage): string {
  return `${usage.range.start.line + 1}:${usage.range.start.character + 1}`
}

/**
 * 获取相对路径
 */
function getRelativePath(filePath: string, rootDir?: string): string {
  if (!rootDir) return filePath
  if (filePath.startsWith(rootDir)) {
    const relative = filePath.slice(rootDir.length)
    return relative.startsWith('/') ? relative.slice(1) : relative
  }
  return filePath
}

/**
 * 转义 HTML 特殊字符
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ============================================================================
// Log 格式输出
// ============================================================================

/**
 * 格式化为 log 格式（带颜色的终端输出）
 */
function formatAsLog(result: ScanResult, options: ReporterOptions): string {
  const { colorize = true, rootDir } = options
  const lines: string[] = []

  if (result.files.length === 0) {
    const msg = 'No deprecations found.'
    lines.push(colorize ? pc.green(msg) : msg)
    return lines.join('\n')
  }

  for (const file of result.files) {
    const relativePath = getRelativePath(file.filePath, rootDir)
    // 文件名用下划线样式
    lines.push(colorize ? pc.underline(relativePath) : relativePath)

    for (const usage of file.usages) {
      const pos = formatPosition(usage)
      const pkg = usage.sourcePackage ? `[${usage.sourcePackage}]` : ''

      if (colorize) {
        const posStr = pc.dim(pos.padEnd(8))
        const msgStr = pc.yellow(usage.message)
        const pkgStr = pkg ? pc.cyan(pkg) : ''
        lines.push(`  ${posStr} ${msgStr}  ${pkgStr}`)
      } else {
        lines.push(`  ${pos.padEnd(8)} ${usage.message}  ${pkg}`)
      }
    }

    lines.push('') // 文件之间空行
  }

  // 摘要
  const fileCount = result.files.length
  const fileWord = fileCount === 1 ? 'file' : 'files'
  const summary = `Found ${result.totalUsages} deprecation${result.totalUsages === 1 ? '' : 's'} in ${fileCount} ${fileWord}.`
  lines.push(colorize ? pc.bold(summary) : summary)

  return lines.join('\n')
}

// ============================================================================
// JSON 格式输出
// ============================================================================

/**
 * 格式化为 JSON 格式
 */
function formatAsJson(result: ScanResult, options: ReporterOptions): string {
  const { rootDir } = options

  // 转换文件路径为相对路径
  const output = {
    files: result.files.map(file => ({
      filePath: getRelativePath(file.filePath, rootDir),
      usages: file.usages.map(usage => ({
        range: usage.range,
        message: usage.message,
        ...(usage.sourcePackage && { sourcePackage: usage.sourcePackage }),
      })),
    })),
    totalUsages: result.totalUsages,
    scannedFiles: result.scannedFiles,
  }

  return JSON.stringify(output, null, 2)
}

// ============================================================================
// Markdown 格式输出
// ============================================================================

/**
 * 格式化为 Markdown 格式
 */
function formatAsMarkdown(result: ScanResult, options: ReporterOptions): string {
  const { rootDir } = options
  const lines: string[] = []

  lines.push('# Deprecation Report')
  lines.push('')

  if (result.files.length === 0) {
    lines.push('No deprecations found.')
    return lines.join('\n')
  }

  for (const file of result.files) {
    const relativePath = getRelativePath(file.filePath, rootDir)
    lines.push(`## ${relativePath}`)
    lines.push('')
    lines.push('| Line | Message | Package |')
    lines.push('|------|---------|---------|')

    for (const usage of file.usages) {
      const pos = formatPosition(usage)
      const pkg = usage.sourcePackage || '-'
      // 转义 Markdown 表格中的特殊字符
      const msg = usage.message.replace(/\|/g, '\\|')
      lines.push(`| ${pos} | ${msg} | ${pkg} |`)
    }

    lines.push('')
  }

  // 摘要
  const fileCount = result.files.length
  const fileWord = fileCount === 1 ? 'file' : 'files'
  lines.push(
    `**Summary**: ${result.totalUsages} deprecation${result.totalUsages === 1 ? '' : 's'} in ${fileCount} ${fileWord}.`,
  )

  return lines.join('\n')
}

// ============================================================================
// HTML 格式输出
// ============================================================================

/**
 * 格式化为 HTML 格式
 */
function formatAsHtml(result: ScanResult, options: ReporterOptions): string {
  const { rootDir } = options

  const styles = `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    .file {
      background: white;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .file h2 {
      margin: 0 0 12px 0;
      font-size: 1.1em;
      color: #2980b9;
      word-break: break-all;
    }
    .file ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .file li {
      padding: 8px 0;
      border-bottom: 1px solid #eee;
    }
    .file li:last-child {
      border-bottom: none;
    }
    code {
      background: #ecf0f1;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
    }
    .package {
      color: #27ae60;
      font-size: 0.9em;
    }
    .summary {
      background: #2c3e50;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .no-deprecations {
      text-align: center;
      color: #27ae60;
      font-size: 1.2em;
      padding: 40px;
    }
  `.trim()

  const lines: string[] = []
  lines.push('<!DOCTYPE html>')
  lines.push('<html lang="en">')
  lines.push('<head>')
  lines.push('  <meta charset="UTF-8">')
  lines.push('  <meta name="viewport" content="width=device-width, initial-scale=1.0">')
  lines.push('  <title>Deprecation Report</title>')
  lines.push(`  <style>${styles}</style>`)
  lines.push('</head>')
  lines.push('<body>')
  lines.push('  <h1>Deprecation Report</h1>')

  if (result.files.length === 0) {
    lines.push('  <p class="no-deprecations">✓ No deprecations found.</p>')
  } else {
    for (const file of result.files) {
      const relativePath = getRelativePath(file.filePath, rootDir)
      lines.push('  <section class="file">')
      lines.push(`    <h2>${escapeHtml(relativePath)}</h2>`)
      lines.push('    <ul>')

      for (const usage of file.usages) {
        const pos = formatPosition(usage)
        const pkg = usage.sourcePackage
          ? ` <span class="package">[${escapeHtml(usage.sourcePackage)}]</span>`
          : ''
        lines.push(`      <li><code>${pos}</code> ${escapeHtml(usage.message)}${pkg}</li>`)
      }

      lines.push('    </ul>')
      lines.push('  </section>')
    }

    // 摘要
    const fileCount = result.files.length
    const fileWord = fileCount === 1 ? 'file' : 'files'
    const summary = `Found ${result.totalUsages} deprecation${result.totalUsages === 1 ? '' : 's'} in ${fileCount} ${fileWord}.`
    lines.push(`  <div class="summary">${summary}</div>`)
  }

  lines.push('</body>')
  lines.push('</html>')

  return lines.join('\n')
}

// ============================================================================
// 主导出函数
// ============================================================================

/**
 * 格式化扫描结果
 *
 * @param result - 扫描结果
 * @param options - 格式化选项
 * @returns 格式化后的字符串
 */
export function formatResults(result: ScanResult, options: ReporterOptions): string {
  switch (options.format) {
    case 'log':
      return formatAsLog(result, options)
    case 'json':
      return formatAsJson(result, options)
    case 'markdown':
      return formatAsMarkdown(result, options)
    case 'html':
      return formatAsHtml(result, options)
    default:
      throw new Error(`Unknown format: ${options.format}`)
  }
}
