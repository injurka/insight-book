import type { ModelMessage } from 'ai';
import type { LlmConfig } from '~/types';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

async function callLlmApi(
  modelName: string,
  messages: ModelMessage[],
  temperature: number,
  signal: AbortSignal,
  config: LlmConfig,
) {
  const customFetch: typeof globalThis.fetch = async (...args) => {
    const [input, init] = args;
    const requestInit: RequestInit | undefined = init ? { ...init } : undefined;

    if (requestInit?.body && typeof requestInit.body === 'string') {
      try {
        const body = JSON.parse(requestInit.body);

        body.response_format = { type: 'json_object' };

        const isOllama =
          config.url.includes('11434') || config.url.includes('localhost');
        if (isOllama) {
          body.keep_alive = '-1';
          body.options = {
            num_ctx: 8192,
            stream: false,
          };
        }

        const isAggregator =
          config.isAggregator ||
          config.url.includes('openrouter.ai') ||
          config.url.includes('aihubmix');
        if (isAggregator) {
          body.thinking_config = { thinking_budget: 0 };
          body.providerOptions = {
            google: { thinkingConfig: { thinkingBudget: 0 } },
            anthropic: { thinking: { type: 'disabled' } },
          };
        }

        if (modelName.startsWith('o1') || modelName.startsWith('o3')) {
          body.reasoning_effort = 'low';
        }
        else if (isAggregator) {
          body.reasoning_effort = 'none';
        }

        if (
          body.max_tokens == null &&
          body.max_completion_tokens == null &&
          body.max_output_tokens == null
        ) {
          body.max_tokens = 8192;
        }

        requestInit.body = JSON.stringify(body);
      }
      catch (err) {
        console.warn('[callLlmApi] Не удалось модифицировать тело запроса', err);
      }
    }

    return globalThis.fetch(input, requestInit);
  };

  customFetch.preconnect =
    (globalThis.fetch.preconnect?.bind(globalThis.fetch) ??
      (async () => { })) as typeof globalThis.fetch.preconnect;

  const openaiProvider = createOpenAI({
    baseURL: config.url,
    apiKey: config.key || '',
    compatibility: 'compatible',
    fetch: customFetch,
  });

  try {
    const { text } = await generateText({
      model: openaiProvider(modelName),
      messages,
      temperature,
      abortSignal: signal,
    });

    return text;
  }
  catch (error: any) {
    throw new Error(
      `AI SDK Error [${modelName}]: ${error.message || JSON.stringify(error)}`,
    );
  }
}

export { callLlmApi };
