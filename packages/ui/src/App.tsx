import { scanStore } from './stores/scanStore'
import { VirtualTree } from './components/VirtualTree'

import type { ExtensionMessage, WebviewMessage } from './types'

interface VsCodeApi {
  postMessage(message: WebviewMessage): void,
}

interface AppProps {
  vscode: VsCodeApi,
}

export function App(props: AppProps) {
  // 监听扩展消息
  window.addEventListener('message', e => handleMessage(e.data as ExtensionMessage))

  function handleMessage(message: ExtensionMessage) {
    switch (message.type) {
      case 'config':
        scanStore.setConfig({
          includePattern: message.includePattern,
          excludePattern: message.excludePattern,
          msgGrep: message.msgGrep,
          msgGrepCaseSensitive: message.msgGrepCaseSensitive,
          msgGrepIsRegex: message.msgGrepIsRegex,
        })
        break

      case 'scanStart':
        scanStore.startScan()
        break

      case 'scanProgress':
        scanStore.updateProgress(message.message)
        break

      case 'scanResult':
        scanStore.setAllFiles(message.data.files)
        break

      case 'scanResultAppend':
        scanStore.appendFile(message.file)
        break

      case 'scanEnd':
        scanStore.endScan(message.totalUsages, message.totalFiles)
        break
    }
  }

  function notifyPatternChange() {
    props.vscode.postMessage({
      type: 'patternChange',
      includePattern: scanStore.state.includePattern,
      excludePattern: scanStore.state.excludePattern,
      msgGrep: scanStore.state.msgGrep,
      msgGrepCaseSensitive: scanStore.state.msgGrepCaseSensitive,
      msgGrepIsRegex: scanStore.state.msgGrepIsRegex,
    })
  }

  function handleInputChange(field: keyof typeof scanStore.state, value: string | boolean) {
    scanStore.setConfig({
      ...scanStore.state,
      [field]: value,
    })
    notifyPatternChange()
  }

  function handleScan() {
    if (scanStore.state.isScanning) {
      props.vscode.postMessage({ type: 'cancelScan' })
    } else {
      props.vscode.postMessage({
        type: 'startScan',
        includePattern: scanStore.state.includePattern,
        excludePattern: scanStore.state.excludePattern,
        msgGrep: scanStore.state.msgGrep,
        msgGrepCaseSensitive: scanStore.state.msgGrepCaseSensitive,
        msgGrepIsRegex: scanStore.state.msgGrepIsRegex,
      })
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleScan()
    }
  }

  function handleGotoLocation(node: { uri: string, line: number, col: number }) {
    props.vscode.postMessage({
      type: 'gotoLocation',
      uri: node.uri,
      line: node.line,
      col: node.col,
    })
  }

  return (
    <>
      <div class='search-panel'>
        <div class='input-group'>
          <label>Files to include</label>
          <input
            type='text'
            placeholder='e.g., src/**/*.ts'
            value={scanStore.state.includePattern}
            onInput={e => handleInputChange('includePattern', e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div class='input-group'>
          <label>Files to exclude</label>
          <input
            type='text'
            placeholder='e.g., **/*.test.ts'
            value={scanStore.state.excludePattern}
            onInput={e => handleInputChange('excludePattern', e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div class='input-group'>
          <label>Message filter</label>
          <div class='input-with-toggles'>
            <input
              type='text'
              placeholder='Filter by message (comma-separated)'
              value={scanStore.state.msgGrep}
              onInput={e => handleInputChange('msgGrep', e.currentTarget.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type='button'
              class={`toggle-btn${scanStore.state.msgGrepCaseSensitive ? ' active' : ''}`}
              title='Match Case'
              onClick={() =>
                handleInputChange('msgGrepCaseSensitive', !scanStore.state.msgGrepCaseSensitive)
              }
            >
              Aa
            </button>
            <button
              type='button'
              class={`toggle-btn${scanStore.state.msgGrepIsRegex ? ' active' : ''}`}
              title='Use Regular Expression'
              onClick={() => handleInputChange('msgGrepIsRegex', !scanStore.state.msgGrepIsRegex)}
            >
              .*
            </button>
          </div>
        </div>
        <button class='btn-scan' onClick={handleScan}>
          {scanStore.state.isScanning ? 'Cancel' : 'Start Scan'}
        </button>
      </div>
      <div class={`stats${scanStore.state.hasResults ? ' has-results' : ''}`}>
        {scanStore.state.statsMessage}
      </div>
      <VirtualTree onGotoLocation={handleGotoLocation} />
    </>
  )
}
