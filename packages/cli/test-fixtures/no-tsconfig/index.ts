/* eslint-disable no-console */
/**
 * 测试文件：无 tsconfig.json 的项目
 */

/** @deprecated Use newHelper instead */
function oldHelper(): string {
  return 'old'
}

function newHelper(): string {
  return 'new'
}

// 使用弃用的函数
const result = oldHelper()
console.log(result)

export { oldHelper, newHelper }
