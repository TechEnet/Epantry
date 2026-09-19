import {
  FoodCalculation,
  IngredientRelation,
  RuleProfile,
} from './foodIntelligence.models.js'

/*
|--------------------------------------------------------------------------
| Serialize
|--------------------------------------------------------------------------
*/

function serializeWorkspaceRecord(
  document,
) {
  if (!document) {
    return null
  }

  const {
    _id,
    __v,
    ...rest
  } =
    document

  return {
    id:
      _id
        ? String(
            _id,
          )
        : null,

    ...rest,
  }
}

/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

function buildPagination({
  page,
  limit,
  total,
}) {
  return {
    page,

    limit,

    total,

    pages:
      Math.max(
        1,
        Math.ceil(
          total /
            limit,
        ),
      ),
  }
}

async function listModel({
  Model,
  page,
  limit,
  sort,
}) {
  const skip =
    (
      page -
      1
    ) *
    limit

  const [
    documents,
    total,
  ] =
    await Promise.all([
      Model
        .find({})
        .sort(
          sort,
        )
        .skip(
          skip,
        )
        .limit(
          limit,
        )
        .lean(),

      Model.countDocuments(
        {},
      ),
    ])

  return {
    records:
      documents.map(
        serializeWorkspaceRecord,
      ),

    pagination:
      buildPagination({
        page,

        limit,

        total,
      }),
  }
}

/*
|--------------------------------------------------------------------------
| Ingredient / Allergen Mappings
|--------------------------------------------------------------------------
*/

export async function listFoodIngredientRelations({
  page,
  limit,
}) {
  const result =
    await listModel({
      Model:
        IngredientRelation,

      page,

      limit,

      sort: {
        createdAt:
          -1,
      },
    })

  return {
    ingredientRelations:
      result.records,

    pagination:
      result.pagination,
  }
}

/*
|--------------------------------------------------------------------------
| Rule Profiles
|--------------------------------------------------------------------------
*/

export async function listFoodRuleProfiles({
  page,
  limit,
}) {
  const result =
    await listModel({
      Model:
        RuleProfile,

      page,

      limit,

      sort: {
        createdAt:
          -1,
      },
    })

  return {
    ruleProfiles:
      result.records,

    pagination:
      result.pagination,
  }
}

/*
|--------------------------------------------------------------------------
| Trust / Safety Calculation Queue
|--------------------------------------------------------------------------
*/

export async function listFoodCalculations({
  page,
  limit,
}) {
  const result =
    await listModel({
      Model:
        FoodCalculation,

      page,

      limit,

      sort: {
        createdAt:
          -1,
      },
    })

  return {
    calculations:
      result.records,

    pagination:
      result.pagination,
  }
}