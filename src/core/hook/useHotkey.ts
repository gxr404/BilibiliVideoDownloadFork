import { onMounted, onBeforeUnmount } from 'vue'

export function useHotkey (keyCombo: string, callback: () => void) {
  const handler = (e: KeyboardEvent) => {
    const lowerKey = e.key.toLowerCase()

    if (keyCombo === 'ctrl+a' && (e.ctrlKey || e.metaKey) && lowerKey === 'a') {
      e.preventDefault()
      callback()
    }
    // 其他按键需再处理...
  }

  onMounted(() => window.addEventListener('keydown', handler))
  onBeforeUnmount(() => window.removeEventListener('keydown', handler))
}
