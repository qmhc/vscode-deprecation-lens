import { Index, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'


import { scanStore } from '../stores/scanStore'
import { getFileIconSvg } from './FileIcons'

import type { Accessor } from 'solid-js'

import type { FlatNode } from '../types'

const ROW_HEIGHT = 22
const OVERSCAN = 15

interface VirtualTreeProps {
  onGotoLocation: (node: { uri: string, line: number, col: number }) => void,
}

export function VirtualTree(props: VirtualTreeProps) {
  let containerRef: HTMLDivElement | undefined

  const [scrollTop, setScrollTop] = createSignal(0)
  const [containerHeight, setContainerHeight] = createSignal(0)

  // 计算可见范围
  const visibleRange = createMemo(() => {
    const nodes = scanStore.flatNodes()
    const visibleCount = Math.ceil(containerHeight() / ROW_HEIGHT)
    const startIndex = Math.max(0, Math.floor(scrollTop() / ROW_HEIGHT) - OVERSCAN)
    const endIndex = Math.min(nodes.length, startIndex + visibleCount + OVERSCAN * 2)
    return { startIndex, endIndex }
  })

  // 可见节点
  const visibleNodes = createMemo(() => {
    const nodes = scanStore.flatNodes()
    const { startIndex, endIndex } = visibleRange()
    return nodes.slice(startIndex, endIndex).map((node, i) => ({
      node,
      index: startIndex + i,
      top: (startIndex + i) * ROW_HEIGHT,
    }))
  })

  // 总高度
  const totalHeight = createMemo(() => scanStore.flatNodes().length * ROW_HEIGHT)

  // 滚动处理
  function handleScroll() {
    if (containerRef) {
      setScrollTop(containerRef.scrollTop)
    }
  }

  // 键盘导航
  function handleKeyDown(e: KeyboardEvent) {
    const nodes = scanStore.flatNodes()
    if (nodes.length === 0) return

    const currentIndex = scanStore.focusedIndex()

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusAndScroll(Math.min(currentIndex + 1, nodes.length - 1))
        break

      case 'ArrowUp':
        e.preventDefault()
        setFocusAndScroll(Math.max(currentIndex - 1, 0))
        break

      case 'ArrowRight': {
        e.preventDefault()
        const node = nodes[currentIndex]
        if (node?.type === 'file' && !node.expanded) {
          scanStore.toggleExpand(node.uri)
        }
        break
      }

      case 'ArrowLeft': {
        e.preventDefault()
        const node = nodes[currentIndex]
        if (node?.type === 'file' && node.expanded) {
          scanStore.toggleExpand(node.uri)
        } else if (node?.type === 'usage') {
          const parentIndex = nodes.findIndex(n => n.type === 'file' && n.uri === node.uri)
          if (parentIndex >= 0) {
            setFocusAndScroll(parentIndex)
          }
        }
        break
      }

      case 'Enter': {
        e.preventDefault()
        const node = nodes[currentIndex]
        if (node?.type === 'file') {
          scanStore.toggleExpand(node.uri)
        } else if (node?.type === 'usage') {
          props.onGotoLocation({ uri: node.uri, line: node.line, col: node.col })
        }
        break
      }

      case 'Home':
        e.preventDefault()
        setFocusAndScroll(0)
        break

      case 'End':
        e.preventDefault()
        setFocusAndScroll(nodes.length - 1)
        break
    }
  }

  function setFocusAndScroll(index: number) {
    const nodes = scanStore.flatNodes()
    if (index < 0 || index >= nodes.length) return

    scanStore.setFocusedIndex(index)

    // 确保焦点项可见
    if (containerRef) {
      const itemTop = index * ROW_HEIGHT
      const itemBottom = itemTop + ROW_HEIGHT
      const currentScrollTop = containerRef.scrollTop
      const viewHeight = containerRef.clientHeight

      if (itemTop < currentScrollTop) {
        containerRef.scrollTop = itemTop
      } else if (itemBottom > currentScrollTop + viewHeight) {
        containerRef.scrollTop = itemBottom - viewHeight
      }
    }
  }

  // 监听容器大小变化
  onMount(() => {
    if (containerRef) {
      setContainerHeight(containerRef.clientHeight)

      const resizeObserver = new ResizeObserver(() => {
        if (containerRef) {
          setContainerHeight(containerRef.clientHeight)
        }
      })
      resizeObserver.observe(containerRef)

      onCleanup(() => resizeObserver.disconnect())
    }
  })

  return (
    <div
      ref={containerRef}
      class='tree-container'
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
    >
      <div class='tree-viewport' style={{ height: `${totalHeight()}px`, position: 'relative' }}>
        <Index each={visibleNodes()}>
          {(item, index) => (
            <TreeRow
              item={item}
              arrayIndex={index}
              isFocused={() => scanStore.focusedIndex() === item().index}
              onToggle={() => scanStore.toggleExpand(item().node.uri)}
              onFocus={() => scanStore.setFocusedIndex(item().index)}
              onGoto={() =>
                props.onGotoLocation({
                  uri: item().node.uri,
                  line: item().node.line,
                  col: item().node.col,
                })
              }
            />
          )}
        </Index>
      </div>
    </div>
  )
}

interface TreeRowProps {
  item: Accessor<{ node: FlatNode, index: number, top: number }>,
  arrayIndex: number,
  isFocused: Accessor<boolean>,
  onToggle: () => void,
  onFocus: () => void,
  onGoto: () => void,
}

function TreeRow(props: TreeRowProps) {
  const handleClick = () => {
    props.onFocus()
    if (props.item().node.type === 'file') {
      props.onToggle()
    } else {
      props.onGoto()
    }
  }

  const handleChevronClick = (e: MouseEvent) => {
    e.stopPropagation()
    props.onToggle()
  }

  return (
    <div
      class={`tree-row ${props.item().node.type}${props.isFocused() ? ' focused' : ''}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: `${ROW_HEIGHT}px`,
        transform: `translateY(${props.item().top}px)`,
        'padding-left': `${4 + props.item().node.depth * 16}px`,
      }}
      data-index={props.item().index}
      onClick={handleClick}
    >
      <Show
        when={props.item().node.type === 'file'}
        fallback={<UsageContent node={() => props.item().node} />}
      >
        <FileContent node={() => props.item().node} onChevronClick={handleChevronClick} />
      </Show>
    </div>
  )
}

function FileContent(props: { node: Accessor<FlatNode>, onChevronClick: (e: MouseEvent) => void }) {
  return (
    <>
      <span
        class={`tree-icon codicon ${props.node().expanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}
        onClick={props.onChevronClick}
      />
      <span class='file-icon' innerHTML={getFileIconSvg(props.node().fileName)} />
      <span class='tree-label'>
        <span class='filename'>{props.node().fileName}</span>
        <Show when={props.node().dirPath}>
          <span class='dirpath'>{props.node().dirPath}</span>
        </Show>
        <span class='usage-count'>({props.node().usageCount})</span>
      </span>
    </>
  )
}

function UsageContent(props: { node: Accessor<FlatNode> }) {
  return (
    <>
      <span class='tree-icon warn-icon codicon codicon-warning' />
      <span class='tree-label'>
        Line {props.node().line}:{props.node().col} - {props.node().message}
      </span>
    </>
  )
}
