import type * as VSCode from 'vscode'

/**
 * 单个 deprecated 使用记录
 */
export interface DeprecatedUsage {
  /** 文件 URI */
  uri: VSCode.Uri,
  /** 位置范围 */
  range: VSCode.Range,
  /** 诊断消息 */
  message: string,
  /** 严重程度 */
  severity: VSCode.DiagnosticSeverity,
}

/**
 * 按文件分组的 deprecated 使用
 */
export interface FileDeprecations {
  uri: VSCode.Uri,
  usages: DeprecatedUsage[],
}

/**
 * 树节点类型
 */
export type TreeNodeType = 'file' | 'usage' | 'message'

/**
 * 树节点数据
 */
export interface TreeNodeData {
  type: TreeNodeType,
  /** 文件节点时为 FileDeprecations，使用节点时为 DeprecatedUsage */
  data: FileDeprecations | DeprecatedUsage,
}
