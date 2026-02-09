import { Show, createSignal } from 'solid-js'
import { Portal } from 'solid-js/web'

export interface TooltipProps {
  text: string,
}

/**
 * Tooltip 组件
 * 使用 Portal + fixed 定位，确保不会遮挡其他元素
 */
export function Tooltip(props: TooltipProps) {
  const [visible, setVisible] = createSignal(false)
  const [style, setStyle] = createSignal<{ top: string, left: string }>({ top: '0', left: '0' })

  let triggerRef: HTMLSpanElement | undefined
  let showTimer: ReturnType<typeof setTimeout> | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined

  function updatePosition() {
    if (!triggerRef) return

    const rect = triggerRef.getBoundingClientRect()
    const tooltipWidth = 240
    const tooltipHeight = 80 // 估算高度
    const padding = 8

    // 默认居中显示在上方
    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    let top = rect.top - tooltipHeight - 4

    // 左边界检测
    if (left < padding) {
      left = padding
    }
    // 右边界检测
    if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding
    }
    // 上边界检测：如果上方空间不足，显示在下方
    if (top < padding) {
      top = rect.bottom + 4
    }

    setStyle({ top: `${top}px`, left: `${left}px` })
  }

  function handleMouseEnter() {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
    showTimer = setTimeout(() => {
      updatePosition()
      setVisible(true)
    }, 300)
  }

  function handleMouseLeave() {
    if (showTimer) {
      clearTimeout(showTimer)
      showTimer = undefined
    }
    hideTimer = setTimeout(() => {
      setVisible(false)
    }, 200)
  }

  function handleTooltipEnter() {
    if (hideTimer) {
      clearTimeout(hideTimer)
      hideTimer = undefined
    }
  }

  function handleTooltipLeave() {
    hideTimer = setTimeout(() => {
      setVisible(false)
    }, 200)
  }

  return (
    <>
      <span
        ref={triggerRef}
        class="tooltip-trigger"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        ⓘ
      </span>
      <Show when={visible()}>
        <Portal>
          <div
            class="tooltip-content"
            style={{ top: style().top, left: style().left }}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
          >
            {props.text}
          </div>
        </Portal>
      </Show>
    </>
  )
}
