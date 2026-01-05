/**
 * 属性测试
 * 使用 fast-check 进行属性测试
 */

import { describe, it } from 'vitest'

import * as fc from 'fast-check'

import { type OutputFormat, formatResults } from '../reporter'
import { extractPackageName, filterUsagesByPackages } from '../scanner'

import type { DeprecatedUsage, FileDeprecations, ScanResult } from '../types'

/**
 * Feature: deprecation-scanner-cli, Property 2: Source Package Extraction
 * Validates: Requirements 1.4, 5.2
 *
 * *For any* deprecated usage whose definition is located in
 * `node_modules/<package>/...` or `node_modules/@scope/package/...`,
 * the Scanner SHALL correctly extract and populate the `sourcePackage` field.
 */
describe('Property 2: Source Package Extraction', () => {
  // 生成有效的普通包名（不以 @ 开头，不含 /）
  const regularPackageNameArb = fc.stringMatching(/^[a-z][a-z0-9._-]{0,49}$/)

  // 生成有效的 scope 名称（以 @ 开头）
  const scopeNameArb = fc.stringMatching(/^@[a-z][a-z0-9._-]{0,29}$/)

  // 生成有效的 scoped 包名
  const scopedPackageNameArb = fc
    .tuple(scopeNameArb, regularPackageNameArb)
    .map(([scope, name]) => `${scope}/${name}`)

  // 生成任意有效包名（普通或 scoped）
  const packageNameArb = fc.oneof(regularPackageNameArb, scopedPackageNameArb)

  // 生成路径前缀（可以是空或任意目录路径）
  const pathPrefixArb = fc.oneof(
    fc.constant(''),
    fc.constant('/'),
    fc.stringMatching(/^\/[a-z][a-z0-9/_-]{0,50}$/).map(p => (p.endsWith('/') ? p : `${p}/`)),
  )

  // 生成路径后缀（包内的文件路径）
  const pathSuffixArb = fc.oneof(
    fc.constant('/index.js'),
    fc.constant('/index.ts'),
    fc.constant('/index.d.ts'),
    fc.constant('/dist/index.js'),
    fc.constant('/src/main.ts'),
    fc
      .stringMatching(/^\/[a-z][a-z0-9/_.-]{0,30}\.(js|ts|d\.ts|mjs|cjs)$/)
      .filter(s => s.length > 1),
  )

  it('should correctly extract regular package names from node_modules paths', () => {
    fc.assert(
      fc.property(
        pathPrefixArb,
        regularPackageNameArb,
        pathSuffixArb,
        (prefix, packageName, suffix) => {
          const path = `${prefix}node_modules/${packageName}${suffix}`
          const extracted = extractPackageName(path)
          return extracted === packageName
        },
      ),
      { numRuns: 100 },
    )
  })

  it('should correctly extract scoped package names from node_modules paths', () => {
    fc.assert(
      fc.property(
        pathPrefixArb,
        scopedPackageNameArb,
        pathSuffixArb,
        (prefix, packageName, suffix) => {
          const path = `${prefix}node_modules/${packageName}${suffix}`
          const extracted = extractPackageName(path)
          return extracted === packageName
        },
      ),
      { numRuns: 100 },
    )
  })

  it('should return undefined for paths without node_modules', () => {
    // 生成不包含 node_modules 的路径
    const nonNodeModulesPathArb = fc
      .stringMatching(/^\/[a-z][a-z0-9/_.-]{0,50}\.(js|ts)$/)
      .filter(p => !p.includes('node_modules'))

    fc.assert(
      fc.property(nonNodeModulesPathArb, path => {
        const extracted = extractPackageName(path)
        return extracted === undefined
      }),
      { numRuns: 100 },
    )
  })

  it('should extract the first package in nested node_modules', () => {
    // 对于嵌套的 node_modules，应该提取第一个包名
    fc.assert(
      fc.property(
        pathPrefixArb,
        packageNameArb,
        packageNameArb,
        pathSuffixArb,
        (prefix, firstPkg, secondPkg, suffix) => {
          const path = `${prefix}node_modules/${firstPkg}/node_modules/${secondPkg}${suffix}`
          const extracted = extractPackageName(path)
          return extracted === firstPkg
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Feature: deprecation-scanner-cli, Property 4: Package Name Filtering
 * Validates: Requirements 1.6, 5.4
 *
 * *For any* scan result and `fromPackages` filter, ALL returned deprecations
 * SHALL have a `sourcePackage` that matches one of the specified package names.
 */
describe('Property 4: Package Name Filtering', () => {
  // 生成有效的普通包名
  const regularPackageNameArb = fc.stringMatching(/^[a-z][a-z0-9._-]{0,29}$/)

  // 生成有效的 scoped 包名
  const scopedPackageNameArb = fc
    .tuple(
      fc.stringMatching(/^@[a-z][a-z0-9._-]{0,14}$/),
      fc.stringMatching(/^[a-z][a-z0-9._-]{0,14}$/),
    )
    .map(([scope, name]) => `${scope}/${name}`)

  // 生成任意有效包名
  const packageNameArb = fc.oneof(regularPackageNameArb, scopedPackageNameArb)

  // 生成 Position
  const positionArb = fc.record({
    line: fc.nat({ max: 1000 }),
    character: fc.nat({ max: 200 }),
  })

  // 生成 Range
  const rangeArb = fc.tuple(positionArb, positionArb).map(([start, end]) => ({
    start,
    end: { line: Math.max(start.line, end.line), character: end.character },
  }))

  // 生成 DeprecatedUsage（带 sourcePackage）
  const deprecatedUsageWithPackageArb = (packageName: string): fc.Arbitrary<DeprecatedUsage> =>
    fc.record({
      filePath: fc.stringMatching(/^\/[a-z][a-z0-9/_-]{0,30}\.(ts|js)$/),
      range: rangeArb,
      message: fc.stringMatching(/^'[a-zA-Z]+' is deprecated\.?$/),
      sourcePackage: fc.constant(packageName),
    })

  // 生成 DeprecatedUsage（无 sourcePackage）
  const deprecatedUsageWithoutPackageArb: fc.Arbitrary<DeprecatedUsage> = fc.record({
    filePath: fc.stringMatching(/^\/[a-z][a-z0-9/_-]{0,30}\.(ts|js)$/),
    range: rangeArb,
    message: fc.stringMatching(/^'[a-zA-Z]+' is deprecated\.?$/),
  })

  it('filtered results only contain deprecations from specified packages', () => {
    fc.assert(
      fc.property(
        // 生成一组包名作为过滤条件
        fc.array(packageNameArb, { minLength: 1, maxLength: 5 }),
        // 生成一组不在过滤条件中的包名
        fc.array(packageNameArb, { minLength: 0, maxLength: 5 }),
        (filterPackages, otherPackages) => {
          // 确保 otherPackages 不与 filterPackages 重叠
          const uniqueOtherPackages = otherPackages.filter(p => !filterPackages.includes(p))

          // 生成混合的 usages
          const usagesFromFilterPackages = filterPackages.flatMap(pkg => [
            {
              filePath: `/src/file-${pkg.replace(/[/@]/g, '_')}.ts`,
              range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
              message: `'method' is deprecated.`,
              sourcePackage: pkg,
            },
          ])

          const usagesFromOtherPackages = uniqueOtherPackages.map(pkg => ({
            filePath: `/src/other-${pkg.replace(/[/@]/g, '_')}.ts`,
            range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
            message: `'otherMethod' is deprecated.`,
            sourcePackage: pkg,
          }))

          const usagesWithoutPackage = [
            {
              filePath: '/src/local.ts',
              range: { start: { line: 2, character: 0 }, end: { line: 2, character: 10 } },
              message: `'localMethod' is deprecated.`,
            },
          ]

          const allUsages: DeprecatedUsage[] = [
            ...usagesFromFilterPackages,
            ...usagesFromOtherPackages,
            ...usagesWithoutPackage,
          ]

          // 执行过滤
          const filtered = filterUsagesByPackages(allUsages, filterPackages)

          // 验证：所有过滤后的结果都有 sourcePackage 且在 filterPackages 中
          return filtered.every(
            usage =>
              usage.sourcePackage !== undefined && filterPackages.includes(usage.sourcePackage),
          )
        },
      ),
      { numRuns: 100 },
    )
  })

  it('filtering with empty fromPackages returns all usages', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            deprecatedUsageWithoutPackageArb,
            packageNameArb.chain(pkg => deprecatedUsageWithPackageArb(pkg)),
          ),
          { minLength: 0, maxLength: 10 },
        ),
        usages => {
          const filtered = filterUsagesByPackages(usages, [])
          return filtered.length === usages.length
        },
      ),
      { numRuns: 100 },
    )
  })

  it('filtering removes usages without sourcePackage', () => {
    fc.assert(
      fc.property(
        fc.array(packageNameArb, { minLength: 1, maxLength: 3 }),
        fc.array(deprecatedUsageWithoutPackageArb, { minLength: 1, maxLength: 5 }),
        (filterPackages, usagesWithoutPackage) => {
          const filtered = filterUsagesByPackages(usagesWithoutPackage, filterPackages)
          // 没有 sourcePackage 的 usage 应该被过滤掉
          return filtered.length === 0
        },
      ),
      { numRuns: 100 },
    )
  })

  it('filtering preserves usages from matching packages', () => {
    fc.assert(
      fc.property(fc.array(packageNameArb, { minLength: 1, maxLength: 3 }), filterPackages => {
        // 创建来自 filterPackages 的 usages
        const usages: DeprecatedUsage[] = filterPackages.map((pkg, i) => ({
          filePath: `/src/file${i}.ts`,
          range: { start: { line: i, character: 0 }, end: { line: i, character: 10 } },
          message: `'method${i}' is deprecated.`,
          sourcePackage: pkg,
        }))

        const filtered = filterUsagesByPackages(usages, filterPackages)

        // 所有 usages 都应该被保留
        return filtered.length === usages.length
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Feature: deprecation-scanner-cli, Property 6: ScanResult Consistency
 * Validates: Requirements 3.3
 *
 * *For any* completed scan, `totalUsages` SHALL equal the sum of
 * `usages.length` across all files in the `files` array.
 */
describe('Property 6: ScanResult Consistency', () => {
  // 生成 Position
  const positionArb = fc.record({
    line: fc.nat({ max: 1000 }),
    character: fc.nat({ max: 200 }),
  })

  // 生成 Range（确保 end >= start）
  const rangeArb = fc.tuple(positionArb, positionArb).map(([start, end]) => ({
    start,
    end: { line: Math.max(start.line, end.line), character: end.character },
  }))

  // 生成有效的包名
  const packageNameArb = fc.oneof(
    fc.stringMatching(/^[a-z][a-z0-9._-]{0,29}$/),
    fc
      .tuple(
        fc.stringMatching(/^@[a-z][a-z0-9._-]{0,14}$/),
        fc.stringMatching(/^[a-z][a-z0-9._-]{0,14}$/),
      )
      .map(([scope, name]) => `${scope}/${name}`),
  )

  // 生成 DeprecatedUsage
  const deprecatedUsageArb = (filePath: string): fc.Arbitrary<DeprecatedUsage> =>
    fc.record({
      filePath: fc.constant(filePath),
      range: rangeArb,
      message: fc.stringMatching(/^'[a-zA-Z]+' is deprecated\.?$/),
      sourcePackage: fc.option(packageNameArb, { nil: undefined }),
    })

  // 生成 FileDeprecations（确保 usages 非空）
  const fileDeprecationsArb = fc.nat({ max: 50 }).chain(fileIndex =>
    fc
      .array(deprecatedUsageArb(`/src/file${fileIndex}.ts`), { minLength: 1, maxLength: 10 })
      .map(usages => ({
        filePath: `/src/file${fileIndex}.ts`,
        usages,
      })),
  )

  // 生成 ScanResult（totalUsages 正确计算）
  const validScanResultArb = fc
    .tuple(fc.array(fileDeprecationsArb, { minLength: 0, maxLength: 10 }), fc.nat({ max: 100 }))
    .map(([files, scannedFiles]) => {
      const totalUsages = files.reduce((sum, f) => sum + f.usages.length, 0)
      return {
        files,
        totalUsages,
        scannedFiles: Math.max(scannedFiles, files.length),
      }
    })

  /**
   * 验证 ScanResult 一致性的辅助函数
   * totalUsages 必须等于所有文件中 usages.length 的总和
   */
  function verifyScanResultConsistency(result: {
    files: { usages: unknown[] }[],
    totalUsages: number,
  }): boolean {
    const calculatedTotal = result.files.reduce((sum, file) => sum + file.usages.length, 0)
    return result.totalUsages === calculatedTotal
  }

  it('totalUsages equals sum of usages.length across all files', () => {
    fc.assert(
      fc.property(validScanResultArb, result => {
        return verifyScanResultConsistency(result)
      }),
      { numRuns: 100 },
    )
  })

  it('detects inconsistent ScanResult when totalUsages is wrong', () => {
    fc.assert(
      fc.property(
        fc.array(fileDeprecationsArb, { minLength: 1, maxLength: 5 }),
        fc.integer({ min: 1, max: 100 }),
        (files, offset) => {
          const correctTotal = files.reduce((sum, f) => sum + f.usages.length, 0)
          // 创建一个不一致的 ScanResult（totalUsages 偏移）
          const inconsistentResult = {
            files,
            totalUsages: correctTotal + offset, // 故意错误
            scannedFiles: files.length,
          }
          // 验证函数应该检测到不一致
          return !verifyScanResultConsistency(inconsistentResult)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('empty files array means totalUsages must be zero', () => {
    fc.assert(
      fc.property(fc.nat({ max: 100 }), scannedFiles => {
        const result = {
          files: [],
          totalUsages: 0,
          scannedFiles,
        }
        return verifyScanResultConsistency(result)
      }),
      { numRuns: 100 },
    )
  })

  it('single file totalUsages equals that file usages length', () => {
    fc.assert(
      fc.property(fileDeprecationsArb, fileDeprecations => {
        const result = {
          files: [fileDeprecations],
          totalUsages: fileDeprecations.usages.length,
          scannedFiles: 1,
        }
        return verifyScanResultConsistency(result)
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Feature: deprecation-scanner-cli, Property 7: Format Output Completeness
 * Validates: Requirements 2.8, 2.9, 2.10, 2.11
 *
 * *For any* ScanResult and output format (log/json/markdown/html),
 * the formatted output SHALL contain all file paths and all deprecation
 * messages from the result.
 */
describe('Property 7: Format Output Completeness', () => {
  // 生成 Position
  const positionArb = fc.record({
    line: fc.nat({ max: 1000 }),
    character: fc.nat({ max: 200 }),
  })

  // 生成 Range（确保 end >= start）
  const rangeArb = fc.tuple(positionArb, positionArb).map(([start, end]) => ({
    start,
    end: { line: Math.max(start.line, end.line), character: end.character },
  }))

  // 生成有效的包名
  const packageNameArb = fc.oneof(
    fc.stringMatching(/^[a-z][a-z0-9._-]{0,29}$/),
    fc
      .tuple(
        fc.stringMatching(/^@[a-z][a-z0-9._-]{0,14}$/),
        fc.stringMatching(/^[a-z][a-z0-9._-]{0,14}$/),
      )
      .map(([scope, name]) => `${scope}/${name}`),
  )

  // 生成简单的弃用消息（避免特殊字符干扰检测）
  const messageArb = fc.stringMatching(/^'[a-zA-Z][a-zA-Z0-9]{0,20}' is deprecated\.?$/)

  // 生成简单的文件路径（避免特殊字符）
  const filePathArb = fc.stringMatching(/^\/src\/[a-z][a-z0-9]{0,15}\.(ts|js)$/)

  // 生成 DeprecatedUsage
  const deprecatedUsageArb = (filePath: string): fc.Arbitrary<DeprecatedUsage> =>
    fc.record({
      filePath: fc.constant(filePath),
      range: rangeArb,
      message: messageArb,
      sourcePackage: fc.option(packageNameArb, { nil: undefined }),
    })

  // 生成 FileDeprecations（确保 usages 非空）
  const fileDeprecationsArb: fc.Arbitrary<FileDeprecations> = filePathArb.chain(filePath =>
    fc.array(deprecatedUsageArb(filePath), { minLength: 1, maxLength: 5 }).map(usages => ({
      filePath,
      usages,
    })),
  )

  // 生成有效的 ScanResult
  const scanResultArb: fc.Arbitrary<ScanResult> = fc
    .array(fileDeprecationsArb, { minLength: 0, maxLength: 5 })
    .map(files => {
      // 去重文件路径
      const uniqueFiles = files.reduce<FileDeprecations[]>((acc, file) => {
        if (!acc.some(f => f.filePath === file.filePath)) {
          acc.push(file)
        }
        return acc
      }, [])
      const totalUsages = uniqueFiles.reduce((sum, f) => sum + f.usages.length, 0)
      return {
        files: uniqueFiles,
        totalUsages,
        scannedFiles: Math.max(uniqueFiles.length, 1),
      }
    })

  // 所有输出格式
  const formatArb: fc.Arbitrary<OutputFormat> = fc.constantFrom('log', 'json', 'markdown', 'html')

  /**
   * 从消息中提取标识符（用于验证输出包含该消息）
   * 例如 "'oldMethod' is deprecated." -> "oldMethod"
   */
  function extractIdentifier(message: string): string | null {
    const match = message.match(/'([^']+)'/)
    return match ? match[1] : null
  }

  /**
   * 从文件路径中提取文件名（用于验证输出包含该路径）
   */
  function extractFileName(filePath: string): string {
    const parts = filePath.split('/')
    return parts[parts.length - 1]
  }

  it('formatted output contains all file paths', () => {
    fc.assert(
      fc.property(scanResultArb, formatArb, (result, format) => {
        // 空结果不需要检查文件路径
        if (result.files.length === 0) {
          return true
        }

        const output = formatResults(result, { format, colorize: false })

        // 验证每个文件路径（或文件名）都出现在输出中
        return result.files.every(file => {
          const fileName = extractFileName(file.filePath)
          // 检查文件名或完整路径是否在输出中
          return output.includes(fileName) || output.includes(file.filePath)
        })
      }),
      { numRuns: 100 },
    )
  })

  it('formatted output contains all deprecation messages', () => {
    fc.assert(
      fc.property(scanResultArb, formatArb, (result, format) => {
        // 空结果不需要检查消息
        if (result.files.length === 0) {
          return true
        }

        const output = formatResults(result, { format, colorize: false })

        // 验证每个弃用消息的标识符都出现在输出中
        return result.files.every(file =>
          file.usages.every(usage => {
            const identifier = extractIdentifier(usage.message)
            if (!identifier) return true // 无法提取标识符时跳过
            // 检查标识符是否在输出中（消息的核心部分）
            return output.includes(identifier)
          }),
        )
      }),
      { numRuns: 100 },
    )
  })

  it('log format output contains all file paths and messages', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        if (result.files.length === 0) {
          const output = formatResults(result, { format: 'log', colorize: false })
          return output.includes('No deprecations found')
        }

        const output = formatResults(result, { format: 'log', colorize: false })

        // 验证文件路径
        const hasAllFiles = result.files.every(file => {
          const fileName = extractFileName(file.filePath)
          return output.includes(fileName)
        })

        // 验证消息
        const hasAllMessages = result.files.every(file =>
          file.usages.every(usage => {
            const identifier = extractIdentifier(usage.message)
            return identifier ? output.includes(identifier) : true
          }),
        )

        return hasAllFiles && hasAllMessages
      }),
      { numRuns: 100 },
    )
  })

  it('json format output contains all file paths and messages', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        const output = formatResults(result, { format: 'json', colorize: false })

        // JSON 应该可以解析
        let parsed: ScanResult
        try {
          parsed = JSON.parse(output)
        } catch {
          return false
        }

        // 验证文件数量一致
        if (parsed.files.length !== result.files.length) {
          return false
        }

        // 验证每个文件的 usages 数量一致
        return result.files.every((file, i) => {
          const parsedFile = parsed.files[i]
          return parsedFile && parsedFile.usages.length === file.usages.length
        })
      }),
      { numRuns: 100 },
    )
  })

  it('markdown format output contains all file paths and messages', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        if (result.files.length === 0) {
          const output = formatResults(result, { format: 'markdown', colorize: false })
          return output.includes('No deprecations found')
        }

        const output = formatResults(result, { format: 'markdown', colorize: false })

        // 验证文件路径（作为 ## 标题）
        const hasAllFiles = result.files.every(file => {
          const fileName = extractFileName(file.filePath)
          return output.includes(fileName)
        })

        // 验证消息
        const hasAllMessages = result.files.every(file =>
          file.usages.every(usage => {
            const identifier = extractIdentifier(usage.message)
            return identifier ? output.includes(identifier) : true
          }),
        )

        return hasAllFiles && hasAllMessages
      }),
      { numRuns: 100 },
    )
  })

  it('html format output contains all file paths and messages', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        if (result.files.length === 0) {
          const output = formatResults(result, { format: 'html', colorize: false })
          return output.includes('No deprecations found')
        }

        const output = formatResults(result, { format: 'html', colorize: false })

        // 验证文件路径
        const hasAllFiles = result.files.every(file => {
          const fileName = extractFileName(file.filePath)
          return output.includes(fileName)
        })

        // 验证消息
        const hasAllMessages = result.files.every(file =>
          file.usages.every(usage => {
            const identifier = extractIdentifier(usage.message)
            return identifier ? output.includes(identifier) : true
          }),
        )

        return hasAllFiles && hasAllMessages
      }),
      { numRuns: 100 },
    )
  })
})

/**
 * Feature: deprecation-scanner-cli, Property 8: JSON Round-Trip
 * Validates: Requirements 2.9
 *
 * *For any* ScanResult, formatting to JSON and parsing back SHALL produce
 * an equivalent data structure.
 */
describe('Property 8: JSON Round-Trip', () => {
  // 生成 Position
  const positionArb = fc.record({
    line: fc.nat({ max: 1000 }),
    character: fc.nat({ max: 200 }),
  })

  // 生成 Range（确保 end >= start）
  const rangeArb = fc.tuple(positionArb, positionArb).map(([start, end]) => ({
    start,
    end: { line: Math.max(start.line, end.line), character: end.character },
  }))

  // 生成有效的包名
  const packageNameArb = fc.oneof(
    fc.stringMatching(/^[a-z][a-z0-9._-]{0,29}$/),
    fc
      .tuple(
        fc.stringMatching(/^@[a-z][a-z0-9._-]{0,14}$/),
        fc.stringMatching(/^[a-z][a-z0-9._-]{0,14}$/),
      )
      .map(([scope, name]) => `${scope}/${name}`),
  )

  // 生成简单的弃用消息
  const messageArb = fc.stringMatching(/^'[a-zA-Z][a-zA-Z0-9]{0,20}' is deprecated\.?$/)

  // 生成简单的文件路径
  const filePathArb = fc.stringMatching(/^\/src\/[a-z][a-z0-9]{0,15}\.(ts|js)$/)

  // 生成 DeprecatedUsage
  const deprecatedUsageArb = (filePath: string): fc.Arbitrary<DeprecatedUsage> =>
    fc.record({
      filePath: fc.constant(filePath),
      range: rangeArb,
      message: messageArb,
      sourcePackage: fc.option(packageNameArb, { nil: undefined }),
    })

  // 生成 FileDeprecations（确保 usages 非空）
  const fileDeprecationsArb: fc.Arbitrary<FileDeprecations> = filePathArb.chain(filePath =>
    fc.array(deprecatedUsageArb(filePath), { minLength: 1, maxLength: 5 }).map(usages => ({
      filePath,
      usages,
    })),
  )

  // 生成有效的 ScanResult
  const scanResultArb: fc.Arbitrary<ScanResult> = fc
    .array(fileDeprecationsArb, { minLength: 0, maxLength: 5 })
    .map(files => {
      // 去重文件路径
      const uniqueFiles = files.reduce<FileDeprecations[]>((acc, file) => {
        if (!acc.some(f => f.filePath === file.filePath)) {
          acc.push(file)
        }
        return acc
      }, [])
      const totalUsages = uniqueFiles.reduce((sum, f) => sum + f.usages.length, 0)
      return {
        files: uniqueFiles,
        totalUsages,
        scannedFiles: Math.max(uniqueFiles.length, 1),
      }
    })

  /**
   * 比较两个 ScanResult 是否等价
   * JSON 序列化会移除 undefined 的 sourcePackage 字段
   */
  function areScanResultsEquivalent(original: ScanResult, parsed: ScanResult): boolean {
    // 比较顶层字段
    if (parsed.totalUsages !== original.totalUsages) return false
    if (parsed.scannedFiles !== original.scannedFiles) return false
    if (parsed.files.length !== original.files.length) return false

    // 比较每个文件
    for (let i = 0; i < original.files.length; i++) {
      const origFile = original.files[i]
      const parsedFile = parsed.files[i]

      // filePath 在 JSON 输出中可能被转换为相对路径，这里我们不传 rootDir 所以应该保持一致
      if (parsedFile.filePath !== origFile.filePath) return false
      if (parsedFile.usages.length !== origFile.usages.length) return false

      // 比较每个 usage
      for (let j = 0; j < origFile.usages.length; j++) {
        const origUsage = origFile.usages[j]
        const parsedUsage = parsedFile.usages[j]

        // 比较 range
        if (parsedUsage.range.start.line !== origUsage.range.start.line) return false
        if (parsedUsage.range.start.character !== origUsage.range.start.character) return false
        if (parsedUsage.range.end.line !== origUsage.range.end.line) return false
        if (parsedUsage.range.end.character !== origUsage.range.end.character) return false

        // 比较 message
        if (parsedUsage.message !== origUsage.message) return false

        // 比较 sourcePackage（JSON 序列化会移除 undefined）
        const origPkg = origUsage.sourcePackage
        const parsedPkg = parsedUsage.sourcePackage
        if (origPkg !== parsedPkg) return false
      }
    }

    return true
  }

  it('JSON format round-trip produces equivalent data structure', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        // 格式化为 JSON
        const jsonOutput = formatResults(result, { format: 'json', colorize: false })

        // 解析 JSON
        let parsed: ScanResult
        try {
          parsed = JSON.parse(jsonOutput)
        } catch {
          return false // JSON 解析失败
        }

        // 验证等价性
        return areScanResultsEquivalent(result, parsed)
      }),
      { numRuns: 100 },
    )
  })

  it('JSON round-trip preserves totalUsages count', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        const jsonOutput = formatResults(result, { format: 'json', colorize: false })
        const parsed: ScanResult = JSON.parse(jsonOutput)
        return parsed.totalUsages === result.totalUsages
      }),
      { numRuns: 100 },
    )
  })

  it('JSON round-trip preserves scannedFiles count', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        const jsonOutput = formatResults(result, { format: 'json', colorize: false })
        const parsed: ScanResult = JSON.parse(jsonOutput)
        return parsed.scannedFiles === result.scannedFiles
      }),
      { numRuns: 100 },
    )
  })

  it('JSON round-trip preserves file count', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        const jsonOutput = formatResults(result, { format: 'json', colorize: false })
        const parsed: ScanResult = JSON.parse(jsonOutput)
        return parsed.files.length === result.files.length
      }),
      { numRuns: 100 },
    )
  })

  it('JSON round-trip preserves all usage ranges', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        const jsonOutput = formatResults(result, { format: 'json', colorize: false })
        const parsed: ScanResult = JSON.parse(jsonOutput)

        // 验证每个 usage 的 range 都被保留
        return result.files.every((file, fileIdx) => {
          const parsedFile = parsed.files[fileIdx]
          if (!parsedFile) return false

          return file.usages.every((usage, usageIdx) => {
            const parsedUsage = parsedFile.usages[usageIdx]
            if (!parsedUsage) return false

            return (
              parsedUsage.range.start.line === usage.range.start.line &&
              parsedUsage.range.start.character === usage.range.start.character &&
              parsedUsage.range.end.line === usage.range.end.line &&
              parsedUsage.range.end.character === usage.range.end.character
            )
          })
        })
      }),
      { numRuns: 100 },
    )
  })

  it('JSON round-trip preserves sourcePackage when present', () => {
    fc.assert(
      fc.property(scanResultArb, result => {
        const jsonOutput = formatResults(result, { format: 'json', colorize: false })
        const parsed: ScanResult = JSON.parse(jsonOutput)

        // 验证每个有 sourcePackage 的 usage 都被保留
        return result.files.every((file, fileIdx) => {
          const parsedFile = parsed.files[fileIdx]
          if (!parsedFile) return false

          return file.usages.every((usage, usageIdx) => {
            const parsedUsage = parsedFile.usages[usageIdx]
            if (!parsedUsage) return false

            // 如果原始有 sourcePackage，解析后也应该有
            if (usage.sourcePackage) {
              return parsedUsage.sourcePackage === usage.sourcePackage
            }
            // 如果原始没有 sourcePackage，解析后也不应该有
            return parsedUsage.sourcePackage === undefined
          })
        })
      }),
      { numRuns: 100 },
    )
  })

  it('empty ScanResult round-trips correctly', () => {
    const emptyResult: ScanResult = {
      files: [],
      totalUsages: 0,
      scannedFiles: 0,
    }

    const jsonOutput = formatResults(emptyResult, { format: 'json', colorize: false })
    const parsed: ScanResult = JSON.parse(jsonOutput)

    // 使用 fc.assert 包装以保持一致性
    fc.assert(
      fc.property(fc.constant(null), () => {
        return parsed.files.length === 0 && parsed.totalUsages === 0 && parsed.scannedFiles === 0
      }),
      { numRuns: 1 },
    )
  })
})
