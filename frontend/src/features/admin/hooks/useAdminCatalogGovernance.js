import {
  useCallback,
  useState,
} from 'react'

import {
  createAdminEvidenceSource,
  createAdminIngredient,
  getAdminEvidenceSources,
  getAdminIngredients,
  updateAdminIngredient,
} from '../services/catalogAdmin.service'

function getErrorMessage(
  error,
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    'Unable to complete Catalog governance operation.'
  )
}

export function useAdminCatalogGovernance() {
  const [
    ingredients,
    setIngredients,
  ] =
    useState([])

  const [
    evidenceSources,
    setEvidenceSources,
  ] =
    useState([])

  const [
    ingredientPagination,
    setIngredientPagination,
  ] =
    useState(null)

  const [
    evidencePagination,
    setEvidencePagination,
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

  /*
  |--------------------------------------------------------------------------
  | Ingredient Dictionary
  |--------------------------------------------------------------------------
  */

  const loadIngredients =
    useCallback(
      async (
        query =
          {},
      ) => {
        const result =
          await runLoad(
            () =>
              getAdminIngredients(
                query,
              ),
          )

        setIngredients(
          Array.isArray(
            result?.ingredients,
          )
            ? result.ingredients
            : [],
        )

        setIngredientPagination(
          result?.pagination ||
          null,
        )

        return result
      },
      [
        runLoad,
      ],
    )

  const createIngredient =
    useCallback(
      async (
        input,
      ) => {
        const result =
          await runMutation(
            () =>
              createAdminIngredient(
                input,
              ),
          )

        return (
          result?.ingredient ||
          null
        )
      },
      [
        runMutation,
      ],
    )

  const updateIngredient =
    useCallback(
      async (
        ingredientId,
        input,
      ) => {
        const result =
          await runMutation(
            () =>
              updateAdminIngredient(
                ingredientId,
                input,
              ),
          )

        return (
          result?.ingredient ||
          null
        )
      },
      [
        runMutation,
      ],
    )

  /*
  |--------------------------------------------------------------------------
  | Evidence
  |--------------------------------------------------------------------------
  */

  const loadEvidenceSources =
    useCallback(
      async ({
        entityType,

        entityId,

        page =
          1,

        limit =
          50,
      }) => {
        const result =
          await runLoad(
            () =>
              getAdminEvidenceSources({
                entityType,

                entityId,

                page,

                limit,
              }),
          )

        setEvidenceSources(
          Array.isArray(
            result?.evidenceSources,
          )
            ? result.evidenceSources
            : [],
        )

        setEvidencePagination(
          result?.pagination ||
          null,
        )

        return result
      },
      [
        runLoad,
      ],
    )

  const createEvidenceSource =
    useCallback(
      async (
        input,
      ) => {
        const result =
          await runMutation(
            () =>
              createAdminEvidenceSource(
                input,
              ),
          )

        return (
          result?.evidenceSource ||
          null
        )
      },
      [
        runMutation,
      ],
    )

  const clearEvidenceSources =
    useCallback(
      () => {
        setEvidenceSources(
          [],
        )

        setEvidencePagination(
          null,
        )
      },
      [],
    )

  return {
    ingredients,

    evidenceSources,

    ingredientPagination,

    evidencePagination,

    loading,

    mutating,

    error,

    loadIngredients,

    createIngredient,

    updateIngredient,

    loadEvidenceSources,

    createEvidenceSource,

    clearEvidenceSources,
  }
}

export default useAdminCatalogGovernance