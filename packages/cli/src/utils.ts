/**
 * CLI 工具函数
 */

/**
 * 按逗号分割字符串并去除首尾空白
 * 用于解析 CLI 参数中的逗号分隔值
 *
 * @param input - 逗号分隔的输入字符串
 * @returns 分割后的字符串数组（去除空白和空字符串）
 */
export function splitCommaSeparated(input: string | undefined): string[] | undefined {
  if (!input) {
    return undefined
  }
  const result = input
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
  return result.length > 0 ? result : undefined
}
