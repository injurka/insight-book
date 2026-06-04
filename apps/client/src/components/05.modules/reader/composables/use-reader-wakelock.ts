import { useWakeLock } from '@vueuse/core'
import { useAnalysisStore } from '~/shared/store/analysis.store'

export function useReaderWakeLock() {
  const analysisStore = useAnalysisStore()
  const { isSupported: isWakeLockSupported, request: requestWakeLock, release: releaseWakeLock } = useWakeLock()

  watch(() => analysisStore.isAnalyzingPage, async (isAnalyzing) => {
    if (!isWakeLockSupported.value)
      return
    if (isAnalyzing) {
      try {
        await requestWakeLock('screen')
      }
      catch (err) {
        console.warn('Wake Lock request failed:', err)
      }
    }
    else {
      await releaseWakeLock()
    }
  })
}
