import {
  useEffect,
  useState,
} from 'react'

import {
  useParams,
} from 'react-router-dom'

import FoodIntelligencePanel from './FoodIntelligencePanel'

import {
  getRecipeFoodIntelligence,
  resolveRecipeVersionIdFromSlug,
} from '../services/foodIntelligence.service'

export default function RecipeFoodIntelligenceBridge() {
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
            await resolveRecipeVersionIdFromSlug(
              slug,
            )

          if (
            !versionId
          ) {
            return
          }

          const result =
            await getRecipeFoodIntelligence(
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
          | Recipe reading/scaling remains available even if Food Intelligence
          | cannot currently resolve.
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
      title="Recipe Food Intelligence"
      recipeDetailPortal
    />
  )
}