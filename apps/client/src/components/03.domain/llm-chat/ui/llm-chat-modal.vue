<!-- eslint-disable regexp/no-super-linear-backtracking -->
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import DOMPurify from 'dompurify'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { KitBtn, KitDialog, KitDropdown, KitInput, KitPrompt } from '~/components/01.kit'
import { useToast } from '~/shared/composables/use-toast'
import { api } from '~/shared/services/api.service'

const props = defineProps<{
  word: string
  language: string
}>()
const visible = defineModel<boolean>('visible', { required: true })
const { t, locale } = useI18n()
const toast = useToast()

const messages = ref<{ id: string, sender: 'user' | 'ai', text: string }[]>([])
const prompts = ref<any[]>([])
const selectedPromptId = ref<number | ''>('')
const messageText = ref('')
const isAiLoading = ref(false)
const isManagingPrompts = ref(false)

const isEditingPrompt = ref(false)
const editingPromptId = ref<number | null>(null)
const editName = ref('')
const editPromptText = ref('')

const isDeleteConfirmOpen = ref(false)
const promptToDelete = ref<number | null>(null)

const chatHistoryRef = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (chatHistoryRef.value) {
      chatHistoryRef.value.scrollTop = chatHistoryRef.value.scrollHeight
    }
  })
}

async function fetchPrompts() {
  try {
    prompts.value = await api.dictionary.promptsList()
  }
  catch {
    toast.error('Failed to load custom prompts')
  }
}

function formatMarkdown(text: string): string {
  if (!text)
    return ''

  let processed = text.trim()
  const blocks: string[] = []

  // 1. Извлекаем и форматируем многострочные блоки кода
  processed = processed.replace(/```([a-z]*)\s*([\s\S]*?)```/gi, (_, _lang, codeContent) => {
    const escaped = codeContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const formattedCode = `<pre class="chat-code-block"><code class="chat-code">${escaped}</code></pre>`
    const placeholder = `__BLOCK_PLACEHOLDER_${blocks.length}__`
    blocks.push(formattedCode)
    return placeholder
  })

  // 2. Извлекаем инлайн-код
  processed = processed.replace(/`([^`]+)`/g, (_, inlineCode) => {
    const escaped = inlineCode
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const formattedCode = `<code class="chat-code">${escaped}</code>`
    const placeholder = `__BLOCK_PLACEHOLDER_${blocks.length}__`
    blocks.push(formattedCode)
    return placeholder
  })

  // 3. Базовый Markdown (жирный, курсив, заголовки)
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')

  // 4. Списки: превращаем строки с дефисами или звездочками в <li>
  processed = processed.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>')

  // Оборачиваем группы <li> в родительский <ul>
  processed = processed.replace(/(?:<li>.*?<\/li>\s*)+/g, match => `<ul>${match}</ul>`)

  // 5. Заменяем переносы строк на <br> для обычного текста
  processed = processed.replace(/\n/g, '<br>')

  // Очищаем лишние <br> внутри и вокруг блочных элементов (чтобы списки не разъезжались)
  processed = processed.replace(/(<\/h[1-6]>|<\/ul>|<\/li>|<br>)(<br>)+/g, '$1')
  processed = processed.replace(/<ul><br>/g, '<ul>')
  processed = processed.replace(/<\/li><br>/g, '</li>')

  // 6. Возвращаем блоки кода на место
  for (let i = 0; i < blocks.length; i++) {
    processed = processed.replace(`__BLOCK_PLACEHOLDER_${i}__`, blocks[i])
  }

  // Очищаем итоговый HTML для безопасности (DOMPurify сохраняет нужные нам теги)
  return DOMPurify.sanitize(processed)
}

const quickStartPrompts = computed(() => [
  { label: t('dictionary.explainPronunciation'), text: t('dictionary.promptPronunciationText') },
  { label: t('dictionary.giveExamples'), text: t('dictionary.promptExamplesText') },
  { label: t('dictionary.explainGrammar'), text: t('dictionary.promptGrammarText') },
])

function useQuickPrompt(text: string) {
  messageText.value = text
  sendMessage()
}

async function sendMessage() {
  const userText = messageText.value.trim()
  const promptId = selectedPromptId.value

  let displayUserText = userText
  if (promptId) {
    const p = prompts.value.find(pr => pr.id === promptId)
    const promptNameText = p ? p.name : ''
    displayUserText = userText ? `[${promptNameText}] ${userText}` : `[${promptNameText}]`
  }

  messages.value.push({
    id: String(Date.now()),
    sender: 'user',
    text: displayUserText,
  })

  messageText.value = ''
  scrollToBottom()
  isAiLoading.value = true

  try {
    const payload: any = {
      word: props.word,
      language: props.language || 'en',
      uiLanguage: locale.value,
    }
    if (promptId) {
      payload.customPromptId = Number(promptId)
    }
    if (userText) {
      payload.userPromptText = userText
    }

    const res = await api.dictionary.chat(payload)
    messages.value.push({
      id: String(Date.now() + 1),
      sender: 'ai',
      text: res.response,
    })
    scrollToBottom()
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'Error calling chat API')
  }
  finally {
    isAiLoading.value = false
  }
}

function handleEnterKey(e: KeyboardEvent) {
  if (e.shiftKey) {
    return
  }
  if (isAiLoading.value || (!messageText.value.trim() && !selectedPromptId.value)) {
    return
  }
  sendMessage()
}

function startCreatePrompt() {
  isEditingPrompt.value = true
  editingPromptId.value = null
  editName.value = ''
  editPromptText.value = ''
}

function startEditPrompt(prompt: any) {
  isEditingPrompt.value = true
  editingPromptId.value = prompt.id
  editName.value = prompt.name
  editPromptText.value = prompt.prompt
}

function cancelPromptForm() {
  isEditingPrompt.value = false
  editingPromptId.value = null
  editName.value = ''
  editPromptText.value = ''
}

async function savePrompt() {
  try {
    if (editingPromptId.value !== null) {
      await api.dictionary.promptsUpdate(editingPromptId.value, {
        name: editName.value.trim(),
        prompt: editPromptText.value.trim(),
      })
      toast.success('Prompt updated')
    }
    else {
      const newPrompt = await api.dictionary.promptsCreate({
        name: editName.value.trim(),
        prompt: editPromptText.value.trim(),
      })
      toast.success('Prompt created')
      selectedPromptId.value = newPrompt.id
    }
    await fetchPrompts()
    cancelPromptForm()
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'Error saving prompt')
  }
}

function deletePrompt(id: number) {
  promptToDelete.value = id
  isDeleteConfirmOpen.value = true
}

async function onDeletePromptConfirm() {
  if (promptToDelete.value === null)
    return

  const id = promptToDelete.value
  isDeleteConfirmOpen.value = false

  try {
    await api.dictionary.promptsDelete(id)
    toast.success('Prompt deleted')
    if (selectedPromptId.value === id) {
      selectedPromptId.value = ''
    }
    await fetchPrompts()
  }
  catch (e) {
    toast.error(e instanceof Error ? e.message : 'Error deleting prompt')
  }
  finally {
    promptToDelete.value = null
  }
}

watch(visible, (isOpen) => {
  if (isOpen) {
    messages.value = []
    selectedPromptId.value = ''
    messageText.value = ''
    isManagingPrompts.value = false
    cancelPromptForm()
    fetchPrompts()
  }
  else {
    messages.value = []
  }
})

onMounted(() => {
  if (visible.value) {
    fetchPrompts()
  }
})
</script>

<template>
  <KitDialog v-model:visible="visible" :title="`${t('dictionary.aiFreeQuestion')}: ${word}`" :max-width="650">
    <div class="chat-modal-layout" :class="{ 'with-sidebar': isManagingPrompts }">
      <div class="chat-main-panel">
        <div ref="chatHistoryRef" class="chat-history">
          <div v-if="messages.length === 0" class="empty-chat">
            <div class="empty-chat-hero">
              <Icon icon="mdi:robot-outline" class="bot-icon-large" />
              <h3>{{ t('dictionary.aiFreeQuestion') }}: {{ word }}</h3>
              <p>{{ t('dictionary.typePrompt') }}</p>
            </div>
            <div class="quick-prompts-container">
              <button
                v-for="qp in quickStartPrompts"
                :key="qp.label"
                class="quick-prompt-pill"
                @click="useQuickPrompt(qp.text)"
              >
                <Icon icon="mdi:sparkles" class="mr-1" />
                {{ qp.label }}
              </button>
            </div>
          </div>
          <div v-for="msg in messages" :key="msg.id" class="chat-message" :class="msg.sender">
            <div class="message-bubble">
              <div class="message-sender-label">
                <Icon v-if="msg.sender === 'ai'" icon="mdi:robot" class="ai-label-icon mr-1" />
                {{ msg.sender === 'user' ? t('dictionary.userLabel') : t('dictionary.aiLabel') }}
              </div>
              <div class="message-content" v-html="formatMarkdown(msg.text)" />
            </div>
          </div>
          <div v-if="isAiLoading" class="chat-message ai">
            <div class="message-bubble loading">
              <Icon icon="mdi:loading" class="spin-animation" />
              <span>{{ t('dictionary.thinking') || 'Thinking...' }}</span>
            </div>
          </div>
        </div>

        <div class="chat-input-row">
          <KitDropdown placement="top-start" width="220px" :close-on-content-click="true">
            <template #activator="{ props: activatorProps }">
              <KitBtn
                :icon="selectedPromptId ? 'mdi:magic-staff' : 'mdi:format-list-bulleted'"
                variant="tonal"
                color="secondary"
                :title="t('dictionary.selectPrompt')"
                :class="{ 'is-active-btn': activatorProps.isOpen }"
              />
            </template>
            <div class="prompt-dropdown-menu">
              <div
                class="dropdown-item"
                :class="{ active: selectedPromptId === '' }"
                @click="selectedPromptId = ''"
              >
                {{ t('dictionary.selectPrompt') }} ({{ t('dictionary.noPrompt') || 'None' }})
              </div>
              <div v-for="p in prompts" :key="p.id" class="dropdown-item" :class="{ active: selectedPromptId === p.id }" @click="selectedPromptId = p.id">
                {{ p.name }}
              </div>
              <div class="dropdown-divider" />
              <div class="dropdown-item custom-prompts-btn" @click="isManagingPrompts = true">
                <Icon icon="mdi:cog" class="mr-2" />
                {{ t('dictionary.customPrompts') }}
              </div>
            </div>
          </KitDropdown>

          <div class="input-wrapper">
            <div v-if="selectedPromptId" class="selected-prompt-badge">
              <span class="badge-text">{{ prompts.find(p => p.id === selectedPromptId)?.name }}</span>
              <KitBtn icon="mdi:close" variant="text" size="xs" color="secondary" @click="selectedPromptId = ''" />
            </div>
            <textarea
              v-model="messageText"
              class="custom-textarea chat-textarea"
              rows="1"
              :placeholder="t('dictionary.typePrompt')"
              :disabled="isAiLoading"
              @keydown.enter.prevent="handleEnterKey"
            />
          </div>
          <KitBtn
            color="primary"
            :disabled="isAiLoading || (!messageText.trim() && !selectedPromptId)"
            @click="sendMessage"
          >
            <Icon icon="mdi:send" />
          </KitBtn>
        </div>
      </div>

      <div v-if="isManagingPrompts" class="chat-sidebar-panel">
        <div class="sidebar-header">
          <h3>{{ t('dictionary.customPrompts') }}</h3>
          <KitBtn icon="mdi:close" variant="text" size="xs" color="secondary" @click="isManagingPrompts = false" />
        </div>

        <div v-if="!isEditingPrompt" class="prompt-manager-list">
          <div v-for="prompt in prompts" :key="prompt.id" class="prompt-manager-item">
            <span class="prompt-name" :title="prompt.prompt">{{ prompt.name }}</span>
            <div class="prompt-actions">
              <KitBtn icon="mdi:pencil" variant="text" size="xs" color="secondary" @click="startEditPrompt(prompt)" />
              <KitBtn icon="mdi:delete" variant="text" size="xs" color="error" @click="deletePrompt(prompt.id)" />
            </div>
          </div>
          <KitBtn icon="mdi:plus" variant="tonal" color="primary" class="add-prompt-btn" @click="startCreatePrompt">
            {{ t('dictionary.creatingPrompt') }}
          </KitBtn>
        </div>

        <div v-else class="prompt-form">
          <h4>{{ editingPromptId ? t('dictionary.editingPrompt') : t('dictionary.creatingPrompt') }}</h4>
          <div class="form-group">
            <label>{{ t('dictionary.promptName') }}</label>
            <KitInput v-model="editName" :placeholder="t('dictionary.promptName')" />
          </div>
          <div class="form-group">
            <label>{{ t('dictionary.promptText') }}</label>
            <textarea
              v-model="editPromptText"
              class="custom-textarea"
              rows="4"
              :placeholder="t('dictionary.customPromptPlaceholder')"
            />
          </div>
          <div class="form-actions">
            <KitBtn variant="tonal" color="secondary" size="sm" @click="cancelPromptForm">
              {{ t('dictionary.cancel') }}
            </KitBtn>
            <KitBtn color="primary" size="sm" :disabled="!editName.trim() || !editPromptText.trim()" @click="savePrompt">
              {{ t('dictionary.savePrompt') }}
            </KitBtn>
          </div>
        </div>
      </div>
    </div>
    <KitPrompt
      v-model:visible="isDeleteConfirmOpen"
      :title="t('dictionary.delete')"
      :description="t('dictionary.deletePrompt') || 'Delete this prompt?'"
      :hide-input="true"
      :confirm-text="t('dictionary.delete')"
      :cancel-text="t('dictionary.cancel')"
      @submit="onDeletePromptConfirm"
    />
  </KitDialog>
</template>

<style lang="scss" scoped>
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spin-animation {
  animation: spin 1s linear infinite;
}

.chat-modal-layout {
  display: flex;
  gap: 16px;
  min-height: 450px;
  max-height: 80vh;
  transition: all 0.3s ease;

  &.with-sidebar {
    .chat-main-panel {
      flex: 1 1 60%;
      min-width: 0;
    }
  }
}

.chat-main-panel {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.chat-sidebar-panel {
  flex: 1 1 40%;
  border-left: 1px solid var(--border-secondary-color);
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  min-width: 220px;
}

.chat-history {
  flex: 1;
  background-color: var(--bg-primary-color);
  border: 1px solid var(--border-secondary-color);
  border-radius: 12px;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 350px;
  max-height: 500px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  height: 100%;
}

.empty-chat-hero {
  text-align: center;
  color: var(--fg-secondary-color);

  h3 {
    margin: 12px 0 6px;
    font-size: 1.15rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
  p {
    font-size: 0.9rem;
    margin: 0;
  }
}

.quick-prompts-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 80%;
}

.quick-prompt-pill {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-secondary-color);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--bg-hover-color);
    color: var(--fg-primary-color);
    border-color: var(--fg-accent-color);
    transform: translateY(-1px);
  }
}

.chat-message {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;

  &.user {
    justify-content: flex-end;
    .message-bubble {
      background-color: rgba(var(--fg-accent-color-rgb), 0.08);
      border: 1px solid rgba(var(--fg-accent-color-rgb), 0.2);
      border-radius: 12px 12px 2px 12px;
    }
    .message-sender-label {
      text-align: right;
      color: var(--fg-accent-color);
    }
  }

  &.ai {
    justify-content: flex-start;
    .message-bubble {
      background-color: var(--bg-secondary-color);
      border: 1px solid var(--border-primary-color);
      border-radius: 12px 12px 12px 2px;

      &.loading {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--fg-muted-color);
        font-style: italic;
      }
    }
  }
}

.ai-label-icon {
  font-size: 0.9rem;
  vertical-align: middle;
}

.message-sender-label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--fg-secondary-color);
  margin-bottom: 2px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.message-bubble {
  max-width: 85%;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 0.95rem;
  line-height: 1.45;
  word-break: break-word;
}

.message-content {
  :deep(h1),
  :deep(h2),
  :deep(h3) {
    margin: 12px 0 6px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--fg-primary-color);
  }
  :deep(strong) {
    font-weight: 600;
    color: var(--fg-accent-color);
  }
  :deep(em) {
    font-style: italic;
  }
  :deep(code.chat-code) {
    background-color: var(--bg-hover-color);
    color: var(--fg-accent-color);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }
  :deep(.chat-code-block) {
    background-color: var(--bg-primary-color);
    border: 1px solid var(--border-secondary-color);
    border-radius: 6px;
    padding: 10px;
    margin: 8px 0;
    overflow-x: auto;
  }

  /* Стили для корректного отображения списков */
  :deep(ul),
  :deep(ol) {
    margin: 8px 0;
    padding-left: 24px;
  }
  :deep(li) {
    margin-bottom: 4px;
    line-height: 1.4;
    list-style-type: disc;

    &:last-child {
      margin-bottom: 0;
    }
  }
  :deep(p) {
    margin-top: 0;
    margin-bottom: 8px;
    &:last-child {
      margin-bottom: 0;
    }
  }
}

.chat-input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .selected-prompt-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background-color: var(--bg-hover-color);
      border: 1px solid var(--border-primary-color);
      border-radius: 4px;
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
      align-self: flex-start;

      .badge-text {
        max-width: 200px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }

  .chat-textarea {
    width: 100%;
    resize: none;
  }
}

.prompt-dropdown-menu {
  display: flex;
  flex-direction: column;
  padding: 4px 0;

  .dropdown-item {
    padding: 8px 12px;
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    transition: background-color 0.2s;

    &:hover {
      background-color: var(--bg-hover-color);
    }

    &.active {
      color: var(--fg-accent-color);
      font-weight: 500;
    }

    &.custom-prompts-btn {
      color: var(--fg-secondary-color);
      margin-top: 4px;
      &:hover {
        color: var(--fg-primary-color);
      }
    }
  }

  .dropdown-divider {
    height: 1px;
    background-color: var(--border-primary-color);
    margin: 4px 0;
  }
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
  }
}

.prompt-manager-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prompt-manager-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background-color: var(--bg-secondary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 6px;
  gap: 8px;

  .prompt-name {
    font-size: 0.9rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .prompt-actions {
    display: flex;
    gap: 4px;
  }
}

.add-prompt-btn {
  margin-top: 8px;
  width: 100%;
}

.prompt-form {
  display: flex;
  flex-direction: column;
  gap: 12px;

  h4 {
    margin: 0 0 4px;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;

    label {
      font-size: 0.8rem;
      color: var(--fg-secondary-color);
    }
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
}

.custom-textarea {
  width: 100%;
  background-color: var(--bg-primary-color);
  color: var(--fg-primary-color);
  border: 1px solid var(--border-primary-color);
  border-radius: 6px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s;
  &:focus {
    border-color: var(--fg-accent-color);
  }
}

@media (max-width: 650px) {
  .chat-modal-layout {
    &.with-sidebar {
      .chat-main-panel {
        display: none;
      }

      .chat-sidebar-panel {
        flex: 1 1 100%;
        border-left: none;
        padding-left: 0;
      }
    }
  }
}
</style>
