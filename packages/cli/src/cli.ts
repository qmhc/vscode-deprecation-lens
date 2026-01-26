/**
 * CLI 命令行入口
 * 使用 cac 实现命令行解析
 */

import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

import cac from 'cac'
import pc from 'picocolors'

import { scan } from './scanner'
import { type OutputFormat, formatResults } from './reporter'
import { VERSION } from './index'
import { splitCommaSeparated } from './utils'

// ============================================================================
// 类型定义
// ============================================================================

interface CliOptions {
  include?: string,
  exclude?: string,
  fromPackage?: string,
  format?: string,
  output?: string,
  msgGrep?: string,
  msgGrepCaseSensitive?: boolean,
  msgGrepRegex?: boolean,
}

// ============================================================================
// 进度显示
// ============================================================================

/**
 * 创建进度回调函数
 * 在终端显示扫描进度
 */
function createProgressCallback(): (message: string) => void {
  // 使用 stderr 输出进度信息，避免污染 stdout 的结果输出
  return (message: string) => {
    // 清除当前行并输出新消息
    process.stderr.write(`\r${pc.dim(message)}${' '.repeat(20)}\r`)
  }
}

/**
 * 清除进度行
 */
function clearProgress(): void {
  process.stderr.write('\r' + ' '.repeat(80) + '\r')
}

// ============================================================================
// 主命令处理
// ============================================================================

/**
 * 执行扫描命令
 */
async function runScan(path: string | undefined, options: CliOptions): Promise<void> {
  const rootDir = path ? resolve(path) : process.cwd()
  const format = (options.format || 'log') as OutputFormat

  // 验证格式选项
  const validFormats: OutputFormat[] = ['log', 'json', 'markdown', 'html']
  if (!validFormats.includes(format)) {
    console.error(
      pc.red(
        `Error: Invalid format "${options.format}". Valid formats: ${validFormats.join(', ')}`,
      ),
    )
    process.exit(1)
  }

  // 解析 fromPackage 选项（逗号分隔）
  const fromPackages = splitCommaSeparated(options.fromPackage)

  // 解析 msgGrep 选项（逗号分隔）
  const msgGrep = splitCommaSeparated(options.msgGrep)

  // 创建进度回调
  const onProgress = createProgressCallback()

  try {
    // 执行扫描
    const result = await scan({
      rootDir,
      include: options.include,
      exclude: options.exclude,
      fromPackages,
      msgGrep,
      msgGrepCaseSensitive: options.msgGrepCaseSensitive,
      msgGrepIsRegex: options.msgGrepRegex,
      onProgress,
    })

    // 清除进度显示
    clearProgress()

    // 格式化结果
    const output = formatResults(result, {
      format,
      colorize: !options.output && process.stdout.isTTY,
      rootDir,
    })

    // 输出结果
    if (options.output) {
      // 写入文件
      const outputPath = resolve(options.output)
      writeFileSync(outputPath, output, 'utf-8')
      console.info(pc.green(`✓ Results written to ${outputPath}`))
    } else {
      // 输出到 stdout
      process.stdout.write(output + '\n')
    }

    // 成功退出
    process.exit(0)
  } catch (error) {
    // 清除进度显示
    clearProgress()

    // 错误处理
    const message = error instanceof Error ? error.message : String(error)
    console.error(pc.red(`Error: ${message}`))
    process.exit(1)
  }
}

// ============================================================================
// CLI 定义
// ============================================================================

const cli = cac('deprecation-scanner')

cli
  .command('[path]', 'Scan for deprecated usages in TypeScript/JavaScript files')
  .option('-i, --include <pattern>', 'Include file pattern (glob)')
  .option('-e, --exclude <pattern>', 'Exclude file pattern (glob)')
  .option('-p, --from-package <packages>', 'Filter by source packages (comma-separated)')
  .option('-m, --msg-grep <patterns>', 'Filter by message content (comma-separated)')
  .option('--msg-grep-case-sensitive', 'Enable case-sensitive message matching')
  .option('--msg-grep-regex', 'Treat message patterns as regular expressions')
  .option('-f, --format <format>', 'Output format: log, json, markdown, html', { default: 'log' })
  .option('-o, --output <file>', 'Write results to file instead of stdout')
  .example('  $ deprecation-scanner')
  .example('  $ deprecation-scanner ./src')
  .example('  $ deprecation-scanner -i "src/**/*.ts" -e "**/*.spec.ts"')
  .example('  $ deprecation-scanner -p lodash,moment -f json')
  .example('  $ deprecation-scanner -f markdown -o report.md')
  .example('  $ deprecation-scanner -m "deprecated,obsolete"')
  .example('  $ deprecation-scanner -m "use.*instead" --msg-grep-regex')
  .action(runScan)

cli.help()
cli.version(VERSION)

// ============================================================================
// 执行 CLI
// ============================================================================

cli.parse()
