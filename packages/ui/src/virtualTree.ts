import type { FileData, FlatNode, ScanResultData } from './types'

const ROW_HEIGHT = 22
const OVERSCAN = 15 // 上下各多渲染 15 行缓冲

// 文件图标 SVG - 来自 vscode-icons / material-icon-theme
const ICONS: Record<string, string> = {
  // TypeScript
  ts: `<svg viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="2" fill="#3178c6"/><path d="M18.245 23.759v3.068a6.492 6.492 0 0 0 1.764.575 11.56 11.56 0 0 0 2.146.192 9.968 9.968 0 0 0 2.088-.211 5.11 5.11 0 0 0 1.735-.7 3.542 3.542 0 0 0 1.181-1.266 4.469 4.469 0 0 0 .186-3.394 3.409 3.409 0 0 0-.717-1.117 5.236 5.236 0 0 0-1.123-.877 12.027 12.027 0 0 0-1.477-.734q-.6-.249-1.08-.484a5.5 5.5 0 0 1-.813-.479 2.089 2.089 0 0 1-.516-.518 1.091 1.091 0 0 1-.181-.618 1.039 1.039 0 0 1 .162-.571 1.4 1.4 0 0 1 .459-.436 2.439 2.439 0 0 1 .726-.283 4.211 4.211 0 0 1 .956-.1 5.942 5.942 0 0 1 .808.058 6.292 6.292 0 0 1 .856.177 5.994 5.994 0 0 1 .836.3 4.657 4.657 0 0 1 .751.422V13.9a7.509 7.509 0 0 0-1.525-.4 12.426 12.426 0 0 0-1.9-.129 8.767 8.767 0 0 0-2.064.235 5.239 5.239 0 0 0-1.716.733 3.655 3.655 0 0 0-1.171 1.271 3.731 3.731 0 0 0-.431 1.845 3.588 3.588 0 0 0 .789 2.34 6 6 0 0 0 2.395 1.639q.63.26 1.175.509a6.458 6.458 0 0 1 .942.517 2.463 2.463 0 0 1 .626.585 1.2 1.2 0 0 1 .23.719 1.1 1.1 0 0 1-.144.552 1.269 1.269 0 0 1-.435.441 2.381 2.381 0 0 1-.726.292 4.377 4.377 0 0 1-1.018.105 5.773 5.773 0 0 1-1.969-.35 6.348 6.348 0 0 1-1.805-.988zm-5.154-7.638h4v-2.527H5.938v2.527H9.92v11.254h3.171z" fill="#fff"/></svg>`,
  // TypeScript React (无底色原子图标 - 放大)
  tsx: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" fill="#61dafb"/><g stroke="#61dafb" stroke-width="1" fill="none"><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)"/></g></svg>`,
  // JavaScript
  js: `<svg viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="2" fill="#f7df1e"/><path d="M9.633 24.333l2.2-1.333c.424.753.81 1.39 1.737 1.39.886 0 1.447-.347 1.447-1.697v-9.18h2.7v9.22c0 2.797-1.64 4.07-4.033 4.07a4.2 4.2 0 0 1-4.05-2.47m9.567-.2l2.2-1.277c.58.947 1.333 1.643 2.667 1.643 1.12 0 1.837-.56 1.837-1.333 0-.927-.733-1.257-1.967-1.797l-.677-.29c-1.95-.83-3.247-1.873-3.247-4.073 0-2.027 1.543-3.573 3.96-3.573a4.02 4.02 0 0 1 3.88 2.183l-2.127 1.363a1.85 1.85 0 0 0-1.753-1.167c-.8 0-1.3.507-1.3 1.167 0 .817.507 1.147 1.68 1.653l.677.29c2.297.983 3.593 1.987 3.593 4.24 0 2.43-1.907 3.76-4.473 3.76a5.177 5.177 0 0 1-4.95-2.79"/></svg>`,
  // JavaScript React (无底色原子图标 - 放大)
  jsx: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" fill="#61dafb"/><g stroke="#61dafb" stroke-width="1" fill="none"><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(120 12 12)"/></g></svg>`,
  // Vue
  vue: `<svg viewBox="0 0 32 32"><path d="M2 4l14 24L30 4h-5.5L16 18.5 7.5 4z" fill="#42b883"/><path d="M7.5 4L16 18.5 24.5 4h-5L16 10.25 12.5 4z" fill="#35495e"/></svg>`,
  // Test 文件 (烧杯图标)
  test: `<svg viewBox="0 0 32 32"><path d="M20 4v6.5l5.5 9.5a4 4 0 0 1-3.46 6H9.96a4 4 0 0 1-3.46-6L12 10.5V4" fill="none" stroke="#4fc3f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 4h12" stroke="#4fc3f7" stroke-width="2" stroke-linecap="round"/><path d="M8 22h16" stroke="#4fc3f7" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/></svg>`,
  // 默认文件图标
  default: `<svg viewBox="0 0 32 32"><path d="M20.414 2H8a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7.586zM22 28H10V4h8v6h4z" fill="#909399"/></svg>`,
}

/**
 * 获取文件图标 SVG
 */
function getFileIcon(fileName: string): string {
  // 检查是否是测试文件
  if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(fileName)) {
    return ICONS.test
  }
  const ext = fileName.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || ''
  return ICONS[ext] || ICONS.default
}

/**
 * 虚拟滚动树组件 - 优化版自定义实现
 */
export class VirtualTree {
  private container: HTMLElement
  private viewport!: HTMLElement

  private flatNodes: FlatNode[] = []
  private expandedFiles = new Set<string>()
  private rawData: ScanResultData = { files: [] }

  private onGotoLocation: (node: { uri: string, line: number, col: number }) => void

  // 虚拟滚动状态
  private scrollTop = 0
  private containerHeight = 0
  private focusedIndex = -1
  private rafId = 0

  constructor(
    container: HTMLElement,
    onGotoLocation: (node: { uri: string, line: number, col: number }) => void,
  ) {
    this.container = container
    this.onGotoLocation = onGotoLocation
    this.init()
  }

  private init(): void {
    this.viewport = document.createElement('div')
    this.viewport.className = 'tree-viewport'
    this.container.appendChild(this.viewport)

    // 使容器可聚焦以接收键盘事件
    this.container.tabIndex = 0
    this.container.addEventListener('keydown', e => this.handleKeyDown(e))

    // 监听滚动 - 使用 RAF 节流
    this.container.addEventListener('scroll', () => {
      this.scrollTop = this.container.scrollTop
      this.scheduleRender()
    })

    // 监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      this.containerHeight = this.container.clientHeight
      this.scheduleRender()
    })
    resizeObserver.observe(this.container)
  }

  private scheduleRender(): void {
    if (this.rafId) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0
      this.render()
    })
  }


  setData(data: ScanResultData): void {
    this.rawData = data
    this.expandedFiles.clear()
    this.focusedIndex = -1
    this.rebuildFlatNodes()
  }

  /** 增量添加文件结果 */
  appendFile(file: FileData): void {
    this.rawData.files.push(file)
    this.rebuildFlatNodes()
  }

  /** 清空数据 */
  clear(): void {
    this.rawData = { files: [] }
    this.expandedFiles.clear()
    this.focusedIndex = -1
    this.rebuildFlatNodes()
  }

  private rebuildFlatNodes(): void {
    const nodes: FlatNode[] = []

    for (const file of this.rawData.files) {
      const expanded = this.expandedFiles.has(file.uri)

      nodes.push({
        id: `file:${file.uri}`,
        type: 'file',
        depth: 0,
        expanded,
        fileName: file.fileName,
        dirPath: file.dirPath,
        message: '',
        line: 0,
        col: 0,
        uri: file.uri,
        usageCount: file.usages.length,
      })

      if (expanded) {
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

    this.flatNodes = nodes
    this.render()
  }

  private render(): void {
    const totalHeight = this.flatNodes.length * ROW_HEIGHT
    const visibleCount = Math.ceil(this.containerHeight / ROW_HEIGHT)
    const startIndex = Math.max(0, Math.floor(this.scrollTop / ROW_HEIGHT) - OVERSCAN)
    const endIndex = Math.min(this.flatNodes.length, startIndex + visibleCount + OVERSCAN * 2)

    this.viewport.style.height = `${totalHeight}px`
    this.viewport.style.position = 'relative'

    const fragment = document.createDocumentFragment()

    for (let i = startIndex; i < endIndex; i++) {
      const node = this.flatNodes[i]
      if (!node) continue

      const top = i * ROW_HEIGHT
      const row = this.createRow(node, top, i)
      fragment.appendChild(row)
    }

    this.viewport.innerHTML = ''
    this.viewport.appendChild(fragment)
  }

  private createRow(node: FlatNode, top: number, index: number): HTMLElement {
    const row = document.createElement('div')
    row.className = `tree-row ${node.type}${index === this.focusedIndex ? ' focused' : ''}`
    row.style.cssText = `position:absolute;top:0;left:0;right:0;height:${ROW_HEIGHT}px;transform:translateY(${top}px);padding-left:${4 + node.depth * 16}px`
    row.dataset.index = String(index)

    if (node.type === 'file') {
      const chevron = document.createElement('span')
      chevron.className = `tree-icon codicon ${node.expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`
      chevron.addEventListener('click', e => {
        e.stopPropagation()
        this.toggleExpand(node.uri)
      })
      row.appendChild(chevron)

      // 文件图标
      const fileIcon = document.createElement('span')
      fileIcon.className = 'file-icon'
      fileIcon.innerHTML = getFileIcon(node.fileName)
      row.appendChild(fileIcon)

      const label = document.createElement('span')
      label.className = 'tree-label'
      label.innerHTML = `
        <span class="filename">${this.escapeHtml(node.fileName)}</span>
        ${node.dirPath ? `<span class="dirpath">${this.escapeHtml(node.dirPath)}</span>` : ''}
        <span class="usage-count">(${node.usageCount})</span>
      `
      row.appendChild(label)

      row.addEventListener('click', () => {
        this.setFocus(index)
        this.toggleExpand(node.uri)
      })
    } else {
      const warnIcon = document.createElement('span')
      warnIcon.className = 'tree-icon warn-icon codicon codicon-warning'
      row.appendChild(warnIcon)

      const label = document.createElement('span')
      label.className = 'tree-label'
      label.textContent = `Line ${node.line}:${node.col} - ${node.message}`
      row.appendChild(label)

      row.addEventListener('click', () => {
        this.setFocus(index)
        this.onGotoLocation({ uri: node.uri, line: node.line, col: node.col })
      })
    }

    return row
  }


  private toggleExpand(uri: string): void {
    if (this.expandedFiles.has(uri)) {
      this.expandedFiles.delete(uri)
    } else {
      this.expandedFiles.add(uri)
    }
    this.rebuildFlatNodes()
  }

  private setFocus(index: number): void {
    if (index < 0 || index >= this.flatNodes.length) return
    this.focusedIndex = index

    // 确保焦点项可见
    const itemTop = index * ROW_HEIGHT
    const itemBottom = itemTop + ROW_HEIGHT

    if (itemTop < this.scrollTop) {
      this.container.scrollTop = itemTop
    } else if (itemBottom > this.scrollTop + this.containerHeight) {
      this.container.scrollTop = itemBottom - this.containerHeight
    }

    this.render()
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.flatNodes.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this.setFocus(Math.min(this.focusedIndex + 1, this.flatNodes.length - 1))
        break

      case 'ArrowUp':
        e.preventDefault()
        this.setFocus(Math.max(this.focusedIndex - 1, 0))
        break

      case 'ArrowRight': {
        e.preventDefault()
        const node = this.flatNodes[this.focusedIndex]
        if (node?.type === 'file' && !node.expanded) {
          this.toggleExpand(node.uri)
        }
        break
      }

      case 'ArrowLeft': {
        e.preventDefault()
        const node = this.flatNodes[this.focusedIndex]
        if (node?.type === 'file' && node.expanded) {
          this.toggleExpand(node.uri)
        } else if (node?.type === 'usage') {
          const parentIndex = this.flatNodes.findIndex(
            n => n.type === 'file' && n.uri === node.uri,
          )
          if (parentIndex >= 0) {
            this.setFocus(parentIndex)
          }
        }
        break
      }

      case 'Enter': {
        e.preventDefault()
        const node = this.flatNodes[this.focusedIndex]
        if (node?.type === 'file') {
          this.toggleExpand(node.uri)
        } else if (node?.type === 'usage') {
          this.onGotoLocation({ uri: node.uri, line: node.line, col: node.col })
        }
        break
      }

      case 'Home':
        e.preventDefault()
        this.setFocus(0)
        break

      case 'End':
        e.preventDefault()
        this.setFocus(this.flatNodes.length - 1)
        break
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
