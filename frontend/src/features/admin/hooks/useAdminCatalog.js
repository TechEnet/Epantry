import {
  useCallback,
  useState,
} from 'react'

import {
  createAdminNextProductVersion,
  createAdminProductDraft,
  getAdminCatalogBrands,
  getAdminCatalogCategories,
  getAdminProductFamilies,
  getAdminProductPacks,
  getAdminProductVariants,
  getAdminProductVersion,
  getAdminProductVersions,
  publishAdminProductVersion,
  retireAdminProductVersion,
  submitAdminProductForReview,
  updateAdminProductDraft,
  updateAdminProductFacts,
} from '../services/catalogAdmin.service'

function getErrorMessage(
  error,
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    'Unable to complete Catalog operation.'
  )
}

export function useAdminCatalog() {
  const [
    brands,
    setBrands,
  ] =
    useState([])

  const [
    categories,
    setCategories,
  ] =
    useState([])

  const [
    families,
    setFamilies,
  ] =
    useState([])

  const [
    variants,
    setVariants,
  ] =
    useState([])

  const [
    packs,
    setPacks,
  ] =
    useState([])

  const [
    versions,
    setVersions,
  ] =
    useState([])

  const [
    selectedVersion,
    setSelectedVersion,
  ] =
    useState(null)

  const [
    pagination,
    setPagination,
  ] =
    useState(null)

  const [
    loading,
    setLoading,
  ] =
    useState(false)

  const [
    mutating,
    setMutating,
  ] =
    useState(false)

  const [
    error,
    setError,
  ] =
    useState(null)

  const runLoad =
    useCallback(
      async (
        operation,
      ) => {
        setLoading(
          true,
        )

        setError(
          null,
        )

        try {
          return await operation()
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError,
            ),
          )

          throw requestError
        } finally {
          setLoading(
            false,
          )
        }
      },
      [],
    )

  const runMutation =
    useCallback(
      async (
        operation,
      ) => {
        setMutating(
          true,
        )

        setError(
          null,
        )

        try {
          return await operation()
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError,
            ),
          )

          throw requestError
        } finally {
          setMutating(
            false,
          )
        }
      },
      [],
    )

  const loadBrands =
    useCallback(
      async (
        query =
          {},
      ) => {
        const result =
          await runLoad(
            () =>
              getAdminCatalogBrands(
                query,
              ),
          )

        setBrands(
          Array.isArray(
            result?.brands,
          )
            ? result.brands
            : [],
        )

        return result
      },
      [
        runLoad,
      ],
    )

  const loadCategories =
    useCallback(
      async (
        query =
          {},
      ) => {
        const result =
          await runLoad(
            () =>
              getAdminCatalogCategories(
                query,
              ),
          )

        setCategories(
          Array.isArray(
            result?.categories,
          )
            ? result.categories
            : [],
        )

        return result
      },
      [
        runLoad,
      ],
    )

  const loadFamilies =
    useCallback(
      async (
        query =
          {},
      ) => {
        const result =
          await runLoad(
            () =>
              getAdminProductFamilies(
                query,
              ),
          )

        setFamilies(
          Array.isArray(
            result?.productFamilies,
          )
            ? result.productFamilies
            : Array.isArray(
                  result?.families,
                )
              ? result.families
              : [],
        )

        return result
      },
      [
        runLoad,
      ],
    )

  const loadVariants =
    useCallback(
      async (
        query =
          {},
      ) => {
        const result =
          await runLoad(
            () =>
              getAdminProductVariants(
                query,
              ),
          )

        setVariants(
          Array.isArray(
            result?.productVariants,
          )
            ? result.productVariants
            : Array.isArray(
                  result?.variants,
                )
              ? result.variants
              : [],
        )

        return result
      },
      [
        runLoad,
      ],
    )

  const loadPacks =
    useCallback(
      async (
        query =
          {},
      ) => {
        const result =
          await runLoad(
            () =>
              getAdminProductPacks(
                query,
              ),
          )

        setPacks(
          Array.isArray(
            result?.packs,
          )
            ? result.packs
            : [],
        )

        return result
      },
      [
        runLoad,
      ],
    )

  const loadVersions =
    useCallback(
      async (
        query =
          {},
      ) => {
        const result =
          await runLoad(
            () =>
              getAdminProductVersions(
                query,
              ),
          )

        setVersions(
          Array.isArray(
            result?.items,
          )
            ? result.items
            : Array.isArray(
                  result?.productVersions,
                )
              ? result.productVersions
              : Array.isArray(
                    result?.versions,
                  )
                ? result.versions
                : [],
        )

        setPagination(
          result?.pagination ||
          null,
        )

        return result
      },
      [
        runLoad,
      ],
    )

  const loadVersion =
    useCallback(
      async (
        versionId,
      ) => {
        const result =
          await runLoad(
            () =>
              getAdminProductVersion(
                versionId,
              ),
          )

        const version =
          result?.productVersion ||
          result?.version ||
          null

        setSelectedVersion(
          version,
        )

        return version
      },
      [
        runLoad,
      ],
    )

  const createDraft =
    useCallback(
      async (
        input,
      ) => {
        const result =
          await runMutation(
            () =>
              createAdminProductDraft(
                input,
              ),
          )

        return (
          result?.productVersion ||
          result?.version ||
          null
        )
      },
      [
        runMutation,
      ],
    )

  const updateDraft =
    useCallback(
      async (
        versionId,
        input,
      ) => {
        const result =
          await runMutation(
            () =>
              updateAdminProductDraft(
                versionId,
                input,
              ),
          )

        const version =
          result?.productVersion ||
          result?.version ||
          null

        if (version) {
          setSelectedVersion(
            version,
          )
        }

        return version
      },
      [
        runMutation,
      ],
    )

  const updateFacts =
    useCallback(
      async (
        versionId,
        input,
      ) => {
        const result =
          await runMutation(
            () =>
              updateAdminProductFacts(
                versionId,
                input,
              ),
          )

        const version =
          result?.productVersion ||
          result?.version ||
          null

        if (version) {
          setSelectedVersion(
            version,
          )
        }

        return version
      },
      [
        runMutation,
      ],
    )

  const submitForReview =
    useCallback(
      async (
        versionId,
      ) => {
        const result =
          await runMutation(
            () =>
              submitAdminProductForReview(
                versionId,
              ),
          )

        const version =
          result?.productVersion ||
          result?.version ||
          null

        if (version) {
          setSelectedVersion(
            version,
          )
        }

        return version
      },
      [
        runMutation,
      ],
    )

  const createNextVersion =
    useCallback(
      async (
        versionId,
        changeReason,
      ) => {
        const result =
          await runMutation(
            () =>
              createAdminNextProductVersion(
                versionId,
                {
                  changeReason,
                },
              ),
          )

        const version =
          result?.productVersion ||
          result?.version ||
          null

        if (version) {
          setSelectedVersion(
            version,
          )
        }

        return version
      },
      [
        runMutation,
      ],
    )

  const publishVersion =
    useCallback(
      async (
        versionId,
        {
          reasonCode,
          reasonDetails =
            '',
        },
      ) => {
        const result =
          await runMutation(
            () =>
              publishAdminProductVersion(
                versionId,
                {
                  reasonCode,

                  reasonDetails,
                },
              ),
          )

        const version =
          result?.productVersion ||
          result?.version ||
          null

        if (version) {
          setSelectedVersion(
            version,
          )
        }

        return result
      },
      [
        runMutation,
      ],
    )

  const retireVersion =
    useCallback(
      async (
        versionId,
        {
          reasonCode,
          reasonDetails,
        },
      ) => {
        const result =
          await runMutation(
            () =>
              retireAdminProductVersion(
                versionId,
                {
                  reasonCode,

                  reasonDetails,
                },
              ),
          )

        const version =
          result?.productVersion ||
          result?.version ||
          null

        if (version) {
          setSelectedVersion(
            version,
          )
        }

        return version
      },
      [
        runMutation,
      ],
    )

  return {
    brands,

    categories,

    families,

    variants,

    packs,

    versions,

    selectedVersion,

    pagination,

    loading,

    mutating,

    error,

    loadBrands,

    loadCategories,

    loadFamilies,

    loadVariants,

    loadPacks,

    loadVersions,

    loadVersion,

    createDraft,

    updateDraft,

    updateFacts,

    submitForReview,

    createNextVersion,

    publishVersion,

    retireVersion,

    setSelectedVersion,
  }
}

export default useAdminCatalog