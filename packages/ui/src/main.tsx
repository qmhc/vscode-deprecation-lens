/* @refresh reload */
import { render } from 'solid-js/web'

import './codicon.css'
import './styles.css'

import { App } from './App'

import type { WebviewMessage } from './types'

// 获取 VSCode API
declare function acquireVsCodeApi(): {
  postMessage(message: WebviewMessage): void,
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

// 渲染应用
const root = document.getElementById('app')
if (root) {
  render(() => <App vscode={vscode} />, root)
}

// 通知扩展 Webview 已就绪
vscode.postMessage({ type: 'ready' })
