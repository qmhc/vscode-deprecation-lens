import { VirtualTree } from './virtualTree'

import type { ExtensionMessage, WebviewMessage } from './types'

interface VsCodeApi {
  postMessage(message: WebviewMessage): void,
}

/**
 * 主应用类
 */
export class App {
  private container: HTMLElement
  private vscode: VsCodeApi
  private tree: VirtualTree

  private includeInput!: HTMLInputElement
  private excludeInput!: HTMLInputElement
  private msgGrepInput!: HTMLInputElement
  private msgGrepCaseSensitiveBtn!: HTMLButtonElement
  private msgGrepRegexBtn!: HTMLButtonElement
  private scanBtn!: HTMLButtonElement
  private statsEl!: HTMLElement
  private treeContainer!: HTMLElement

  private isScanning = false
  private msgGrepCaseSensitive = false
  private msgGrepIsRegex = false

  constructor(container: HTMLElement, vscode: VsCodeApi) {
    this.container = container
    this.vscode = vscode

    this.render()
    this.tree = new VirtualTree(this.treeContainer, uri => this.handleGotoLocation(uri))
    this.bindEvents()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="search-panel">
        <div class="input-group">
          <label>Files to include</label>
          <input type="text" id="includePattern" placeholder="e.g., src/**/*.ts">
        </div>
        <div class="input-group">
          <label>Files to exclude</label>
          <input type="text" id="excludePattern" placeholder="e.g., **/*.test.ts">
        </div>
        <div class="input-group">
          <label>Message filter</label>
          <div class="input-with-toggles">
            <input type="text" id="msgGrepInput" placeholder="Filter by message (comma-separated)">
            <button type="button" id="msgGrepCaseSensitiveBtn" class="toggle-btn" title="Match Case">Aa</button>
            <button type="button" id="msgGrepRegexBtn" class="toggle-btn" title="Use Regular Expression">.*</button>
          </div>
        </div>
        <button class="btn-scan" id="scanBtn">Start Scan</button>
      </div>
      <div class="stats" id="stats">Click "Start Scan" to scan the project</div>
      <div class="tree-container" id="treeContainer"></div>
    `

    this.includeInput = this.container.querySelector('#includePattern')!
    this.excludeInput = this.container.querySelector('#excludePattern')!
    this.msgGrepInput = this.container.querySelector('#msgGrepInput')!
    this.msgGrepCaseSensitiveBtn = this.container.querySelector('#msgGrepCaseSensitiveBtn')!
    this.msgGrepRegexBtn = this.container.querySelector('#msgGrepRegexBtn')!
    this.scanBtn = this.container.querySelector('#scanBtn')!
    this.statsEl = this.container.querySelector('#stats')!
    this.treeContainer = this.container.querySelector('#treeContainer')!
  }

  private bindEvents(): void {
    // 扫描按钮
    this.scanBtn.addEventListener('click', () => this.startScan())

    // Enter 键触发扫描
    this.includeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.startScan()
    })
    this.excludeInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.startScan()
    })
    this.msgGrepInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.startScan()
    })

    // 输入变化时通知扩展端缓存
    this.includeInput.addEventListener('input', () => this.notifyPatternChange())
    this.excludeInput.addEventListener('input', () => this.notifyPatternChange())
    this.msgGrepInput.addEventListener('input', () => this.notifyPatternChange())

    // 开关按钮
    this.msgGrepCaseSensitiveBtn.addEventListener('click', () => {
      this.msgGrepCaseSensitive = !this.msgGrepCaseSensitive
      this.msgGrepCaseSensitiveBtn.classList.toggle('active', this.msgGrepCaseSensitive)
      this.notifyPatternChange()
    })
    this.msgGrepRegexBtn.addEventListener('click', () => {
      this.msgGrepIsRegex = !this.msgGrepIsRegex
      this.msgGrepRegexBtn.classList.toggle('active', this.msgGrepIsRegex)
      this.notifyPatternChange()
    })

    // 监听扩展消息
    window.addEventListener('message', e => this.handleMessage(e.data as ExtensionMessage))
  }

  private notifyPatternChange(): void {
    this.vscode.postMessage({
      type: 'patternChange',
      includePattern: this.includeInput.value,
      excludePattern: this.excludeInput.value,
      msgGrep: this.msgGrepInput.value,
      msgGrepCaseSensitive: this.msgGrepCaseSensitive,
      msgGrepIsRegex: this.msgGrepIsRegex,
    })
  }

  private startScan(): void {
    if (this.isScanning) {
      // 取消扫描
      this.vscode.postMessage({ type: 'cancelScan' })
      return
    }

    this.vscode.postMessage({
      type: 'startScan',
      includePattern: this.includeInput.value,
      excludePattern: this.excludeInput.value,
      msgGrep: this.msgGrepInput.value,
      msgGrepCaseSensitive: this.msgGrepCaseSensitive,
      msgGrepIsRegex: this.msgGrepIsRegex,
    })
  }

  private handleMessage(message: ExtensionMessage): void {
    switch (message.type) {
      case 'config':
        this.includeInput.value = message.includePattern
        this.excludeInput.value = message.excludePattern
        this.msgGrepInput.value = message.msgGrep
        this.msgGrepCaseSensitive = message.msgGrepCaseSensitive
        this.msgGrepIsRegex = message.msgGrepIsRegex
        this.msgGrepCaseSensitiveBtn.classList.toggle('active', this.msgGrepCaseSensitive)
        this.msgGrepRegexBtn.classList.toggle('active', this.msgGrepIsRegex)
        break

      case 'scanStart':
        this.isScanning = true
        this.scanBtn.disabled = false
        this.scanBtn.textContent = 'Cancel'
        this.statsEl.textContent = 'Scanning...'
        this.statsEl.className = 'stats'
        this.tree.clear()
        break

      case 'scanProgress':
        this.statsEl.textContent = message.message
        break

      case 'scanResult':
        this.tree.setData(message.data)
        break

      case 'scanResultAppend':
        this.tree.appendFile(message.file)
        break

      case 'scanEnd':
        this.isScanning = false
        this.scanBtn.disabled = false
        this.scanBtn.textContent = 'Start Scan'

        if (message.totalFiles > 0) {
          this.statsEl.textContent = `${message.totalUsages} results in ${message.totalFiles} files`
          this.statsEl.className = 'stats has-results'
        } else {
          this.statsEl.textContent = 'No deprecated usages found'
          this.statsEl.className = 'stats'
        }
        break
    }
  }

  private handleGotoLocation(node: { uri: string, line: number, col: number }): void {
    this.vscode.postMessage({
      type: 'gotoLocation',
      uri: node.uri,
      line: node.line,
      col: node.col,
    })
  }
}
