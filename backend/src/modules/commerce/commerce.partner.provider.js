import {
  ApiError,
} from '../../utils/ApiError.js'

function readRegistry() {
  let parsed

  try {
    parsed =
      JSON.parse(
        process.env
          .COMMERCE_EXTERNAL_PARTNERS_JSON ||
          '[]',
      )
  } catch {
    return []
  }

  if (
    !Array.isArray(
      parsed,
    )
  ) {
    return []
  }

  const seen =
    new Set()

  return parsed
    .map(
      (
        item,
      ) => {
        const id =
          String(
            item?.id ||
              '',
          ).trim()

        const label =
          String(
            item?.label ||
              '',
          ).trim()

        const destination =
          String(
            item?.url ||
              '',
          ).trim()

        if (
          !id ||
          !label ||
          !destination ||
          seen.has(
            id,
          )
        ) {
          return null
        }

        let url

        try {
          url =
            new URL(
              destination,
            )
        } catch {
          return null
        }

        if (
          url.protocol !==
          'https:'
        ) {
          return null
        }

        seen.add(
          id,
        )

        // The registry contains destinations, not live product or price feeds.
        // Disclose only relationships explicitly declared by the operator.
        const relationship =
          ['affiliate', 'commercial', 'none'].includes(item?.relationship)
            ? item.relationship
            : 'unknown'

        return {
          id,
          label,
          relationship,

          destinationUrl:
            url.toString(),
        }
      },
    )
    .filter(
      Boolean,
    )
}

export function listExternalCommercePartners() {
  return readRegistry().map(
    (
      partner,
    ) => ({
      id:
        partner.id,

      label:
        partner.label,

      relationship:
        partner.relationship,
    }),
  )
}

export function resolveExternalCommercePartner(
  partnerId,
) {
  const normalized =
    String(
      partnerId ||
        '',
    ).trim()

  const partner =
    readRegistry().find(
      (
        item,
      ) =>
        item.id ===
        normalized,
    )

  if (
    !partner
  ) {
    throw new ApiError(
      404,
      'External retailer partner is not configured.',
      [
        {
          code:
            'EXTERNAL_PARTNER_NOT_FOUND',
        },
      ],
    )
  }

  return partner
}