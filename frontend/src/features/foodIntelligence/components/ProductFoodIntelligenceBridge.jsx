import {
  useEffect,
  useState,
} from 'react'

import {
  useParams,
} from 'react-router-dom'

import FoodIntelligencePanel from './FoodIntelligencePanel'

import {
  getProductFoodIntelligence,
  resolveProductVersionIdFromSlug,
} from '../services/foodIntelligence.service'

export default function ProductFoodIntelligenceBridge() {
  const {
    slug,
  } =
    useParams()

  const [
    foodIntelligence,
    setFoodIntelligence,
  ] =
    useState(
      null,
    )

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      true,
    )

  useEffect(
    () => {
      let cancelled =
        false

      async function load() {
        setIsLoading(
          true,
        )

        try {
          const versionId =
            await resolveProductVersionIdFromSlug(
              slug,
            )

          if (
            !versionId
          ) {
            return
          }

          const result =
            await getProductFoodIntelligence(
              versionId,
            )

          if (
            !cancelled
          ) {
            setFoodIntelligence(
              result,
            )
          }
        } catch {
          /*
          |--------------------------------------------------------------------------
          | Existing Product Detail must remain usable if the optional safety
          | extension cannot resolve its canonical version.
          |--------------------------------------------------------------------------
          */
        } finally {
          if (
            !cancelled
          ) {
            setIsLoading(
              false,
            )
          }
        }
      }

      load()

      return () => {
        cancelled =
          true
      }
    },
    [
      slug,
    ],
  )

  if (
    isLoading
  ) {
    return null
  }

  if (
    !foodIntelligence
  ) {
    return null
  }

  return (
    <FoodIntelligencePanel
      foodIntelligence={
        foodIntelligence
      }
      title="Product Food Intelligence"
    />
  )
}