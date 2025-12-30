import './codicon.css'
import './styles.css'

import { App } from './App'

// 获取 VSCode API
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void,
  getState(): unknown,
  setState(state: unknown): void,
}

const vscode = acquireVsCodeApi()

// 检测宿主容器是否有 padding，没有则自行添加
const bodyStyle = getComputedStyle(document.body)
const hostPadding = parseFloat(bodyStyle.paddingLeft) + parseFloat(bodyStyle.paddingRight)
if (hostPadding === 0) {
  document.body.classList.add('no-host-padding')
}

// 初始化应用
new App(document.getElementById('app')!, vscode)

// 通知扩展 Webview 已就绪
vscode.postMessage({ type: 'ready' })
