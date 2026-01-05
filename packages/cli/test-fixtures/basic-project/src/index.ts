/* eslint-disable no-console */
/**
 * 测试文件：包含已知的弃用用法
 */

/** @deprecated Use newFunction instead */
function oldFunction(): void {
  console.log('old')
}

function newFunction(): void {
  console.log('new')
}

// 使用弃用的函数
oldFunction()

/** @deprecated Use NewClass instead */
class OldClass {
  /** @deprecated Use newMethod instead */
  oldMethod(): void {
    console.log('old method')
  }
}

class NewClass {
  newMethod(): void {
    console.log('new method')
  }
}

// 使用弃用的类和方法
const instance = new OldClass()
instance.oldMethod()

export { oldFunction, newFunction, OldClass, NewClass }
