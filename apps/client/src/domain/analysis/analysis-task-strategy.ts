import type { LlmAnalysis } from '~/shared/types/models'

export interface AnalysisTask {
  id: string
  type: 'sentence' | 'word' | 'tts_sentence' | 'tts_word'
  text: string
  context?: string
  priority: number
  status: 'pending' | 'checking_cache' | 'pending_llm' | 'processing' | 'done' | 'error'
}

export interface TaskHandlerContext {
  repos: any
  t: (key: string) => string
  trackEvent: (event: string, data?: any) => void
  addAnalysisHistory: (sentence: string, analysis: LlmAnalysis) => void
}

export interface TaskHandler {
  canHandle: (task: AnalysisTask) => boolean
  handle: (task: AnalysisTask, ctx: TaskHandlerContext) => Promise<void>
}

export class SentenceTaskHandler implements TaskHandler {
  canHandle(task: AnalysisTask): boolean {
    return task.type === 'sentence'
  }

  async handle(task: AnalysisTask, ctx: TaskHandlerContext): Promise<void> {
    const analysis = await ctx.repos.analysis.analyzeSentence({
      sentence: task.text,
      context: task.context,
    })
    if (analysis) {
      ctx.addAnalysisHistory(task.text, analysis)
      ctx.trackEvent('queue_sentence_analyzed', { textLength: task.text.length })
    }
  }
}

export class WordTaskHandler implements TaskHandler {
  canHandle(task: AnalysisTask): boolean {
    return task.type === 'word'
  }

  async handle(task: AnalysisTask, ctx: TaskHandlerContext): Promise<void> {
    await ctx.repos.analysis.getWordDetails({
      word: task.text,
      contextSentence: task.context,
    })
    ctx.trackEvent('queue_word_analyzed', { word: task.text })
  }
}

export class TtsSentenceTaskHandler implements TaskHandler {
  canHandle(task: AnalysisTask): boolean {
    return task.type === 'tts_sentence'
  }

  async handle(task: AnalysisTask, ctx: TaskHandlerContext): Promise<void> {
    await ctx.repos.analysis.synthesizeTts({
      text: task.text,
    })
    ctx.trackEvent('queue_tts_sentence_synthesized', { textLength: task.text.length })
  }
}

export class TtsWordTaskHandler implements TaskHandler {
  canHandle(task: AnalysisTask): boolean {
    return task.type === 'tts_word'
  }

  async handle(task: AnalysisTask, ctx: TaskHandlerContext): Promise<void> {
    await ctx.repos.analysis.synthesizeTts({
      text: task.text,
    })
    ctx.trackEvent('queue_tts_word_synthesized', { word: task.text })
  }
}

export class TaskHandlerRegistry {
  private handlers: TaskHandler[] = [
    new SentenceTaskHandler(),
    new WordTaskHandler(),
    new TtsSentenceTaskHandler(),
    new TtsWordTaskHandler(),
  ]

  public getHandler(task: AnalysisTask): TaskHandler | undefined {
    return this.handlers.find(h => h.canHandle(task))
  }

  public registerHandler(handler: TaskHandler): void {
    this.handlers.push(handler)
  }
}

export const defaultTaskHandlerRegistry = new TaskHandlerRegistry()
