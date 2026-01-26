/**
 * 消息搜索功能属性测试
 * 使用 fast-check 进行属性测试
 */

import { describe, expect, it } from 'vitest'

import * as fc from 'fast-check'

import { filterUsagesByMessage } from '../scanner'
import { splitCommaSeparated } from '../utils'

import type { DeprecatedUsage } from '../types'

// ============================================================================
// 测试辅助函数和生成器
// ============================================================================

/**
 * 生成 Position
 */
const positionArb = fc.record({
  line: fc.nat({ max: 1000 }),
  character: fc.nat({ max: 200 }),
})

/**
 * 生成 Range（确保 end >= start）
 */
const rangeArb = fc.tuple(positionArb, positionArb).map(([start, end]) => ({
  start,
  end: { line: Math.max(start.line, end.line), character: end.character },
}))

/**
 * 生成简单的文件路径
 */
const filePathArb = fc.stringMatching(/^\/src\/[a-z][a-z0-9]{0,15}\.(ts|js)$/)

/**
 * 生成弃用消息（包含可搜索的标识符）
 */
const messageArb = fc.stringMatching(/^'[a-zA-Z][a-zA-Z0-9]{0,20}' is deprecated\.?$/)

/**
 * 生成 DeprecatedUsage
 */
const deprecatedUsageArb = (message?: string): fc.Arbitrary<DeprecatedUsage> =>
  fc.record({
    filePath: filePathArb,
    range: rangeArb,
    message: message ? fc.constant(message) : messageArb,
    sourcePackage: fc.option(fc.stringMatching(/^[a-z][a-z0-9._-]{0,29}$/), { nil: undefined }),
  })

/**
 * 生成搜索模式（普通字符串）
 */
const patternArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,10}$/)

// ============================================================================
// Property 1: 消息过滤正确性
// ============================================================================

/**
 * Feature: message-filter, Property 1: 消息过滤正确性
 * **Validates: Requirements 1.1**
 *
 * *For any* 弃用用法列表和非空搜索模式列表，过滤后的每个结果的消息都应包含至少一个搜索模式
 */
describe('Property 1: 消息过滤正确性', () => {
  it('过滤后的每个结果的消息都应包含至少一个搜索模式（大小写不敏感）', () => {
    fc.assert(
      fc.property(
        fc.array(deprecatedUsageArb(), { minLength: 1, maxLength: 20 }),
        fc.array(patternArb, { minLength: 1, maxLength: 5 }),
        (usages, patterns) => {
          const filtered = filterUsagesByMessage(usages, patterns, false, false)

          // 验证：每个过滤后的结果都包含至少一个模式（大小写不敏感）
          return filtered.every(usage =>
            patterns.some(pattern =>
              usage.message.toLowerCase().includes(pattern.toLowerCase()),
            ),
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('过滤后的每个结果的消息都应包含至少一个搜索模式（大小写敏感）', () => {
    fc.assert(
      fc.property(
        fc.array(deprecatedUsageArb(), { minLength: 1, maxLength: 20 }),
        fc.array(patternArb, { minLength: 1, maxLength: 5 }),
        (usages, patterns) => {
          const filtered = filterUsagesByMessage(usages, patterns, true, false)

          // 验证：每个过滤后的结果都包含至少一个模式（大小写敏感）
          return filtered.every(usage =>
            patterns.some(pattern => usage.message.includes(pattern)),
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('空模式数组返回所有结果', () => {
    fc.assert(
      fc.property(
        fc.array(deprecatedUsageArb(), { minLength: 0, maxLength: 10 }),
        usages => {
          const filtered = filterUsagesByMessage(usages, [], false, false)
          return filtered.length === usages.length
        },
      ),
      { numRuns: 100 },
    )
  })

  it('包含匹配模式的消息应被保留', () => {
    fc.assert(
      fc.property(patternArb, pattern => {
        // 创建一个包含该模式的消息
        const message = `'${pattern}Method' is deprecated.`
        const usage: DeprecatedUsage = {
          filePath: '/src/test.ts',
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
          message,
        }

        const filtered = filterUsagesByMessage([usage], [pattern], false, false)
        return filtered.length === 1
      }),
      { numRuns: 100 },
    )
  })
})


// ============================================================================
// Property 2: 大小写敏感性控制
// ============================================================================

/**
 * Feature: message-filter, Property 2: 大小写敏感性控制
 * **Validates: Requirements 1.3, 1.4**
 *
 * *For any* 消息和搜索模式对，当 caseSensitive 为 false 时，消息的任意大小写变体都应匹配模式的任意大小写变体；
 * 当 caseSensitive 为 true 时，只有精确的大小写匹配才应通过。
 */
describe('Property 2: 大小写敏感性控制', () => {
  it('caseSensitive=false 时，大小写变体应匹配', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{3,10}$/),
        fc.constantFrom('lower', 'upper', 'mixed'),
        (basePattern, caseType) => {
          // 根据 caseType 转换模式
          let pattern: string
          switch (caseType) {
            case 'lower':
              pattern = basePattern.toLowerCase()
              break
            case 'upper':
              pattern = basePattern.toUpperCase()
              break
            default:
              pattern = basePattern
          }

          // 创建包含原始模式的消息
          const message = `'${basePattern}' is deprecated.`
          const usage: DeprecatedUsage = {
            filePath: '/src/test.ts',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message,
          }

          // caseSensitive=false 时应该匹配
          const filtered = filterUsagesByMessage([usage], [pattern], false, false)
          return filtered.length === 1
        },
      ),
      { numRuns: 100 },
    )
  })

  it('caseSensitive=true 时，只有精确大小写匹配才通过', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,10}$/), // 只生成小写
        pattern => {
          // 创建包含小写模式的消息
          const message = `'${pattern}' is deprecated.`
          const usage: DeprecatedUsage = {
            filePath: '/src/test.ts',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message,
          }

          // 使用大写模式搜索，caseSensitive=true 时不应匹配
          const upperPattern = pattern.toUpperCase()
          const filtered = filterUsagesByMessage([usage], [upperPattern], true, false)

          // 如果模式全是小写，大写版本不应匹配
          return filtered.length === 0
        },
      ),
      { numRuns: 100 },
    )
  })

  it('caseSensitive=true 时，精确匹配应通过', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z]{3,10}$/),
        pattern => {
          const message = `'${pattern}' is deprecated.`
          const usage: DeprecatedUsage = {
            filePath: '/src/test.ts',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message,
          }

          // 使用相同模式搜索，应该匹配
          const filtered = filterUsagesByMessage([usage], [pattern], true, false)
          return filtered.length === 1
        },
      ),
      { numRuns: 100 },
    )
  })
})


// ============================================================================
// Property 3: 正则表达式模式控制
// ============================================================================

/**
 * Feature: message-filter, Property 3: 正则表达式模式控制
 * **Validates: Requirements 1.5, 1.6**
 *
 * *For any* 消息和包含正则特殊字符的模式，当 isRegex 为 false 时，模式应被当作字面量字符串匹配；
 * 当 isRegex 为 true 时，模式应被当作正则表达式匹配。
 */
describe('Property 3: 正则表达式模式控制', () => {
  it('isRegex=false 时，正则特殊字符被当作字面量', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('.', '*', '+', '?', '[', ']', '(', ')', '{', '}', '^', '$', '|', '\\'),
        specialChar => {
          // 创建包含特殊字符的消息
          const message = `'method${specialChar}name' is deprecated.`
          const usage: DeprecatedUsage = {
            filePath: '/src/test.ts',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message,
          }

          // 使用包含特殊字符的模式搜索（作为字面量）
          const pattern = `method${specialChar}name`
          const filtered = filterUsagesByMessage([usage], [pattern], false, false)

          // 应该匹配（字面量匹配）
          return filtered.length === 1
        },
      ),
      { numRuns: 100 },
    )
  })

  it('isRegex=true 时，正则表达式应正确匹配', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{3,8}$/),
        word => {
          // 创建消息
          const message = `'${word}Method' is deprecated.`
          const usage: DeprecatedUsage = {
            filePath: '/src/test.ts',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message,
          }

          // 使用正则表达式模式
          const pattern = `${word}.*deprecated`
          const filtered = filterUsagesByMessage([usage], [pattern], false, true)

          // 应该匹配
          return filtered.length === 1
        },
      ),
      { numRuns: 100 },
    )
  })

  it('isRegex=false 时，点号不应匹配任意字符', () => {
    // 创建消息
    const message = `'methodXname' is deprecated.`
    const usage: DeprecatedUsage = {
      filePath: '/src/test.ts',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      message,
    }

    // 使用点号模式（作为字面量）
    const pattern = 'method.name'
    const filtered = filterUsagesByMessage([usage], [pattern], false, false)

    // 不应匹配（因为消息中是 X 不是 .）
    expect(filtered.length).toBe(0)
  })

  it('isRegex=true 时，点号应匹配任意字符', () => {
    // 创建消息
    const message = `'methodXname' is deprecated.`
    const usage: DeprecatedUsage = {
      filePath: '/src/test.ts',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      message,
    }

    // 使用点号模式（作为正则）
    const pattern = 'method.name'
    const filtered = filterUsagesByMessage([usage], [pattern], false, true)

    // 应该匹配（. 匹配 X）
    expect(filtered.length).toBe(1)
  })
})


// ============================================================================
// Property 5: 无效正则错误处理
// ============================================================================

/**
 * Feature: message-filter, Property 5: 无效正则错误处理
 * **Validates: Requirements 4.4**
 *
 * *For any* 语法无效的正则表达式模式，当 isRegex 为 true 时，过滤函数应抛出包含模式信息的描述性错误。
 */
describe('Property 5: 无效正则错误处理', () => {
  it('无效正则表达式应抛出描述性错误', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('[', '(', '{', '*', '+', '?', '\\'),
        invalidPattern => {
          const usage: DeprecatedUsage = {
            filePath: '/src/test.ts',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message: `'method' is deprecated.`,
          }

          try {
            filterUsagesByMessage([usage], [invalidPattern], false, true)
            // 如果没有抛出错误，检查是否是有效的正则（某些单字符可能是有效的）
            try {
              new RegExp(invalidPattern)
              return true // 是有效正则，测试通过
            } catch {
              return false // 应该抛出错误但没有
            }
          } catch (error) {
            // 验证错误消息包含模式信息
            const errorMessage = error instanceof Error ? error.message : String(error)
            return (
              errorMessage.includes('Invalid regular expression') &&
              errorMessage.includes(invalidPattern)
            )
          }
        },
      ),
      { numRuns: 100 },
    )
  })

  it('特定无效正则 "[" 应抛出错误', () => {
    const usage: DeprecatedUsage = {
      filePath: '/src/test.ts',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      message: `'method' is deprecated.`,
    }

    expect(() => {
      filterUsagesByMessage([usage], ['['], false, true)
    }).toThrow(/Invalid regular expression.*\[/)
  })

  it('特定无效正则 "(" 应抛出错误', () => {
    const usage: DeprecatedUsage = {
      filePath: '/src/test.ts',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
      message: `'method' is deprecated.`,
    }

    expect(() => {
      filterUsagesByMessage([usage], ['('], false, true)
    }).toThrow(/Invalid regular expression.*\(/)
  })

  it('isRegex=false 时，无效正则模式不应抛出错误', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('[', '(', '{', '*', '+', '?', '\\'),
        invalidPattern => {
          const usage: DeprecatedUsage = {
            filePath: '/src/test.ts',
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
            message: `'method' is deprecated.`,
          }

          // isRegex=false 时不应抛出错误
          try {
            filterUsagesByMessage([usage], [invalidPattern], false, false)
            return true
          } catch {
            return false
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})


// ============================================================================
// Property 4: 模式分割正确性
// ============================================================================

/**
 * Feature: message-filter, Property 4: 模式分割正确性
 * **Validates: Requirements 2.1**
 *
 * *For any* 包含逗号的输入字符串，按逗号分割后的数组长度应等于逗号数量加一，
 * 且每个元素应是原字符串中对应位置的子串（去除首尾空白）。
 */
describe('Property 4: 模式分割正确性', () => {
  it('分割后的数组长度应等于逗号数量加一（非空元素）', () => {
    fc.assert(
      fc.property(
        // 生成不含逗号的非空字符串数组
        fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,10}$/), { minLength: 1, maxLength: 5 }),
        parts => {
          const input = parts.join(',')
          const result = splitCommaSeparated(input)

          // 结果应该等于原始部分（因为生成的字符串不含空白）
          return result !== undefined && result.length === parts.length
        },
      ),
      { numRuns: 100 },
    )
  })

  it('每个元素应去除首尾空白', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-zA-Z0-9_-]{1,10}$/), { minLength: 1, maxLength: 5 }),
        fc.array(fc.stringMatching(/^[ ]{0,3}$/), { minLength: 1, maxLength: 5 }),
        (parts, spaces) => {
          // 在每个部分前后添加空白
          const partsWithSpaces = parts.map((p, i) => {
            const space = spaces[i % spaces.length] || ''
            return `${space}${p}${space}`
          })
          const input = partsWithSpaces.join(',')
          const result = splitCommaSeparated(input)

          // 结果应该等于去除空白后的原始部分
          return (
            result !== undefined &&
            result.length === parts.length &&
            result.every((r, i) => r === parts[i])
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('空字符串应返回 undefined', () => {
    const result = splitCommaSeparated('')
    expect(result).toBeUndefined()
  })

  it('undefined 输入应返回 undefined', () => {
    const result = splitCommaSeparated(undefined)
    expect(result).toBeUndefined()
  })

  it('只有空白和逗号的字符串应返回 undefined', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[, ]{1,10}$/),
        input => {
          const result = splitCommaSeparated(input)
          return result === undefined
        },
      ),
      { numRuns: 100 },
    )
  })

  it('单个值（无逗号）应返回单元素数组', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9_-]{1,10}$/),
        value => {
          const result = splitCommaSeparated(value)
          return result !== undefined && result.length === 1 && result[0] === value
        },
      ),
      { numRuns: 100 },
    )
  })

  it('连续逗号之间的空元素应被过滤', () => {
    // 测试 "a,,b" 应该返回 ["a", "b"]
    const result = splitCommaSeparated('a,,b')
    expect(result).toEqual(['a', 'b'])
  })
})
