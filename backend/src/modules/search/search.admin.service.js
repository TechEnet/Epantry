import {
  AIInteraction,
} from './search.models.js'

function clampInteger(
  value,
  fallback,
  min,
  max,
) {
  const parsed =
    Number(
      value,
    )

  if (
    !Number.isInteger(
      parsed,
    )
  ) {
    return fallback
  }

  return Math.min(
    max,
    Math.max(
      min,
      parsed,
    ),
  )
}

function serializeInteraction(
  row,
) {
  const epantryMeta =
    row?.usage?.epantry ||
    {}

  return {
    id:
      String(
        row._id,
      ),

    sessionId:
      row.sessionId
        ? String(
            row.sessionId,
          )
        : null,

    actorType:
      epantryMeta.actorType ||
      'unknown',

    interactionType:
      row.interactionType,

    provider:
      row.provider,

    modelId:
      row.modelId,

    promptVersion:
      row.promptVersion,

    status:
      row.status,

    toolNames:
      row.toolNames ||
      [],

    sourceIds:
      epantryMeta.sourceIds ||
      [],

    fallbackCode:
      epantryMeta.fallbackCode ||
      null,

    errorCode:
      epantryMeta.errorCode ||
      null,

    confidence:
      epantryMeta.confidence ??
      null,

    latencyMs:
      row.latencyMs ??
      null,

    usage:
      row?.usage?.providerUsage ||
      null,

    recordedAt:
      row.recordedAt ||
      row.createdAt ||
      null,
  }
}

export async function listSearchAiQuality({
  page =
    1,
  limit =
    25,
  status,
}) {
  const normalizedPage =
    clampInteger(
      page,
      1,
      1,
      10_000,
    )

  const normalizedLimit =
    clampInteger(
      limit,
      25,
      1,
      50,
    )

  const filter = {
    interactionType:
      'copilot_message',
  }

  if (
    status &&
    [
      'succeeded',
      'failed',
      'fallback',
    ].includes(
      status,
    )
  ) {
    filter.status =
      status
  }

  const baseFilter = {
    interactionType:
      'copilot_message',
  }

  const [
    rows,
    total,
    succeeded,
    fallback,
    failed,
  ] =
    await Promise.all([
      AIInteraction.find(
        filter,
      )
        .sort({
          recordedAt:
            -1,

          _id:
            -1,
        })
        .skip(
          (
            normalizedPage -
            1
          ) *
            normalizedLimit,
        )
        .limit(
          normalizedLimit,
        )
        .lean(),

      AIInteraction.countDocuments(
        filter,
      ),

      AIInteraction.countDocuments({
        ...baseFilter,

        status:
          'succeeded',
      }),

      AIInteraction.countDocuments({
        ...baseFilter,

        status:
          'fallback',
      }),

      AIInteraction.countDocuments({
        ...baseFilter,

        status:
          'failed',
      }),
    ])

  return {
    items:
      rows.map(
        serializeInteraction,
      ),

    pagination: {
      page:
        normalizedPage,

      limit:
        normalizedLimit,

      total,

      pages:
        total ===
        0
          ? 0
          : Math.ceil(
              total /
                normalizedLimit,
            ),
    },

    summary: {
      succeeded,
      fallback,
      failed,

      total:
        succeeded +
        fallback +
        failed,
    },
  }
}