import * as vscode from 'vscode'

import { CurrentFileProvider } from './currentFileProvider'
import { GlobalScanWebviewProvider } from './globalScanWebviewProvider'

let diagnosticsListener: vscode.Disposable | undefined

/**
 * 插件激活入口
 */
export function activate(context: vscode.ExtensionContext) {
  console.info('[Deprecation Lens] Extension is activating...')

  // 创建当前文件的树视图提供者（Explorer 面板）
  const currentProvider = new CurrentFileProvider()
  const currentTreeView = vscode.window.createTreeView('deprecationLensCurrentView', {
    treeDataProvider: currentProvider,
    showCollapseAll: true,
  })

  // 创建全局扫描的 Webview 提供者（独立面板）
  const globalWebviewProvider = new GlobalScanWebviewProvider(context.extensionUri)
  const globalWebviewDisposable = vscode.window.registerWebviewViewProvider(
    GlobalScanWebviewProvider.viewType,
    globalWebviewProvider,
  )

  // 注册刷新当前文件命令
  const refreshCurrentCommand = vscode.commands.registerCommand(
    'deprecationLens.refreshCurrent',
    () => currentProvider.refresh(),
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

  // 监听诊断变化，按文件增量更新当前文件面板
  diagnosticsListener = vscode.languages.onDidChangeDiagnostics(event => {
    if (event.uris.length > 0) {
      currentProvider.invalidateCache(event.uris)
    } else {
      currentProvider.refresh()
    }
  })

  context.subscriptions.push(
    currentTreeView,
    globalWebviewDisposable,
    refreshCurrentCommand,
    gotoCommand,
    diagnosticsListener,
  )

  console.info('[Deprecation Lens] Extension activated successfully')
}

/**
 * 插件停用
 */
export function deactivate() {
  diagnosticsListener?.dispose()
}
