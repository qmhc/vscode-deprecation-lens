/**
 * 扁平化的树节点（用于虚拟滚动）
 */
export interface FlatNode {
  id: string,
  type: 'file' | 'usage',
  depth: number,
  expanded: boolean,
  fileName: string,
  dirPath: string,
  message: string,
  line: number,
  col: number,
  uri: string,
  usageCount: number,
}

/**
 * 扫描结果数据（从扩展传入）
 */
export interface ScanResultData {
  files: FileData[],
}

export interface FileData {
  uri: string,
  fileName: string,
  dirPath: string,
  usages: UsageData[],
}

export interface UsageData {
  line: number,
  col: number,
  message: string,
}

/**
 * 扩展 -> Webview 消息
 */
export type ExtensionMessage =
  | { type: 'scanResult', data: ScanResultData }
  | { type: 'scanResultAppend', file: FileData }
  | { type: 'scanProgress', message: string }
  | { type: 'scanStart' }
  | { type: 'scanEnd', totalUsages: number, totalFiles: number }
  | { type: 'config', includePattern: string, excludePattern: string }

/**
 * Webview -> 扩展 消息
 */
export type WebviewMessage =
  | { type: 'startScan', includePattern: string, excludePattern: string }
  | { type: 'cancelScan' }
  | { type: 'patternChange', includePattern: string, excludePattern: string }
  | { type: 'gotoLocation', uri: string, line: number, col: number }
  | { type: 'ready' }
