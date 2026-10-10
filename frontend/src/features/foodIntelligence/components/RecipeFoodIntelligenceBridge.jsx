import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import FoodIntelligencePanel from './FoodIntelligencePanel'
import { getPublicRecipe } from '../../recipes/services/recipe.service'
import { getRecipeFoodIntelligence, resolveRecipeVersionIdFromSlug } from '../services/foodIntelligence.service'

// Only the published API is allowed to supply governed nutrition,
// allergen, dietary and source information. Never invent these values.
const UNAVAILABLE_FOOD_INTELLIGENCE = Object.freeze({
  available: false,
  verificationStatus: 'cannot_verify',
  nutrition: [],
  allergens: [],
  dietary: [],
})

export default function RecipeFoodIntelligenceBridge() {
  const { slug } = useParams()
  const [foodIntelligence, setFoodIntelligence] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setFoodIntelligence(null)

    async function load() {
      try {
        // The Recipe detail page uses recipe.id. Prefer this exact published
        // version rather than potentially resolving another version from slug.
        const publicRecipe = await getPublicRecipe(slug)
        const pageVersionId = String(
          publicRecipe?.recipe?.id || publicRecipe?.recipe?._id || '',
        ).trim()
        const versionId = /^[a-f0-9]{24}$/i.test(pageVersionId)
          ? pageVersionId
          : await resolveRecipeVersionIdFromSlug(slug)

        if (versionId) {
          const result = await getRecipeFoodIntelligence(versionId)
          if (!cancelled) setFoodIntelligence(result || null)
        }
      } catch {
        // A temporary API failure must not make the entire Recipe guide
        // disappear. The panel safely displays unverified/unavailable data.
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [slug])

  if (isLoading) return null

  // The Recipe guide has four portal targets for these sections.
  // Always render their headings, even if approved evidence is not
  // published yet; the panel itself handles the unavailable wording.
  return (
    <FoodIntelligencePanel
      foodIntelligence={foodIntelligence || UNAVAILABLE_FOOD_INTELLIGENCE}
      title="Recipe Food Intelligence"
      recipeDetailPortal
    />
  )
}
