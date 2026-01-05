/**
 * Scanner 单元测试
 */

import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { extractPackageName, scan } from '../scanner'

describe('extractPackageName', () => {
  it('should extract regular package name', () => {
    expect(extractPackageName('/path/to/node_modules/lodash/index.js')).toBe('lodash')
  })

  it('should extract scoped package name', () => {
    expect(extractPackageName('/path/to/node_modules/@types/node/index.d.ts')).toBe('@types/node')
  })

  it('should return undefined for non-node_modules path', () => {
    expect(extractPackageName('/path/to/src/utils.ts')).toBeUndefined()
  })

  it('should handle nested node_modules', () => {
    expect(extractPackageName('/path/node_modules/pkg-a/node_modules/pkg-b/index.js')).toBe('pkg-a')
  })
})

describe('scan', () => {
  const fixturesDir = resolve(__dirname, '../../test-fixtures')

  it('should scan project with tsconfig.json', async () => {
    const result = await scan({
      rootDir: resolve(fixturesDir, 'basic-project'),
    })

    expect(result.scannedFiles).toBeGreaterThan(0)
    expect(result.totalUsages).toBeGreaterThan(0)
    expect(result.files.length).toBeGreaterThan(0)

    // 验证检测到了弃用用法
    const indexFile = result.files.find(f => f.filePath.endsWith('index.ts'))
    expect(indexFile).toBeDefined()
    expect(indexFile!.usages.length).toBeGreaterThan(0)
  })

  it('should scan project without tsconfig.json using defaults', async () => {
    const result = await scan({
      rootDir: resolve(fixturesDir, 'no-tsconfig'),
    })

    expect(result.scannedFiles).toBeGreaterThan(0)
    expect(result.totalUsages).toBeGreaterThan(0)
  })

  it('should call onProgress callback', async () => {
    const messages: string[] = []

    await scan({
      rootDir: resolve(fixturesDir, 'basic-project'),
      onProgress: msg => messages.push(msg),
    })

    expect(messages.length).toBeGreaterThan(0)
    expect(messages.some(m => m.includes('tsconfig'))).toBe(true)
  })

  it('should call onFile callback for each file with deprecations', async () => {
    const files: string[] = []

    const result = await scan({
      rootDir: resolve(fixturesDir, 'basic-project'),
      onFile: file => files.push(file.filePath),
    })

    expect(files.length).toBe(result.files.length)
  })

  it('should respect AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await scan({
      rootDir: resolve(fixturesDir, 'basic-project'),
      signal: controller.signal,
    })

    // 扫描应该被中断
    expect(result.scannedFiles).toBe(0)
  })

  it('should filter files with include pattern', async () => {
    const result = await scan({
      rootDir: resolve(fixturesDir, 'basic-project'),
      include: '**/*.tsx', // 不存在的模式
    })

    expect(result.scannedFiles).toBe(0)
  })

  it('should filter files with exclude pattern', async () => {
    const result = await scan({
      rootDir: resolve(fixturesDir, 'basic-project'),
      exclude: '**/*',
    })

    expect(result.scannedFiles).toBe(0)
  })

  it('should have consistent totalUsages count', async () => {
    const result = await scan({
      rootDir: resolve(fixturesDir, 'basic-project'),
    })

    const calculatedTotal = result.files.reduce((sum, file) => sum + file.usages.length, 0)

    expect(result.totalUsages).toBe(calculatedTotal)
  })
})
