import { apiClient } from '../../../api/apiClient'

function unwrapApiData(response) {
  if (
    response?.data &&
    typeof response.data === 'object' &&
    Object.prototype.hasOwnProperty.call(
      response.data,
      'success',
    )
  ) {
    return response.data.data
  }

  return response?.data ?? response
}

function encodePathValue(value) {
  return encodeURIComponent(
    String(value || '').trim(),
  )
}

async function getCsrfToken() {
  const response =
    await apiClient.get(
      '/auth/csrf',
    )

  const data =
    unwrapApiData(
      response,
    )

  if (!data?.csrfToken) {
    throw new Error(
      'Unable to obtain CSRF protection token.',
    )
  }

  return data.csrfToken
}

async function csrfRequest({
  method,
  url,
  data,
  timeout,
}) {
  const csrfToken =
    await getCsrfToken()

  const response =
    await apiClient.request({
      method,
      url,
      data,

      ...(timeout
        ? {
            timeout,
          }
        : {}),

      headers: {
        'x-csrf-token':
          csrfToken,
      },
    })

  return unwrapApiData(
    response,
  )
}

export function getUniversalProductErrorMessage(
  error,
  fallback =
    'Unable to complete this product-intelligence action right now.',
) {
  return (
    error?.response?.data?.message ||
    error?.message ||
    fallback
  )
}

export async function resolveUniversalBarcode({
  code,
  decodedFormat =
    'UNKNOWN',
  source =
    'camera',
  market =
    'IN',
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/universal-product/resolve-barcode',

    data: {
      code,
      decodedFormat,
      source,
      market,
    },
  })
}

export async function resolveHostUniversalBarcode({
  code,
  decodedFormat =
    'UNKNOWN',
  source =
    'camera',
  market =
    'IN',
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/host/universal-product/resolve-barcode',

    data: {
      code,
      decodedFormat,
      source,
      market,
    },
  })
}

export async function createProductEvidenceUploadIntent({
  purpose,
  scope =
    'customer',
}) {
  const url =
    scope === 'host'
      ? '/host/universal-product/npi/image-upload-intent'
      : scope === 'admin'
        ? '/admin/product-intelligence/image-upload-intent'
        : '/universal-product/image-upload-intent'

  return csrfRequest({
    method:
      'post',

    url,

    data: {
      purpose,
    },
  })
}

function appendCloudinaryParameter(
  formData,
  key,
  value,
) {
  if (
    value === undefined ||
    value === null
  ) {
    return
  }

  formData.append(
    key,
    Array.isArray(value)
      ? value.join(',')
      : String(value),
  )
}

export async function uploadProductEvidence({
  file,
  purpose,
  scope =
    'customer',
}) {
  if (
    !(file instanceof File)
  ) {
    throw new Error(
      'Choose a valid product image first.',
    )
  }

  const data =
    await createProductEvidenceUploadIntent({
      purpose,
      scope,
    })

  const intent =
    data?.uploadIntent

  if (
    !intent?.uploadUrl ||
    !intent?.apiKey ||
    !intent?.signature ||
    !intent?.signedParameters
  ) {
    throw new Error(
      'Product evidence upload intent is incomplete.',
    )
  }

  const maxBytes =
    Number(
      intent.constraints
        ?.maxBytes ||
        0,
    )

  const allowedMimeTypes =
    Array.isArray(
      intent.constraints
        ?.allowedMimeTypes,
    )
      ? intent.constraints
          .allowedMimeTypes
      : []

  if (
    maxBytes > 0 &&
    file.size > maxBytes
  ) {
    throw new Error(
      'This image is larger than the allowed upload size.',
    )
  }

  if (
    allowedMimeTypes.length >
      0 &&
    !allowedMimeTypes.includes(
      file.type,
    )
  ) {
    throw new Error(
      'Use a JPEG, PNG, or WebP product image.',
    )
  }

  const formData =
    new FormData()

  formData.append(
    'file',
    file,
  )

  formData.append(
    'api_key',
    intent.apiKey,
  )

  formData.append(
    'signature',
    intent.signature,
  )

  for (
    const [
      key,
      value,
    ] of Object.entries(
      intent.signedParameters,
    )
  ) {
    appendCloudinaryParameter(
      formData,
      key,
      value,
    )
  }

  const response =
    await fetch(
      intent.uploadUrl,
      {
        method:
          'POST',

        body:
          formData,
      },
    )

  let payload =
    null

  try {
    payload =
      await response.json()
  } catch {
    payload =
      null
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        'Product image upload failed.',
    )
  }

  if (
    !payload?.public_id ||
    !payload?.version ||
    !payload?.signature
  ) {
    throw new Error(
      'Product image upload response could not be verified.',
    )
  }

  return {
    purpose,

    providerAssetId:
      payload.asset_id ||
      '',

    publicId:
      payload.public_id,

    version:
      Number(
        payload.version,
      ),

    signature:
      payload.signature,

    format:
      payload.format,

    mimeType:
      ({
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
      }[String(payload.format || '').toLowerCase()] || file.type),

    bytes:
      Number(
        payload.bytes ||
        file.size,
      ),

    width:
      Number(
        payload.width ||
        0,
      ) ||
      undefined,

    height:
      Number(
        payload.height ||
        0,
      ) ||
      undefined,

    resourceType:
      payload.resource_type ||
      'image',

    deliveryType:
      payload.type ||
      'authenticated',
  }
}

export async function uploadProductEvidenceBatch({
  evidenceFiles,
  scope =
    'customer',
  onProgress,
}) {
  const items =
    Array.isArray(
      evidenceFiles,
    )
      ? evidenceFiles
      : []

  const assets = []

  for (
    let index = 0;
    index < items.length;
    index += 1
  ) {
    const item =
      items[index]

    const asset =
      await uploadProductEvidence({
        file:
          item.file,

        purpose:
          item.purpose,

        scope,
      })

    assets.push(
      asset,
    )

    if (
      typeof onProgress ===
      'function'
    ) {
      onProgress({
        completed:
          index + 1,

        total:
          items.length,
      })
    }
  }

  return assets
}

export async function resolveUniversalImage({
  draftId,
  assets,
  market =
    'IN',
  hints = {},
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/universal-product/resolve-image',

    data: {
      ...(draftId
        ? {
            draftId,
          }
        : {}),

      assets,
      market,
      hints,
    },

    timeout:
      60000,
  })
}

export async function getUniversalProductDraft(
  draftId,
) {
  const response =
    await apiClient.get(
      `/universal-product/drafts/${encodePathValue(
        draftId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function getProductPassport(
  productVersionId,
) {
  const response =
    await apiClient.get(
      `/products/${encodePathValue(
        productVersionId,
      )}/passport`,
    )

  return unwrapApiData(
    response,
  )
}

export async function addProductPassportToPantry({
  productVersionId,
  quantity,
  storageZone,
  note,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      `/products/${encodePathValue(
        productVersionId,
      )}/add-to-pantry`,

    data: {
      sourceType:
        'barcode_capture',

      ...(quantity
        ? {
            quantity,
          }
        : {}),

      ...(storageZone
        ? {
            storageZone,
          }
        : {}),

      ...(note
        ? {
            note,
          }
        : {}),
    },
  })
}

export async function createHostNpiFromImages({
  draftId,
  assets,
  market =
    'IN',
  hints = {},
  hostDeclarations = {},
  listingType,
  brandId,
  authorityGrantId,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/host/universal-product/npi/resolve-image',

    data: {
      ...(draftId
        ? {
            draftId,
          }
        : {}),

      assets,
      market,
      hints,
      hostDeclarations,

      ...(listingType
        ? {
            listingType,
          }
        : {}),

      ...(brandId
        ? {
            brandId,
          }
        : {}),

      ...(authorityGrantId
        ? {
            authorityGrantId,
          }
        : {}),
    },

    timeout:
      60000,
  })
}

export async function createAdminNpiFromImages({
  draftId,
  assets,
  market =
    'IN',
  hints = {},
  hostDeclarations = {},
  listingType,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/admin/product-intelligence/resolve-image',

    data: {
      ...(draftId
        ? {
            draftId,
          }
        : {}),

      assets,
      market,
      hints,
      hostDeclarations,

      ...(listingType
        ? {
            listingType,
          }
        : {}),
    },

    timeout:
      60000,
  })
}

export async function createHostBulkNpiBatch({
  listingType,
  market =
    'IN',
  sourceFileName =
    '',
  sourceRowCount,
  issueCount =
    0,
  validationIssues =
    [],
  rows,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      '/host/universal-product/npi/bulk-batches',

    data: {
      listingType,
      market,
      sourceFileName,
      sourceRowCount,
      issueCount,
      validationIssues,
      rows,
    },

    timeout:
      120000,
  })
}

export async function listHostBulkNpiBatches({
  page = 1,
  limit = 25,
} = {}) {
  const response =
    await apiClient.get(
      '/host/universal-product/npi/bulk-batches',
      {
        params: {
          page,
          limit,
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function listHostNpiDrafts({
  page = 1,
  limit = 25,
  status,
} = {}) {
  const response =
    await apiClient.get(
      '/host/universal-product/npi/drafts',
      {
        params: {
          page,
          limit,

          ...(status
            ? {
                status,
              }
            : {}),
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function getHostNpiDraft(
  draftId,
) {
  const response =
    await apiClient.get(
      `/host/universal-product/npi/drafts/${encodePathValue(
        draftId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function listAdminNpiReviewQueue({
  page = 1,
  limit = 25,
  status,
} = {}) {
  const response =
    await apiClient.get(
      '/admin/product-intelligence/review-queue',
      {
        params: {
          page,
          limit,

          ...(status
            ? {
                status,
              }
            : {}),
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function listAdminNpiBulkBatches({
  page = 1,
  limit = 25,
  listingType,
  search,
} = {}) {
  const response =
    await apiClient.get(
      '/admin/product-intelligence/bulk-batches',
      {
        params: {
          page,
          limit,
          ...(listingType ? { listingType } : {}),
          ...(search ? { search } : {}),
        },
      },
    )

  return unwrapApiData(
    response,
  )
}

export async function getAdminNpiBulkBatch(
  batchId,
) {
  const response =
    await apiClient.get(
      `/admin/product-intelligence/bulk-batches/${encodePathValue(
        batchId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function reviewAdminNpiBulkSelection({
  batchId,
  draftIds,
  decision,
  reason,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      `/admin/product-intelligence/bulk-batches/${encodePathValue(
        batchId,
      )}/review-selected`,

    data: {
      draftIds,
      decision,
      reason,
    },
  })
}

export async function getAdminNpiDraft(
  draftId,
) {
  const response =
    await apiClient.get(
      `/admin/product-intelligence/drafts/${encodePathValue(
        draftId,
      )}`,
    )

  return unwrapApiData(
    response,
  )
}

export async function reviewAdminNpiDraft({
  draftId,
  decision,
  fieldDecisions,
  reason,
}) {
  return csrfRequest({
    method:
      'post',

    url:
      `/admin/product-intelligence/drafts/${encodePathValue(
        draftId,
      )}/review`,

    data: {
      decision,
      fieldDecisions,
      reason,
    },
  })
}
export async function materializeAdminNpiDraftToCatalog({
  draftId,
  categoryId,
  categoryName,
  packType = 'other',
  reason = '',
  fieldDecisions = [],
}) {
  return csrfRequest({
    method:
      'post',

    url:
      `/admin/product-intelligence/drafts/${encodePathValue(
        draftId,
      )}/catalog-handoff`,

    data: {
      ...(categoryId
        ? {
            categoryId,
          }
        : {}),

      ...(categoryName
        ? {
            categoryName,
          }
        : {}),

      packType,
      reason,
      fieldDecisions,
    },
  })
}
