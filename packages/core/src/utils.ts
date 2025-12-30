/** 支持的 JS/TS 文件扩展名 */
export const JS_TS_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.mts',
  '.cjs',
  '.cts',
])

/**
 * 从文件路径提取扩展名
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filePath.slice(lastDot).toLowerCase()
}

/**
 * 判断文件路径是否为 JS/TS 文件
 */
export function isJsOrTsFile(filePath: string): boolean {
  return JS_TS_EXTENSIONS.has(getFileExtension(filePath))
}

/**
 * 判断诊断标签是否包含 Deprecated
 */
export function hasDeprecatedTag(
  tags: readonly number[] | undefined,
  deprecatedTagValue: number,
): boolean {
  return tags?.includes(deprecatedTagValue) ?? false
}
