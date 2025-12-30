import * as vscode from 'vscode'
import * as path from 'path'

import { collectDeprecatedUsages } from './collector'

import type { DeprecatedUsage, FileDeprecations, TreeNodeData } from './types'

/**
 * 当前打开文件的 deprecated 使用树视图提供者
 * 实时跟踪当前打开文件的诊断
 */
export class CurrentFileProvider implements vscode.TreeDataProvider<TreeNodeData> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNodeData | undefined | null | void>()
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event

  private fileDeprecations: FileDeprecations[] = []

  /** TreeItem 缓存，避免重复创建对象 */
  private treeItemCache = new Map<string, vscode.TreeItem>()

  constructor() {
    this.refresh()
  }

  /**
   * 生成缓存 key
   */
  private getCacheKey(element: TreeNodeData): string {
    if (element.type === 'file') {
      const file = element.data as FileDeprecations
      return `file:${file.uri.toString()}`
    } else {
      const usage = element.data as DeprecatedUsage
      const line = usage.range.start.line
      const col = usage.range.start.character
      return `usage:${usage.uri.toString()}:${line}:${col}`
    }
  }

  /**
   * 刷新数据（从 VSCode 诊断）
   */
  refresh(): void {
    // 全量刷新时清空所有缓存
    this.treeItemCache.clear()
    this.fileDeprecations = collectDeprecatedUsages()
    this._onDidChangeTreeData.fire()
  }

  /**
   * 按文件失效缓存（增量更新）
   */
  invalidateCache(uris: readonly vscode.Uri[]): void {
    const uriStrings = new Set(uris.map(uri => uri.toString()))

    // 删除受影响文件的缓存
    for (const key of this.treeItemCache.keys()) {
      for (const uriStr of uriStrings) {
        if (key.includes(uriStr)) {
          this.treeItemCache.delete(key)
          break
        }
      }
    }

    // 更新数据
    this.fileDeprecations = collectDeprecatedUsages()
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: TreeNodeData): vscode.TreeItem {
    const cacheKey = this.getCacheKey(element)
    const cached = this.treeItemCache.get(cacheKey)
    if (cached) {
      return cached
    }

    let item: vscode.TreeItem
    if (element.type === 'file') {
      item = this.createFileTreeItem(element.data as FileDeprecations)
    } else {
      item = this.createUsageTreeItem(element.data as DeprecatedUsage)
    }

    this.treeItemCache.set(cacheKey, item)
    return item
  }

  getChildren(element?: TreeNodeData): TreeNodeData[] {
    if (!element) {
      return this.fileDeprecations.map(file => ({
        type: 'file' as const,
        data: file,
      }))
    }

    if (element.type === 'file') {
      const fileData = element.data as FileDeprecations
      return fileData.usages.map(usage => ({
        type: 'usage' as const,
        data: usage,
      }))
    }

    return []
  }

  private createFileTreeItem(file: FileDeprecations): vscode.TreeItem {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(file.uri)
    const relativePath = workspaceFolder
      ? path.relative(workspaceFolder.uri.fsPath, file.uri.fsPath)
      : file.uri.fsPath

    const fileName = path.basename(file.uri.fsPath)
    const dirPath = path.dirname(relativePath)

    const item = new vscode.TreeItem(
      {
        label: fileName,
        highlights: [[0, fileName.length]],
      },
      vscode.TreeItemCollapsibleState.Expanded,
    )

    item.description = dirPath === '.' ? '' : dirPath
    item.tooltip = `${relativePath} (${file.usages.length} deprecated usages)`
    item.resourceUri = file.uri
    item.iconPath = vscode.ThemeIcon.File

    return item
  }

  private createUsageTreeItem(usage: DeprecatedUsage): vscode.TreeItem {
    const line = usage.range.start.line + 1
    const col = usage.range.start.character + 1
    const label = `Line ${line}:${col} - ${usage.message}`

    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None)
    item.iconPath = new vscode.ThemeIcon('warning')
    item.tooltip = usage.message
    item.command = {
      command: 'deprecationLens.gotoLocation',
      title: 'Go to Location',
      arguments: [usage.uri, usage.range],
    }

    return item
  }
}
