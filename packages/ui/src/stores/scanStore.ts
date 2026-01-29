import { batch, createMemo, createSignal } from 'solid-js'
import { createStore, produce } from 'solid-js/store'

import type { FileData, FlatNode } from '../types'

// 防抖缓冲区
let pendingFiles: FileData[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 50

export interface ScanState {
  files: FileData[],
  isScanning: boolean,
  includePattern: string,
  excludePattern: string,
  msgGrep: string,
  msgGrepCaseSensitive: boolean,
  msgGrepIsRegex: boolean,
  statsMessage: string,
  hasResults: boolean,
}

const [state, setState] = createStore<ScanState>({
  files: [],
  isScanning: false,
  includePattern: '',
  excludePattern: '',
  msgGrep: '',
  msgGrepCaseSensitive: false,
  msgGrepIsRegex: false,
  statsMessage: 'Click "Start Scan" to scan the project',
  hasResults: false,
})

// 展开状态独立管理，避免影响文件数据的响应式追踪
const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set())
const [focusedIndex, setFocusedIndex] = createSignal(-1)

/**
 * 计算扁平化节点列表（用于虚拟滚动）
 */
const flatNodes = createMemo<FlatNode[]>(() => {
  const nodes: FlatNode[] = []
  const expanded = expandedFiles()

  for (const file of state.files) {
    const isExpanded = expanded.has(file.uri)

    nodes.push({
      id: `file:${file.uri}`,
      type: 'file',
      depth: 0,
      expanded: isExpanded,
      fileName: file.fileName,
      dirPath: file.dirPath,
      message: '',
      line: 0,
      col: 0,
      uri: file.uri,
      usageCount: file.usages.length,
    })

    if (isExpanded) {
      for (const usage of file.usages) {
        nodes.push({
          id: `usage:${file.uri}:${usage.line}:${usage.col}`,
          type: 'usage',
          depth: 1,
          expanded: false,
          fileName: '',
          dirPath: '',
          message: usage.message,
          line: usage.line,
          col: usage.col,
          uri: file.uri,
          usageCount: 0,
        })
      }
    }
  }

  return nodes
})

// Actions
function setConfig(config: {
  includePattern: string,
  excludePattern: string,
  msgGrep: string,
  msgGrepCaseSensitive: boolean,
  msgGrepIsRegex: boolean,
}) {
  setState(config)
}

function startScan() {
  // 清除待处理的文件
  pendingFiles = []
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }

  setState({
    isScanning: true,
    statsMessage: 'Scanning...',
    hasResults: false,
    files: [],
  })
  setExpandedFiles(new Set<string>())
  setFocusedIndex(-1)
}

function updateProgress(message: string) {
  setState('statsMessage', message)
}

function appendFile(file: FileData) {
  // 防抖：累积文件后批量更新
  pendingFiles.push(file)

  if (flushTimer) return

  flushTimer = setTimeout(() => {
    const filesToAdd = pendingFiles
    pendingFiles = []
    flushTimer = null

    // 使用 batch 合并多次状态更新
    batch(() => {
      setState(
        produce(s => {
          s.files.push(...filesToAdd)
        }),
      )
    })
  }, DEBOUNCE_MS)
}

function setAllFiles(files: FileData[]) {
  setState('files', files)
}

function endScan(totalUsages: number, totalFiles: number) {
  // 立即刷新待处理的文件
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  if (pendingFiles.length > 0) {
    const filesToAdd = pendingFiles
    pendingFiles = []
    setState(
      produce(s => {
        s.files.push(...filesToAdd)
      }),
    )
  }

  setState({
    isScanning: false,
    hasResults: totalFiles > 0,
    statsMessage:
      totalFiles > 0
        ? `${totalUsages} results in ${totalFiles} files`
        : 'No deprecated usages found',
  })
}

function toggleExpand(uri: string) {
  setExpandedFiles(prev => {
    const next = new Set(prev)
    if (next.has(uri)) {
      next.delete(uri)
    } else {
      next.add(uri)
    }
    return next
  })
}

function clearData() {
  setState('files', [])
  setExpandedFiles(new Set<string>())
  setFocusedIndex(-1)
}

export const scanStore = {
  state,
  flatNodes,
  focusedIndex,
  setFocusedIndex,
  expandedFiles,
  setConfig,
  startScan,
  updateProgress,
  appendFile,
  setAllFiles,
  endScan,
  toggleExpand,
  clearData,
}
