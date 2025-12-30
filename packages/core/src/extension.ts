import * as vscode from 'vscode'

import { GlobalScanWebviewProvider } from './globalScanWebviewProvider'
import { DiagnosticsReporter } from './diagnosticsReporter'

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
  console.info('[Deprecation Lens] Extension is activating...')

  // 创建诊断上报器（上报到 Problems 面板）
  const diagnosticsReporter = new DiagnosticsReporter()

  // 创建全局扫描的 Webview 提供者（独立面板）
  const globalWebviewProvider = new GlobalScanWebviewProvider(context.extensionUri)
  const globalWebviewDisposable = vscode.window.registerWebviewViewProvider(
    GlobalScanWebviewProvider.viewType,
    globalWebviewProvider,
  )

  // 注册跳转命令
  const gotoCommand = vscode.commands.registerCommand(
    'deprecationLens.gotoLocation',
    async (uri: vscode.Uri, range: vscode.Range) => {
      const document = await vscode.workspace.openTextDocument(uri)
      const editor = await vscode.window.showTextDocument(document)
      editor.selection = new vscode.Selection(range.start, range.end)
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter)
    },
  )

  context.subscriptions.push(
    diagnosticsReporter,
    globalWebviewDisposable,
    gotoCommand,
  )

  console.info('[Deprecation Lens] Extension activated successfully')
}

/**
 * 插件停用
 */
export function deactivate() {}
