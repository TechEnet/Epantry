import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  getCatalogBrands,
  getCatalogCategories,
  getCatalogProducts,
} from '../services/catalog.service'

/*
|--------------------------------------------------------------------------
| Error Message
|--------------------------------------------------------------------------
*/

function getErrorMessage(
  error,
) {
  return (
    error?.response
      ?.data
      ?.message ||
    error?.message ||
    'Unable to load Grocery catalog.'
  )
}

/*
|--------------------------------------------------------------------------
| Grocery Catalog
|--------------------------------------------------------------------------
*/

export function useGroceryCatalog({
  initialSearch =
    '',

  initialCategorySlug =
    '',

  initialBrandSlug =
    '',

  initialPage =
    1,

  initialLimit =
    24,
} = {}) {
  const [
    products,
    setProducts,
  ] =
    useState([])

  const [
    categories,
    setCategories,
  ] =
    useState([])

  const [
    brands,
    setBrands,
  ] =
    useState([])

  const [
    search,
    setSearchState,
  ] =
    useState(
      initialSearch,
    )

  const [
    categorySlug,
    setCategorySlugState,
  ] =
    useState(
      initialCategorySlug,
    )

  const [
    brandSlug,
    setBrandSlugState,
  ] =
    useState(
      initialBrandSlug,
    )

  const [
    page,
    setPageState,
  ] =
    useState(
      initialPage,
    )

  const [
    limit,
    setLimitState,
  ] =
    useState(
      initialLimit,
    )

  const [
    pagination,
    setPagination,
  ] =
    useState({
      page:
        initialPage,

      limit:
        initialLimit,

      total:
        0,

      pages:
        0,
    })

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    filtersLoading,
    setFiltersLoading,
  ] =
    useState(true)

  const [
    error,
    setError,
  ] =
    useState(null)

  const requestSequence =
    useRef(0)

  /*
  |--------------------------------------------------------------------------
  | Filter Dictionaries
  |--------------------------------------------------------------------------
  */

  const loadFilterOptions =
    useCallback(
      async () => {
        setFiltersLoading(
          true,
        )

        try {
          const [
            categoriesResult,
            brandsResult,
          ] =
            await Promise.all([
              getCatalogCategories(),
              getCatalogBrands(),
            ])

          setCategories(
            categoriesResult
              .categories,
          )

          setBrands(
            brandsResult
              .brands,
          )
        } catch (requestError) {
          setError(
            getErrorMessage(
              requestError,
            ),
          )
        } finally {
          setFiltersLoading(
            false,
          )
        }
      },
      [],
    )

  /*
  |--------------------------------------------------------------------------
  | Products
  |--------------------------------------------------------------------------
  */

  const loadProducts =
    useCallback(
      async () => {
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
            await getCatalogProducts({
              page,

              limit,

              search,

              categorySlug,

              brandSlug,

              listedOnly:
                false,
            })

          if (
            requestSequence
              .current !==
            sequence
          ) {
            return
          }

          setProducts(
            result.products,
          )

          setPagination(
            result.pagination,
          )
        } catch (requestError) {
          if (
            requestSequence
              .current !==
            sequence
          ) {
            return
          }

          setProducts(
            [],
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
        page,
        limit,
        search,
        categorySlug,
        brandSlug,
      ],
    )

  useEffect(
    () => {
      loadFilterOptions()
    },
    [
      loadFilterOptions,
    ],
  )

  useEffect(
    () => {
      loadProducts()
    },
    [
      loadProducts,
    ],
  )

  /*
  |--------------------------------------------------------------------------
  | Filter Actions
  |--------------------------------------------------------------------------
  */

  const setSearch =
    useCallback(
      (
        value,
      ) => {
        setSearchState(
          String(
            value ||
              '',
          ),
        )

        setPageState(
          1,
        )
      },
      [],
    )

  const setCategorySlug =
    useCallback(
      (
        value,
      ) => {
        setCategorySlugState(
          String(
            value ||
              '',
          ),
        )

        setPageState(
          1,
        )
      },
      [],
    )

  const setBrandSlug =
    useCallback(
      (
        value,
      ) => {
        setBrandSlugState(
          String(
            value ||
              '',
          ),
        )

        setPageState(
          1,
        )
      },
      [],
    )

  const setPage =
    useCallback(
      (
        value,
      ) => {
        setPageState(
          Math.max(
            1,
            Number(
              value,
            ) ||
              1,
          ),
        )
      },
      [],
    )

  const setLimit =
    useCallback(
      (
        value,
      ) => {
        setLimitState(
          Math.max(
            1,
            Number(
              value,
            ) ||
              24,
          ),
        )

        setPageState(
          1,
        )
      },
      [],
    )

  const resetFilters =
    useCallback(
      () => {
        setSearchState(
          '',
        )

        setCategorySlugState(
          '',
        )

        setBrandSlugState(
          '',
        )

        setPageState(
          1,
        )
      },
      [],
    )

  return {
    products,

    categories,

    brands,

    search,

    categorySlug,

    brandSlug,

    page,

    limit,

    pagination,

    loading,

    filtersLoading,

    error,

    setSearch,

    setCategorySlug,

    setBrandSlug,

    setPage,

    setLimit,

    resetFilters,

    refresh:
      loadProducts,

    refreshFilters:
      loadFilterOptions,
  }
}

export default useGroceryCatalog