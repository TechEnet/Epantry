import {
  createOpenRouterChatCompletion,
  getOpenRouterConfig,
  isOpenRouterConfigured,
} from '../../integrations/ai/ai.provider.js'

import {
  ApiError,
} from '../../utils/ApiError.js'

import {
  redactSearchTextForPersistence,
} from './search.engine.js'

import {
  AIInteraction,
} from './search.models.js'

import {
  createSmartSearch,
} from './search.service.js'

import {
  COPILOT_FINALIZATION_PROMPT,
  COPILOT_PROMPT_VERSION,
  COPILOT_SYSTEM_PROMPT,
} from './search.copilot.prompts.js'

import {
  COPILOT_TOOL_DEFINITIONS,
  executeCopilotToolCall,
} from './search.copilot.tools.js'

const MAX_HISTORY_MESSAGES =
  8

const MAX_TOOL_CALLS =
  3

const CRITICAL_CLAIM_PATTERN =
  /(?:₹|\brs\.?\b|\bprice\b|\bcheapest\b|\bstock\b|\binventory\b|\bdelivery fee\b|\bpaid\b|\bpayment\b|\ballergen[- ]?free\b|\b(?:completely|100%) safe\b|\bexact quantity\b)/i

function normalizeActorType(
  actorContext,
) {
  if (
    actorContext?.actorType ===
    'customer'
  ) {
    return 'customer'
  }

  if (
    actorContext?.actorType ===
    'authenticated_non_customer'
  ) {
    return 'authenticated_non_customer'
  }

  return 'guest'
}

function sanitizeHistory(
  history,
) {
  if (
    !Array.isArray(
      history,
    )
  ) {
    return []
  }

  return history
    .slice(
      -MAX_HISTORY_MESSAGES,
    )
    .map(
      (
        item,
      ) => ({
        role:
          item.role ===
          'assistant'
            ? 'assistant'
            : 'user',

        content:
          String(
            item.content ||
              '',
          )
            .trim()
            .slice(
              0,
              1_500,
            ),
      }),
    )
    .filter(
      (
        item,
      ) =>
        item.content,
    )
}

function serializeToolResultForModel(
  result,
) {
  return JSON.stringify(
    {
      toolName:
        result.toolName,

      result:
        result.result,
    },
  ).slice(
    0,
    18_000,
  )
}

function mergeSourceCards(
  values,
) {
  const byKey =
    new Map()

  for (
    const value
    of values ||
    []
  ) {
    if (
      !value?.type ||
      !value?.id
    ) {
      continue
    }

    const key =
      `${value.type}:${value.id}`

    if (
      !byKey.has(
        key,
      )
    ) {
      byKey.set(
        key,
        value,
      )
    }
  }

  return [
    ...byKey.values(),
  ].slice(
    0,
    10,
  )
}

function extractSourceIds(
  sourceCards,
) {
  return mergeSourceCards(
    sourceCards,
  ).map(
    (
      item,
    ) =>
      `${item.type}:${item.id}`,
  )
}

function getAssistantContent(
  message,
) {
  if (
    typeof message?.content ===
    'string'
  ) {
    return message.content
      .trim()
      .slice(
        0,
        4_000,
      )
  }

  return ''
}

function answerLooksUnsafe(
  content,
) {
  return Boolean(
    content &&
    CRITICAL_CLAIM_PATTERN.test(
      content,
    ),
  )
}

function buildDeterministicSearchSummary(
  searchResult,
) {
  const results =
    searchResult?.results ||
    []

  if (
    results.length ===
    0
  ) {
    return 'OpenRouter is unavailable right now. EPANTRY deterministic Search also found no trustworthy match for this request. Try a broader dish or ingredient, or remove one hard constraint.'
  }

  const names =
    results
      .slice(
        0,
        3,
      )
      .map(
        (
          item,
        ) =>
          item.displayName,
      )
      .filter(
        Boolean,
      )

  return `OpenRouter is unavailable right now, so I used EPANTRY deterministic Search instead. Top trustworthy matches: ${names.join(', ')}.`
}

async function createFallbackSearch({
  message,
  actorContext,
  fallbackCode,
}) {
  try {
    const searchResult =
      await createSmartSearch({
        query:
          message,

        mode:
          'all',

        actorContext,
      })

    return {
      assistantMessage:
        buildDeterministicSearchSummary(
          searchResult,
        ),

      mode:
        'fallback',

      fallbackCode,

      toolsUsed: [
        'search_epantry',
      ],

      sourceCards:
        (
          searchResult?.results ||
          []
        )
          .slice(
            0,
            8,
          )
          .map(
            (
              item,
            ) => ({
              type:
                item.type,

              id:
                item.id,

              title:
                item.displayName,

              subtitle:
                item.subtitle ||
                null,

              path:
                item.path ||
                null,

              reasonCodes:
                item.reasonCodes ||
                [],
            }),
          ),

      searchSession:
        searchResult?.session ||
        null,
    }
  } catch {
    return {
      assistantMessage:
        'Food Copilot is temporarily unavailable. Normal EPANTRY Search, Recipes, Pantry, Cart and Orders still work. Please use Smart Search or try again later.',

      mode:
        'fallback',

      fallbackCode,

      toolsUsed:
        [],

      sourceCards:
        [],

      searchSession:
        null,
    }
  }
}

async function recordInteraction({
  actorContext,
  sessionId,
  modelId,
  status,
  toolNames,
  sourceCards,
  fallbackCode,
  errorCode,
  confidence,
  latencyMs,
  usage,
}) {
  try {
    await AIInteraction.create({
      sessionId:
        sessionId ||
        null,

      interactionType:
        'copilot_message',

      provider:
        'openrouter',

      modelId:
        modelId ||
        null,

      promptVersion:
        COPILOT_PROMPT_VERSION,

      status,

      toolNames: [
        ...new Set(
          toolNames ||
            [],
        ),
      ],

      latencyMs:
        latencyMs ??
        null,

      usage: {
        providerUsage:
          usage ||
          null,

        epantry: {
          actorType:
            normalizeActorType(
              actorContext,
            ),

          sourceIds:
            extractSourceIds(
              sourceCards,
            ),

          fallbackCode:
            fallbackCode ||
            null,

          errorCode:
            errorCode ||
            null,

          confidence:
            confidence ??
            null,
        },
      },

      recordedAt:
        new Date(),
    })
  } catch {
    // Quality logging must never break the customer-facing Copilot response.
  }
}

function buildModelMessages({
  message,
  history,
}) {
  return [
    {
      role:
        'system',

      content:
        COPILOT_SYSTEM_PROMPT,
    },

    ...sanitizeHistory(
      history,
    ),

    {
      role:
        'user',

      content:
        message,
    },
  ]
}

function sanitizeUserMessage(
  value,
) {
  const message =
    String(
      value ||
        '',
    )
      .trim()
      .slice(
        0,
        1_500,
      )

  if (
    message.length <
    1
  ) {
    throw new ApiError(
      400,
      'A Copilot message is required.',
      [
        {
          code:
            'COPILOT_MESSAGE_REQUIRED',
        },
      ],
    )
  }

  return message
}

export async function sendFoodCopilotMessage({
  message,
  history,
  searchSession,
  actorContext,
}) {
  const normalizedMessage =
    sanitizeUserMessage(
      message,
    )

  const persistedMessage =
    redactSearchTextForPersistence(
      normalizedMessage,
    )

  const startedAt =
    Date.now()

  const config =
    getOpenRouterConfig(
      'copilot',
    )

  if (
    !isOpenRouterConfigured(
      'copilot',
    )
  ) {
    const fallback =
      await createFallbackSearch({
        message:
          persistedMessage,

        actorContext,

        fallbackCode:
          'OPENROUTER_NOT_CONFIGURED',
      })

    await recordInteraction({
      actorContext,

      sessionId:
        fallback.searchSession?.id ||
        searchSession?.id ||
        null,

      modelId:
        config.model ||
        null,

      status:
        'fallback',

      toolNames:
        fallback.toolsUsed,

      sourceCards:
        fallback.sourceCards,

      fallbackCode:
        fallback.fallbackCode,

      latencyMs:
        Date.now() -
        startedAt,
    })

    return {
      ...fallback,

      modelId:
        null,

      promptVersion:
        COPILOT_PROMPT_VERSION,

      safety: {
        deterministicFactsOnly:
          true,

        criticalClaimsValidated:
          true,
      },
    }
  }

  let activeSearchSession =
    searchSession ||
    null

  let modelId =
    config.model

  let totalLatencyMs =
    0

  let usage =
    null

  const toolsUsed = []
  const sourceCards = []

  try {
    const messages =
      buildModelMessages({
        message:
          normalizedMessage,

        history,
      })

    const firstResponse =
      await createOpenRouterChatCompletion({
        task:
          'copilot',

        messages,

        tools:
          COPILOT_TOOL_DEFINITIONS,

        toolChoice:
          'auto',

        temperature:
          0.15,
      })

    modelId =
      firstResponse.modelId ||
      modelId

    totalLatencyMs +=
      firstResponse.latencyMs ||
      0

    usage =
      firstResponse.usage ||
      usage

    const toolCalls =
      Array.isArray(
        firstResponse.message
          ?.tool_calls,
      )
        ? firstResponse.message.tool_calls.slice(
            0,
            MAX_TOOL_CALLS,
          )
        : []

    if (
      toolCalls.length ===
      0
    ) {
      const directAnswer =
        getAssistantContent(
          firstResponse.message,
        )

      const assistantMessage =
        directAnswer &&
        !answerLooksUnsafe(
          directAnswer,
        )
          ? directAnswer
          : 'I can help through EPANTRY Search, Recipe and Pantry tools, but I cannot verify that requested fact without deterministic platform evidence. Try asking me to search, refine a result, scale a Recipe, or check Recipe readiness against your Pantry.'

      await recordInteraction({
        actorContext,

        sessionId:
          activeSearchSession?.id ||
          null,

        modelId,

        status:
          'succeeded',

        toolNames:
          [],

        sourceCards:
          [],

        confidence:
          0.55,

        latencyMs:
          totalLatencyMs,

        usage,
      })

      return {
        assistantMessage,

        mode:
          'ai',

        fallbackCode:
          null,

        modelId,

        promptVersion:
          COPILOT_PROMPT_VERSION,

        toolsUsed:
          [],

        sourceCards:
          [],

        searchSession:
          activeSearchSession,

        safety: {
          deterministicFactsOnly:
            true,

          criticalClaimsValidated:
            true,
        },
      }
    }

    messages.push(
      firstResponse.message,
    )

    for (
      const toolCall
      of toolCalls
    ) {
      const toolName =
        toolCall?.function?.name

      if (
        !toolName ||
        !toolCall?.id
      ) {
        throw new ApiError(
          400,
          'Copilot returned an invalid tool call.',
          [
            {
              code:
                'COPILOT_TOOL_CALL_INVALID',
            },
          ],
        )
      }

      const executed =
        await executeCopilotToolCall({
          toolName,

          rawArguments:
            toolCall.function
              ?.arguments,

          context: {
            actorContext,

            searchSession:
              activeSearchSession,
          },
        })

      toolsUsed.push(
        toolName,
      )

      sourceCards.push(
        ...(
          executed.sourceCards ||
          []
        ),
      )

      if (
        executed.nextSearchSession
      ) {
        activeSearchSession =
          executed.nextSearchSession
      }

      messages.push({
        role:
          'tool',

        tool_call_id:
          toolCall.id,

        content:
          serializeToolResultForModel(
            executed,
          ),
      })
    }

    messages.push({
      role:
        'system',

      content:
        COPILOT_FINALIZATION_PROMPT,
    })

    const finalResponse =
      await createOpenRouterChatCompletion({
        task:
          'copilot',

        messages,

        temperature:
          0.1,
      })

    modelId =
      finalResponse.modelId ||
      modelId

    totalLatencyMs +=
      finalResponse.latencyMs ||
      0

    usage = {
      first:
        usage,

      final:
        finalResponse.usage ||
        null,
    }

    const generatedAnswer =
      getAssistantContent(
        finalResponse.message,
      )

    const assistantMessage =
      generatedAnswer &&
      !answerLooksUnsafe(
        generatedAnswer,
      )
        ? generatedAnswer
        : 'I used EPANTRY deterministic tools for this request. Please use the verified result cards below for the factual details; I will not restate an unverified critical claim.'

    const mergedCards =
      mergeSourceCards(
        sourceCards,
      )

    await recordInteraction({
      actorContext,

      sessionId:
        activeSearchSession?.id ||
        null,

      modelId,

      status:
        'succeeded',

      toolNames:
        toolsUsed,

      sourceCards:
        mergedCards,

      confidence:
        mergedCards.length >
        0
          ? 0.9
          : 0.6,

      latencyMs:
        totalLatencyMs,

      usage,
    })

    return {
      assistantMessage,

      mode:
        'ai',

      fallbackCode:
        null,

      modelId,

      promptVersion:
        COPILOT_PROMPT_VERSION,

      toolsUsed: [
        ...new Set(
          toolsUsed,
        ),
      ],

      sourceCards:
        mergedCards,

      searchSession:
        activeSearchSession,

      safety: {
        deterministicFactsOnly:
          true,

        criticalClaimsValidated:
          true,
      },
    }
  } catch (
    error
  ) {
    const fallbackCode =
      error?.code ||
      'OPENROUTER_OR_TOOL_FAILURE'

    const fallback =
      await createFallbackSearch({
        message:
          persistedMessage,

        actorContext,

        fallbackCode,
      })

    const mergedCards =
      mergeSourceCards([
        ...sourceCards,
        ...(
          fallback.sourceCards ||
          []
        ),
      ])

    const mergedTools = [
      ...new Set([
        ...toolsUsed,
        ...(
          fallback.toolsUsed ||
          []
        ),
      ]),
    ]

    await recordInteraction({
      actorContext,

      sessionId:
        fallback.searchSession?.id ||
        activeSearchSession?.id ||
        null,

      modelId,

      status:
        'fallback',

      toolNames:
        mergedTools,

      sourceCards:
        mergedCards,

      fallbackCode,

      errorCode:
        error?.code ||
        null,

      latencyMs:
        Date.now() -
        startedAt,

      usage,
    })

    return {
      ...fallback,

      toolsUsed:
        mergedTools,

      sourceCards:
        mergedCards,

      searchSession:
        fallback.searchSession ||
        activeSearchSession,

      modelId:
        modelId ||
        null,

      promptVersion:
        COPILOT_PROMPT_VERSION,

      safety: {
        deterministicFactsOnly:
          true,

        criticalClaimsValidated:
          true,
      },
    }
  }
}