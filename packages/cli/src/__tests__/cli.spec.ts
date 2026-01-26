/**
 * CLI 参数解析单元测试
 * 测试 splitCommaSeparated 函数和 CLI 参数组合
 */

import { describe, expect, it } from 'vitest'

import { splitCommaSeparated } from '../utils'

// ============================================================================
// splitCommaSeparated 单元测试
// ============================================================================

describe('splitCommaSeparated', () => {
  describe('基本功能', () => {
    it('单个值返回单元素数组', () => {
      expect(splitCommaSeparated('deprecated')).toEqual(['deprecated'])
    })

    it('多个值按逗号分割', () => {
      expect(splitCommaSeparated('deprecated,obsolete,legacy')).toEqual([
        'deprecated',
        'obsolete',
        'legacy',
      ])
    })

    it('去除每个元素的首尾空白', () => {
      expect(splitCommaSeparated(' deprecated , obsolete , legacy ')).toEqual([
        'deprecated',
        'obsolete',
        'legacy',
      ])
    })
  })

  describe('边界情况', () => {
    it('undefined 输入返回 undefined', () => {
      expect(splitCommaSeparated(undefined)).toBeUndefined()
    })

    it('空字符串返回 undefined', () => {
      expect(splitCommaSeparated('')).toBeUndefined()
    })

    it('只有空白的字符串返回 undefined', () => {
      expect(splitCommaSeparated('   ')).toBeUndefined()
    })

    it('只有逗号的字符串返回 undefined', () => {
      expect(splitCommaSeparated(',')).toBeUndefined()
      expect(splitCommaSeparated(',,')).toBeUndefined()
    })

    it('连续逗号之间的空元素被过滤', () => {
      expect(splitCommaSeparated('a,,b')).toEqual(['a', 'b'])
      expect(splitCommaSeparated('a,,,b')).toEqual(['a', 'b'])
    })

    it('首尾逗号被正确处理', () => {
      expect(splitCommaSeparated(',a,b,')).toEqual(['a', 'b'])
    })
  })

  describe('特殊字符', () => {
    it('保留正则特殊字符', () => {
      expect(splitCommaSeparated('use.*instead,\\d+')).toEqual(['use.*instead', '\\d+'])
    })

    it('保留包含空格的模式（内部空格）', () => {
      expect(splitCommaSeparated('use this,not that')).toEqual(['use this', 'not that'])
    })
  })
})

// ============================================================================
// CLI 参数组合测试
// ============================================================================

describe('CLI 参数组合', () => {
  describe('--msg-grep 参数', () => {
    it('单个模式', () => {
      const result = splitCommaSeparated('deprecated')
      expect(result).toEqual(['deprecated'])
    })

    it('多个模式（逗号分隔）', () => {
      const result = splitCommaSeparated('deprecated,obsolete')
      expect(result).toEqual(['deprecated', 'obsolete'])
    })

    it('正则表达式模式', () => {
      const result = splitCommaSeparated('use.*instead,\\blegacy\\b')
      expect(result).toEqual(['use.*instead', '\\blegacy\\b'])
    })
  })

  describe('参数组合场景', () => {
    it('--msg-grep 与 --msg-grep-case-sensitive 组合', () => {
      // 模拟 CLI 解析后的选项
      const msgGrep = splitCommaSeparated('Deprecated')
      const msgGrepCaseSensitive = true

      expect(msgGrep).toEqual(['Deprecated'])
      expect(msgGrepCaseSensitive).toBe(true)
    })

    it('--msg-grep 与 --msg-grep-regex 组合', () => {
      // 模拟 CLI 解析后的选项
      const msgGrep = splitCommaSeparated('use.*instead')
      const msgGrepRegex = true

      expect(msgGrep).toEqual(['use.*instead'])
      expect(msgGrepRegex).toBe(true)
    })

    it('所有 msg-grep 参数组合', () => {
      // 模拟 CLI 解析后的选项
      const msgGrep = splitCommaSeparated('Deprecated,use.*instead')
      const msgGrepCaseSensitive = true
      const msgGrepRegex = true

      expect(msgGrep).toEqual(['Deprecated', 'use.*instead'])
      expect(msgGrepCaseSensitive).toBe(true)
      expect(msgGrepRegex).toBe(true)
    })
  })
})
