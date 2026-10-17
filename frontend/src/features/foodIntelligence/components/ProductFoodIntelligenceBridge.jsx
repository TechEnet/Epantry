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
        // Do not display a previous product's evidence while the next product loads.
        setFoodIntelligence(null)

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

  // The separate public intelligence API is optional. When its record is
  // unavailable, render the disclosure rows with an explicit unverified state
  // instead of leaving empty spaces in Ingredients & safety.
  // Never substitute invented nutrient, allergen or dietary evidence.
  const presentedFoodIntelligence = foodIntelligence
    ? {
        ...foodIntelligence,
        subject: {
          ...(foodIntelligence.subject || {}),
          type: 'product_version',
        },
      }
    : {
        subject: { type: 'product_version' },
        available: false,
        verificationStatus: 'cannot_verify',
        nutrition: [],
        allergens: [],
        dietary: [],
        lineage: { sources: [], rules: [] },
      }

  return (
    <FoodIntelligencePanel
      foodIntelligence={presentedFoodIntelligence}
      title="Product Food Intelligence"
    />
  )
}