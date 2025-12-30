import { describe, expect, it } from 'vitest'

import { JS_TS_EXTENSIONS, getFileExtension, hasDeprecatedTag, isJsOrTsFile } from './utils'

describe('getFileExtension', () => {
  it('应返回文件扩展名（小写）', () => {
    expect(getFileExtension('file.ts')).toBe('.ts')
    expect(getFileExtension('file.TSX')).toBe('.tsx')
    expect(getFileExtension('path/to/file.js')).toBe('.js')
  })

  it('应处理多个点的文件名', () => {
    expect(getFileExtension('file.test.ts')).toBe('.ts')
    expect(getFileExtension('file.spec.tsx')).toBe('.tsx')
  })

  it('无扩展名时返回空字符串', () => {
    expect(getFileExtension('file')).toBe('')
    expect(getFileExtension('path/to/file')).toBe('')
  })
})

describe('isJsOrTsFile', () => {
  it('应识别所有支持的 JS/TS 扩展名', () => {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts', '.cjs', '.cts']
    for (const ext of extensions) {
      expect(isJsOrTsFile(`file${ext}`)).toBe(true)
    }
  })

  it('应拒绝非 JS/TS 文件', () => {
    expect(isJsOrTsFile('file.json')).toBe(false)
    expect(isJsOrTsFile('file.css')).toBe(false)
    expect(isJsOrTsFile('file.vue')).toBe(false)
    expect(isJsOrTsFile('file')).toBe(false)
  })

  it('应忽略大小写', () => {
    expect(isJsOrTsFile('file.TS')).toBe(true)
    expect(isJsOrTsFile('file.JSX')).toBe(true)
  })
})

describe('hasDeprecatedTag', () => {
  const DEPRECATED_TAG = 1

  it('tags 包含 deprecated 时返回 true', () => {
    expect(hasDeprecatedTag([DEPRECATED_TAG], DEPRECATED_TAG)).toBe(true)
    expect(hasDeprecatedTag([0, DEPRECATED_TAG, 2], DEPRECATED_TAG)).toBe(true)
  })

  it('tags 不包含 deprecated 时返回 false', () => {
    expect(hasDeprecatedTag([0, 2, 3], DEPRECATED_TAG)).toBe(false)
    expect(hasDeprecatedTag([], DEPRECATED_TAG)).toBe(false)
  })

  it('tags 为 undefined 时返回 false', () => {
    expect(hasDeprecatedTag(undefined, DEPRECATED_TAG)).toBe(false)
  })
})

describe('JS_TS_EXTENSIONS', () => {
  it('应包含所有预期的扩展名', () => {
    const expected = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.mts', '.cjs', '.cts']
    expect(JS_TS_EXTENSIONS.size).toBe(expected.length)
    for (const ext of expected) {
      expect(JS_TS_EXTENSIONS.has(ext)).toBe(true)
    }
  })
})
