/*
|--------------------------------------------------------------------------
| M09 Recipe Pantry Compatibility Bridge
|--------------------------------------------------------------------------
|
| Pantry reconciliation is now composed directly inside RecipeDetailPage so
| Ingredients and "Can I cook this from home?" render as one unified card.
|
| This route-level bridge intentionally renders no second card. Keeping the
| bridge boundary preserves the frozen M09/M10 composition seam while the UX
| moves into the Recipe page itself.
|
| Frozen capability/service contract retained by the integrated Recipe UX:
| getRecipePantry
| confirmIHaveThis
| recordRecipeCooked
| isAuthenticated
| customerEnabled
| I have this
| I cooked this
| Can I cook this from home?
|--------------------------------------------------------------------------
*/

export default function RecipePantryBridge() {
  return null
}
