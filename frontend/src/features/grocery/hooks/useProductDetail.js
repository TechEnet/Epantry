import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  getCatalogProduct,
} from '../services/catalog.service'

function getErrorMessage(
  error,
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    'Unable to load this Product.'
  )
}

export function useProductDetail(
  productSlug,
) {
  const [
    product,
    setProduct,
  ] =
    useState(null)

  const [
    loading,
    setLoading,
  ] =
    useState(
      Boolean(
        productSlug,
      ),
    )

  const [
    error,
    setError,
  ] =
    useState(null)

  const requestSequence =
    useRef(0)

  const loadProduct =
    useCallback(
      async () => {
        const normalizedSlug =
          String(
            productSlug ||
              '',
          ).trim()

        if (
          !normalizedSlug
        ) {
          setProduct(
            null,
          )

          setLoading(
            false,
          )

          setError(
            null,
          )

          return
        }

        const sequence =
          requestSequence
            .current +
          1

        requestSequence.current =
          sequence

        setLoading(
          true,
        )

        setError(
          null,
        )

        try {
          const result =
            await getCatalogProduct(
              normalizedSlug,
            )

          if (
            requestSequence
              .current !==
            sequence
          ) {
            return
          }

          setProduct(
            result.product,
          )
        } catch (requestError) {
          if (
            requestSequence
              .current !==
            sequence
          ) {
            return
          }

          setProduct(
            null,
          )

          setError(
            getErrorMessage(
              requestError,
            ),
          )
        } finally {
          if (
            requestSequence
              .current ===
            sequence
          ) {
            setLoading(
              false,
            )
          }
        }
      },
      [
        productSlug,
      ],
    )

  useEffect(
    () => {
      loadProduct()
    },
    [
      loadProduct,
    ],
  )

  return {
    product,

    loading,

    error,

    refresh:
      loadProduct,
  }
}

export default useProductDetail