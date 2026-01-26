import { basename, dirname, relative } from 'node:path'

import * as vscode from 'vscode'

import { scanWithLanguageService } from './tsLanguageService'

import type { FileDeprecations } from './types'

/** 扫描结果缓存类型 */
interface ScanCache {
  data: {
    files: Array<{
      uri: string,
      fileName: string,
      dirPath: string,
      usages: Array<{ line: number, col: number, message: string }>,
    }>,
  },
  totalUsages: number,
  totalFiles: number,
}

/**
 * 全局扫描 Webview 提供者
 */
export class GlobalScanWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'deprecationLensGlobalView'

  private view?: vscode.WebviewView
  private extensionUri: vscode.Uri
  private isScanning = false
  private abortController?: AbortController

  // 缓存上次扫描结果，用于 WebView 重建时恢复
  private scanCache?: ScanCache

  // 缓存当前输入的 pattern
  private cachedIncludePattern = ''
  private cachedExcludePattern = ''
  private cachedMsgGrep = ''
  private cachedMsgGrepCaseSensitive = false
  private cachedMsgGrepIsRegex = false

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
    }

    webviewView.webview.html = this.getHtmlContent(webviewView.webview)

    // 处理来自 Webview 的消息
    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'ready':
          this.sendConfig()
          break
        case 'startScan':
          await this.startScan(
            message.includePattern,
            message.excludePattern,
            message.msgGrep,
            message.msgGrepCaseSensitive,
            message.msgGrepIsRegex,
          )
          break
        case 'patternChange':
          this.cachedIncludePattern = message.includePattern
          this.cachedExcludePattern = message.excludePattern
          this.cachedMsgGrep = message.msgGrep
          this.cachedMsgGrepCaseSensitive = message.msgGrepCaseSensitive
          this.cachedMsgGrepIsRegex = message.msgGrepIsRegex
          break
        case 'cancelScan':
          this.cancelScan()
          break
        case 'gotoLocation':
          await this.gotoLocation(message.uri, message.line, message.col)
          break
      }
    })
  }

  private sendConfig(): void {
    // 优先使用缓存的 pattern，否则从配置读取
    const config = vscode.workspace.getConfiguration('deprecationLens')
    const includePattern = this.cachedIncludePattern || config.get<string>('includePattern', '')
    const excludePattern = this.cachedExcludePattern || config.get<string>('excludePattern', '')

    this.view?.webview.postMessage({
      type: 'config',
      includePattern,
      excludePattern,
      msgGrep: this.cachedMsgGrep,
      msgGrepCaseSensitive: this.cachedMsgGrepCaseSensitive,
      msgGrepIsRegex: this.cachedMsgGrepIsRegex,
    })

    // 恢复缓存的扫描结果
    if (this.scanCache) {
      this.view?.webview.postMessage({ type: 'scanResult', data: this.scanCache.data })
      this.view?.webview.postMessage({
        type: 'scanEnd',
        totalUsages: this.scanCache.totalUsages,
        totalFiles: this.scanCache.totalFiles,
      })
    }
  }

  private async startScan(
    includePattern: string,
    excludePattern: string,
    msgGrep: string,
    msgGrepCaseSensitive: boolean,
    msgGrepIsRegex: boolean,
  ): Promise<void> {
    if (this.isScanning || !this.view) return

    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showWarningMessage('No workspace folder open')
      return
    }

    // 保存配置
    const config = vscode.workspace.getConfiguration('deprecationLens')
    await config.update('includePattern', includePattern, vscode.ConfigurationTarget.Workspace)
    await config.update('excludePattern', excludePattern, vscode.ConfigurationTarget.Workspace)

    this.isScanning = true
    this.abortController = new AbortController()
    this.view.webview.postMessage({ type: 'scanStart' })

    const allResults: FileDeprecations[] = []

    // 解析 msgGrep 为数组
    const msgGrepPatterns = msgGrep
      ? msgGrep.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : undefined

    for (const folder of workspaceFolders) {
      this.view.webview.postMessage({
        type: 'scanProgress',
        message: `Scanning ${folder.name}...`,
      })

      try {
        const results = await scanWithLanguageService(folder, {
          includePattern: includePattern || undefined,
          excludePattern: excludePattern || undefined,
          msgGrep: msgGrepPatterns,
          msgGrepCaseSensitive,
          msgGrepIsRegex,
          signal: this.abortController?.signal,
          onProgress: message => {
            this.view?.webview.postMessage({ type: 'scanProgress', message })
          },
          onResult: file => {
            // 流式发送每个文件的结果
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(file.uri)
            const relativePath = workspaceFolder
              ? relative(workspaceFolder.uri.fsPath, file.uri.fsPath)
              : file.uri.fsPath

            this.view?.webview.postMessage({
              type: 'scanResultAppend',
              file: {
                uri: file.uri.toString(),
                fileName: basename(file.uri.fsPath),
                dirPath: dirname(relativePath) === '.' ? '' : dirname(relativePath),
                usages: file.usages.map(u => ({
                  line: u.range.start.line + 1,
                  col: u.range.start.character + 1,
                  message: u.message,
                })),
              },
            })
          },
        })

        allResults.push(...results)
      } catch (error) {
        console.error(`[Deprecation Lens] Failed to scan ${folder.name}:`, error)
      }
    }

    // 排序并转换数据格式
    const sortedResults = allResults.sort((a, b) => a.uri.fsPath.localeCompare(b.uri.fsPath))

    const scanData = {
      files: sortedResults.map(file => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(file.uri)
        const relativePath = workspaceFolder
          ? relative(workspaceFolder.uri.fsPath, file.uri.fsPath)
          : file.uri.fsPath

        return {
          uri: file.uri.toString(),
          fileName: basename(file.uri.fsPath),
          dirPath: dirname(relativePath) === '.' ? '' : dirname(relativePath),
          usages: file.usages.map(u => ({
            line: u.range.start.line + 1,
            col: u.range.start.character + 1,
            message: u.message,
          })),
        }
      }),
    }

    this.view.webview.postMessage({ type: 'scanResult', data: scanData })

    const totalUsages = allResults.reduce((sum, f) => sum + f.usages.length, 0)
    const totalFiles = allResults.length

    // 缓存扫描结果
    this.scanCache = { data: scanData, totalUsages, totalFiles }

    this.view.webview.postMessage({ type: 'scanEnd', totalUsages, totalFiles })
    this.isScanning = false
    this.abortController = undefined
  }

  private cancelScan(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = undefined
    }
    this.isScanning = false
    this.view?.webview.postMessage({ type: 'scanEnd', totalUsages: 0, totalFiles: 0 })
  }

  private async gotoLocation(uriString: string, line: number, col: number): Promise<void> {
    const uri = vscode.Uri.parse(uriString)
    const document = await vscode.workspace.openTextDocument(uri)
    const editor = await vscode.window.showTextDocument(document)

    const position = new vscode.Position(line - 1, col - 1)
    const range = new vscode.Range(position, position)

    editor.selection = new vscode.Selection(range.start, range.end)
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter)
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.js'),
    )
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'index.css'),
    )

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; font-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <title>Deprecation Lens</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`
  }
}
