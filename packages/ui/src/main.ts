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

// 初始化应用
new App(document.getElementById('app')!, vscode)

// 通知扩展 Webview 已就绪
vscode.postMessage({ type: 'ready' })
