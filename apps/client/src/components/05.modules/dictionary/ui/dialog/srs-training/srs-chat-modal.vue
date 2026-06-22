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

  // eslint-disable-next-line regexp/no-super-linear-backtracking
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

  // Извлекаем инлайн-код
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

  // Базовый Markdown
  processed = processed
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    .replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>') // Списки через дефис
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    .replace(/^\s*\*\s+(.*)$/gm, '<li>$1</li>') // Списки через звездочку

  // Заменяем переносы строк на <br>, кроме мест, где мы уже вставили HTML теги
  processed = processed.replace(/\n/g, '<br>')

  // Возвращаем блоки кода на место
  for (let i = 0; i < blocks.length; i++) {
    processed = processed.replace(`__BLOCK_PLACEHOLDER_${i}__`, blocks[i])
  }

  // Очищаем итоговый HTML, разрешая безопасные теги (DOMPurify делает это по умолчанию)
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
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-primary-color);
  font-size: 0.95rem;
  line-height: 1.45;
  word-break: break-word;
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

<style lang="scss">
@keyframes markdown-appear {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-content {
  animation: markdown-appear 0.4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
  line-height: 1.7;
  color: var(--fg-primary-color);
  font-size: 1.05rem;

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-weight: 600;
    line-height: 1.3;
    color: var(--fg-primary-color);

    a {
      border-bottom: none;
      &:hover {
        background-color: transparent;
        border-bottom-color: transparent;
      }
    }
  }
  h1 {
    font-size: 2rem;
    border-bottom: 1px solid var(--border-secondary-color);
    padding-bottom: 0.5rem;
  }
  h2 {
    font-size: 1.5rem;
    border: none;
    border-left: 4px solid var(--fg-accent-color);
    background: linear-gradient(90deg, rgba(var(--bg-accent-color-rgb), 0.5) 0%, transparent 100%);
    padding: 0.5rem 1rem;
    border-radius: 0 8px 8px 0;
  }
  h3 {
    font-size: 1.25rem;
    border: none;
    border-bottom: 2px solid var(--border-secondary-color);
    padding-bottom: 0.3rem;
    width: fit-content;
    padding-right: 20px;
  }
  p {
    margin-bottom: 1.2rem;
  }
  p + ul {
    padding-top: 0;
  }
  strong {
    color: var(--fg-primary-color);
    font-weight: 700;
  }
  a {
    color: var(--fg-accent-color);
    font-weight: 500;
    text-decoration: none;
    border-bottom: 1px solid rgba(var(--fg-accent-color-rgb), 0.4);
    transition: all 0.2s ease-in-out;
    &:hover {
      background-color: rgba(var(--fg-accent-color-rgb), 0.1);
      border-bottom-color: var(--fg-accent-color);
    }
  }
  em {
    color: var(--fg-accent-color);
    font-style: italic;
  }
  code:not(pre > code) {
    background-color: rgba(var(--fg-accent-color-rgb), 0.1);
    border: 1px solid rgba(var(--fg-accent-color-rgb), 0.2);
    color: var(--fg-accent-color);
    padding: 0.1em 0.4em;
    margin: 0 0.1em;
    font-size: 0.9em;
    border-radius: 6px;
    font-family: 'Maple Mono CN', 'JetBrains Mono', monospace;
    font-weight: 600;
    vertical-align: baseline;
    display: inline-block;
  }
  pre {
    background: var(--bg-tertiary-color);
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    code {
      font-family: 'Maple Mono CN', 'JetBrains Mono', monospace;
      background: transparent;
      padding: 0;
      color: inherit;
      border: none;
    }
  }
  ul,
  ol {
    padding-left: 1.5rem;
    margin-bottom: 1.5rem;
    > li {
      ul {
        margin: 0;
      }
    }
  }
  ul > li {
    list-style-type: disc;
    margin-bottom: 0.5rem;
    &::marker {
      color: var(--fg-accent-color);
    }
  }
  blockquote {
    border-left: 4px solid var(--fg-accent-color);
    background-color: var(--bg-secondary-color);
    padding: 1rem 1.5rem;
    border-radius: 0 8px 8px 0;
    margin: 1.5rem 0;
    font-style: italic;
    color: var(--fg-secondary-color);
    p {
      margin: 0;
    }
  }
  img {
    border-radius: 8px;
    max-width: 100%;
    height: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    margin: 1rem 0;
  }
  .table-container {
    display: block;
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 2rem 0;
    border-radius: 8px;
    box-shadow: 0 0 0 1px var(--border-secondary-color);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }
  th {
    background-color: var(--bg-tertiary-color);
    text-align: left;
    padding: 12px 16px;
    font-weight: 600;
    border-bottom: 2px solid var(--border-secondary-color);
  }
  td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-secondary-color);
  }
  tr:last-child td {
    border-bottom: none;
  }
  tr:hover td {
    background-color: var(--bg-hover-color);
  }
}
</style>
