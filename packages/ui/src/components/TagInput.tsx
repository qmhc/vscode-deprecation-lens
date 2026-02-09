import { For, createMemo, createSignal } from 'solid-js'

interface TagInputProps {
  value: string[],
  suggestions?: string[],
  onChange: (tags: string[]) => void,
  placeholder?: string,
}

/**
 * Tag 输入组件（带自动完成）
 */
export function TagInput(props: TagInputProps) {
  const [inputValue, setInputValue] = createSignal('')
  const [showSuggestions, setShowSuggestions] = createSignal(false)

  // 过滤后的建议列表
  const filteredSuggestions = createMemo(() => {
    const input = inputValue().toLowerCase()
    if (!input || !props.suggestions) return []
    return props.suggestions
      .filter(s => s.toLowerCase().includes(input) && !props.value.includes(s))
      .slice(0, 8)
  })

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (trimmed && !props.value.includes(trimmed)) {
      props.onChange([...props.value, trimmed])
    }
    setInputValue('')
  }

  function removeTag(tag: string) {
    props.onChange(props.value.filter(t => t !== tag))
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && inputValue().trim()) {
      e.preventDefault()
      addTag(inputValue())
    } else if (e.key === 'Backspace' && !inputValue() && props.value.length > 0) {
      removeTag(props.value[props.value.length - 1])
    }
  }

  function handleSuggestionClick(suggestion: string) {
    addTag(suggestion)
  }

  const shouldShowSuggestions = () => showSuggestions() && filteredSuggestions().length > 0

  return (
    <div class='tag-input-container'>
      <div class='tag-input-wrapper'>
        <For each={props.value}>
          {tag => (
            <span class='tag-item'>
              {tag}
              <button type='button' class='tag-remove' onClick={() => removeTag(tag)}>
                ×
              </button>
            </span>
          )}
        </For>
        <input
          type='text'
          class='tag-input'
          value={inputValue()}
          onInput={e => setInputValue(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={props.value.length === 0 ? props.placeholder : ''}
        />
      </div>
      {shouldShowSuggestions() && (
        <ul class='tag-suggestions'>
          <For each={filteredSuggestions()}>
            {suggestion => (
              <li class='tag-suggestion-item' onMouseDown={() => handleSuggestionClick(suggestion)}>
                {suggestion}
              </li>
            )}
          </For>
        </ul>
      )}
    </div>
  )
}
