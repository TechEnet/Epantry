const DEFAULT_OPENROUTER_BASE_URL =
  'https://openrouter.ai/api/v1'

const DEFAULT_TIMEOUT_MS =
  20_000

const DEFAULT_MAX_TOKENS =
  700

function normalizeString(
  value,
) {
  return String(
    value ||
      '',
  ).trim()
}

function positiveInteger(
  value,
  fallback,
  max,
) {
  const parsed =
    Number(
      value,
    )

  if (
    !Number.isInteger(
      parsed,
    ) ||
    parsed <=
      0
  ) {
    return fallback
  }

  return Math.min(
    parsed,
    max,
  )
}

function stripTrailingSlash(
  value,
) {
  return normalizeString(
    value,
  ).replace(
    /\/+$/,
    '',
  )
}

export function getOpenRouterConfig(
  task =
    'copilot',
) {
  const model =
    task ===
    'intent'
      ? normalizeString(
          process.env.OPENROUTER_INTENT_MODEL,
        )
      : normalizeString(
          process.env.OPENROUTER_COPILOT_MODEL,
        )

  return {
    apiKey:
      normalizeString(
        process.env.OPENROUTER_API_KEY,
      ),

    baseUrl:
      stripTrailingSlash(
        process.env.OPENROUTER_BASE_URL ||
          DEFAULT_OPENROUTER_BASE_URL,
      ),

    model,

    timeoutMs:
      positiveInteger(
        process.env.OPENROUTER_TIMEOUT_MS,
        DEFAULT_TIMEOUT_MS,
        60_000,
      ),

    maxTokens:
      positiveInteger(
        process.env.OPENROUTER_MAX_TOKENS,
        DEFAULT_MAX_TOKENS,
        2_000,
      ),

    siteUrl:
      normalizeString(
        process.env.FRONTEND_URL,
      ),

    appTitle:
      normalizeString(
        process.env.OPENROUTER_APP_TITLE,
      ) ||
      'EPANTRY',
  }
}

export function isOpenRouterConfigured(
  task =
    'copilot',
) {
  const config =
    getOpenRouterConfig(
      task,
    )

  return Boolean(
    config.apiKey &&
    config.model,
  )
}

function sanitizeMessages(
  messages,
) {
  if (
    !Array.isArray(
      messages,
    ) ||
    messages.length ===
      0
  ) {
    throw new Error(
      'OpenRouter messages are required.',
    )
  }

  return messages
    .slice(
      -20,
    )
    .map(
      (
        message,
      ) => ({
        ...message,

        content:
          typeof message.content ===
          'string'
            ? message.content.slice(
                0,
                8_000,
              )
            : message.content,
      }),
    )
}

function normalizeToolDefinitions(
  tools,
) {
  if (
    !Array.isArray(
      tools,
    ) ||
    tools.length ===
      0
  ) {
    return undefined
  }

  return tools.slice(
    0,
    12,
  )
}

function normalizeUsage(
  usage,
) {
  if (
    !usage ||
    typeof usage !==
      'object'
  ) {
    return null
  }

  return {
    promptTokens:
      Number.isFinite(
        Number(
          usage.prompt_tokens,
        ),
      )
        ? Number(
            usage.prompt_tokens,
          )
        : null,

    completionTokens:
      Number.isFinite(
        Number(
          usage.completion_tokens,
        ),
      )
        ? Number(
            usage.completion_tokens,
          )
        : null,

    totalTokens:
      Number.isFinite(
        Number(
          usage.total_tokens,
        ),
      )
        ? Number(
            usage.total_tokens,
          )
        : null,
  }
}

export async function createOpenRouterChatCompletion({
  task =
    'copilot',
  model,
  messages,
  tools,
  toolChoice,
  responseFormat,
  temperature =
    0.2,
  maxTokens,
  timeoutMs,
}) {
  const config =
    getOpenRouterConfig(
      task,
    )

  const requestedModel =
    normalizeString(
      model,
    ) ||
    config.model

  if (
    !config.apiKey ||
    !requestedModel
  ) {
    const error =
      new Error(
        'OpenRouter is not configured.',
      )

    error.code =
      'OPENROUTER_NOT_CONFIGURED'

    throw error
  }

  const controller =
    new AbortController()

  const requestTimeoutMs =
    positiveInteger(
      timeoutMs,
      config.timeoutMs,
      90_000,
    )

  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      requestTimeoutMs,
    )

  const body = {
    model:
      requestedModel,

    messages:
      sanitizeMessages(
        messages,
      ),

    temperature:
      Number.isFinite(
        Number(
          temperature,
        ),
      )
        ? Number(
            temperature,
          )
        : 0.2,

    max_tokens:
      positiveInteger(
        maxTokens,
        config.maxTokens,
        2_000,
      ),

    stream:
      false,
  }

  const normalizedTools =
    normalizeToolDefinitions(
      tools,
    )

  if (
    normalizedTools
  ) {
    body.tools =
      normalizedTools

    body.tool_choice =
      toolChoice ||
      'auto'

    body.provider = {
      require_parameters:
        true,
    }
  }

  if (
    responseFormat
  ) {
    body.response_format =
      responseFormat

    body.provider = {
      ...(body.provider || {}),

      require_parameters:
        true,
    }
  }

  const headers = {
    Authorization:
      `Bearer ${config.apiKey}`,

    'Content-Type':
      'application/json',

    'X-Title':
      config.appTitle,
  }

  if (
    config.siteUrl
  ) {
    headers['HTTP-Referer'] =
      config.siteUrl
  }

  const startedAt =
    Date.now()

  try {
    const response =
      await fetch(
        `${config.baseUrl}/chat/completions`,
        {
          method:
            'POST',

          headers,

          body:
            JSON.stringify(
              body,
            ),

          signal:
            controller.signal,
        },
      )

    const rawText =
      await response.text()

    let payload =
      null

    try {
      payload =
        rawText
          ? JSON.parse(
              rawText,
            )
          : null
    } catch {
      payload =
        null
    }

    if (
      !response.ok
    ) {
      const error =
        new Error(
          payload?.error?.message ||
          `OpenRouter request failed with status ${response.status}.`,
        )

      error.code =
        'OPENROUTER_REQUEST_FAILED'

      error.status =
        response.status

      throw error
    }

    const message =
      payload?.choices?.[0]
        ?.message

    if (
      !message
    ) {
      const error =
        new Error(
          'OpenRouter returned no assistant message.',
        )

      error.code =
        'OPENROUTER_EMPTY_RESPONSE'

      throw error
    }

    return {
      modelId:
        payload?.model ||
        requestedModel,

      message,

      finishReason:
        payload?.choices?.[0]
          ?.finish_reason ||
        null,

      usage:
        normalizeUsage(
          payload?.usage,
        ),

      latencyMs:
        Date.now() -
        startedAt,
    }
  } catch (
    error
  ) {
    if (
      error?.name ===
      'AbortError'
    ) {
      const timeoutError =
        new Error(
          'OpenRouter request timed out.',
        )

      timeoutError.code =
        'OPENROUTER_TIMEOUT'

      throw timeoutError
    }

    throw error
  } finally {
    clearTimeout(
      timeout,
    )
  }
}

export class AiProvider {
  async generate(
    options,
  ) {
    return createOpenRouterChatCompletion(
      options,
    )
  }
}

export const aiProvider =
  new AiProvider()