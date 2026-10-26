import { getIngredientKnowledge } from './ingredient.knowledge.service.js'
import { ApiError } from '../../utils/ApiError.js'

export async function getIngredientKnowledgeController(req, res, next) {
  try {
    const ref = String(req.params.ref || '')
    const listing = typeof req.query.listing === 'string' ? req.query.listing : ''
    if (ref.length > 100 || listing.length > 30) throw new ApiError(400, 'Invalid ingredient request.')
    const data = await getIngredientKnowledge(ref, { listingId: listing })
    return res.status(200).json({ success: true, message: 'Ingredient knowledge loaded.', data })
  } catch (error) { return next(error) }
}
