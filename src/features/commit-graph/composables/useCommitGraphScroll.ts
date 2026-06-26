import { ref } from 'vue'
import { useRepositoryStore } from '@/stores/repository'

export function useCommitGraphScroll() {
  const repo = useRepositoryStore()
  const scrollEl = ref<HTMLElement | null>(null)
  const headerScrollEl = ref<HTMLElement | null>(null)
  let syncingHorizontalScroll = false

  function syncHorizontalScroll(source: 'header' | 'body'): void {
    if (syncingHorizontalScroll || !headerScrollEl.value || !scrollEl.value) return
    syncingHorizontalScroll = true
    const scrollLeft =
      source === 'body' ? scrollEl.value.scrollLeft : headerScrollEl.value.scrollLeft
    headerScrollEl.value.scrollLeft = scrollLeft
    scrollEl.value.scrollLeft = scrollLeft
    syncingHorizontalScroll = false
  }

  function onBodyScroll(): void {
    syncHorizontalScroll('body')
    if (!scrollEl.value || repo.loadingMoreCommits || !repo.commitPage.hasMore) return
    const el = scrollEl.value
    const threshold = 200
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - threshold) {
      void repo.loadMoreCommits()
    }
  }

  return { scrollEl, headerScrollEl, syncHorizontalScroll, onBodyScroll }
}
