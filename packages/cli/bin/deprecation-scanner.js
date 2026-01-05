#!/usr/bin/env node

/**
 * CLI 可执行入口
 * 动态导入编译后的 CLI 模块
 */

import('../dist/cli.js').catch(err => {
  console.error('Failed to load CLI:', err.message)
  process.exit(1)
})
