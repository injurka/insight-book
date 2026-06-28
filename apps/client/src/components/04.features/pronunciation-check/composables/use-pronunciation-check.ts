import type { MaybeRef } from 'vue'
import { ref, unref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'

const isRecording = ref(false)
const isAnalyzingAudio = ref(false)
const pronScore = ref<number | null>(null)
const pronHeardText = ref('')
const pronHeardPhonetic = ref('')
const pronMistakeAnalysis = ref('')
const userAudioUrl = ref('')
const isUserAudioPlaying = ref(false)

let mediaRecorder: MediaRecorder | null = null
let audioChunks: Blob[] = []
let userAudio: HTMLAudioElement | null = null

export function usePronunciationCheck(
  word?: MaybeRef<string> | (() => string),
  language?: MaybeRef<string> | (() => string),
) {
  const toast = useToast()
  const { t } = useI18n()

  const getWord = () => {
    if (!word)
      return ''
    if (typeof word === 'function')
      return word()
    return unref(word)
  }

  const getLang = () => {
    if (!language)
      return ''
    if (typeof language === 'function')
      return language()
    return unref(language)
  }

  watch(
    () => getWord(),
    () => {
      pronScore.value = null
      pronHeardText.value = ''
      pronHeardPhonetic.value = ''
      pronMistakeAnalysis.value = ''
      isRecording.value = false
      isAnalyzingAudio.value = false
      isUserAudioPlaying.value = false
      if (userAudio) {
        try {
          userAudio.pause()
        }
        catch { }
        userAudio = null
      }
      if (userAudioUrl.value) {
        try {
          URL.revokeObjectURL(userAudioUrl.value)
        }
        catch { }
        userAudioUrl.value = ''
      }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop()
        }
        catch { }
      }
    },
  )

  async function toggleRecording(w?: string, lang?: string) {
    const activeWord = w || getWord() || ''
    const activeLang = lang || getLang() || ''

    if (isRecording.value) {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
      }
      isRecording.value = false
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorder = new MediaRecorder(stream)
      audioChunks = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0)
          audioChunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())

        if (userAudioUrl.value)
          URL.revokeObjectURL(userAudioUrl.value)
        userAudioUrl.value = URL.createObjectURL(audioBlob)

        if (!activeWord)
          return

        isAnalyzingAudio.value = true
        pronScore.value = null

        try {
          const res = await api.dictionary.checkPronunciation(activeWord, activeLang, audioBlob)
          pronScore.value = res.score
          pronHeardText.value = res.heardText
          pronHeardPhonetic.value = res.heardPhonetic || ''
          pronMistakeAnalysis.value = res.mistakeAnalysis || ''
        }
        catch {
          toast.error(t('errors.aiServer') || 'Не удалось проверить произношение (Проверьте API-ключи)')
        }
        finally {
          isAnalyzingAudio.value = false
        }
      }

      mediaRecorder.start()
      isRecording.value = true
      pronScore.value = null
    }
    catch {
      toast.error('Доступ к микрофону запрещен')
    }
  }

  function playUserAudio() {
    if (!userAudioUrl.value)
      return
    if (isUserAudioPlaying.value && userAudio) {
      userAudio.pause()
      userAudio.currentTime = 0
      isUserAudioPlaying.value = false
      return
    }
    userAudio = new Audio(userAudioUrl.value)
    userAudio.onplay = () => isUserAudioPlaying.value = true
    userAudio.onended = () => isUserAudioPlaying.value = false
    userAudio.play()
  }

  return {
    isRecording,
    isAnalyzingAudio,
    pronScore,
    pronHeardText,
    pronHeardPhonetic,
    pronMistakeAnalysis,
    userAudioUrl,
    isUserAudioPlaying,
    toggleRecording,
    playUserAudio,
  }
}
