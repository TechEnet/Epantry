import assert from 'node:assert/strict'

import test from 'node:test'

import {
  ALLERGEN_RELATION_TYPES,
  FOOD_EVIDENCE_STATES,
  FOOD_INTELLIGENCE_COLLECTIONS,
  normalizeFoodKey,
  normalizeJurisdictionCode,
} from '../src/modules/foodIntelligence/foodIntelligence.constants.js'

import {
  Allergen,
  FoodCalculation,
  IngredientRelation,
  Nutrient,
  RuleProfile,
} from '../src/modules/foodIntelligence/foodIntelligence.models.js'

test(
  'M08 exposes documented Food Intelligence evidence states',
  () => {
    assert.deepEqual(
      FOOD_EVIDENCE_STATES,
      [
        'verified_source',
        'operator_declared',
        'calculated',
        'inferred',
        'unknown_review_required',
      ],
    )
  },
)

test(
  'M08 keeps contains may-contain and cross-contact as distinct allergen relationships',
  () => {
    assert.deepEqual(
      ALLERGEN_RELATION_TYPES,
      [
        'contains',
        'may_contain',
        'cross_contact',
      ],
    )
  },
)

test(
  'M08 Food key normalization is deterministic',
  () => {
    assert.equal(
      normalizeFoodKey(
        'Tree Nuts / Almond',
      ),
      'tree_nuts_almond',
    )
  },
)

test(
  'M08 jurisdiction normalization is deterministic',
  () => {
    assert.equal(
      normalizeJurisdictionCode(
        ' in ',
      ),
      'IN',
    )
  },
)

test(
  'M08 Allergen uses dedicated allergens collection',
  () => {
    assert.equal(
      Allergen.collection.name,
      FOOD_INTELLIGENCE_COLLECTIONS.ALLERGEN,
    )
  },
)

test(
  'M08 Nutrient uses dedicated nutrients collection',
  () => {
    assert.equal(
      Nutrient.collection.name,
      FOOD_INTELLIGENCE_COLLECTIONS.NUTRIENT,
    )
  },
)

test(
  'M08 IngredientRelation uses dedicated ingredientRelations collection',
  () => {
    assert.equal(
      IngredientRelation.collection.name,
      FOOD_INTELLIGENCE_COLLECTIONS.INGREDIENT_RELATION,
    )
  },
)

test(
  'M08 RuleProfile uses dedicated ruleProfiles collection',
  () => {
    assert.equal(
      RuleProfile.collection.name,
      FOOD_INTELLIGENCE_COLLECTIONS.RULE_PROFILE,
    )
  },
)

test(
  'M08 FoodCalculation uses dedicated foodCalculations collection',
  () => {
    assert.equal(
      FoodCalculation.collection.name,
      FOOD_INTELLIGENCE_COLLECTIONS.FOOD_CALCULATION,
    )
  },
)

test(
  'M08 IngredientRelation points to canonical M04 Ingredient identity',
  () => {
    assert.ok(
      IngredientRelation
        .schema
        .paths
        .canonicalIngredientId,
    )
  },
)

test(
  'M08 IngredientRelation preserves evidence provenance reference',
  () => {
    assert.ok(
      IngredientRelation
        .schema
        .paths
        .evidenceSourceId,
    )

    assert.ok(
      IngredientRelation
        .schema
        .paths
        .evidenceState,
    )
  },
)

test(
  'M08 critical Ingredient mapping is versioned and governance ready',
  () => {
    assert.ok(
      IngredientRelation
        .schema
        .paths
        .mappingVersion,
    )

    assert.ok(
      IngredientRelation
        .schema
        .paths
        .approvedByUserId,
    )

    assert.ok(
      IngredientRelation
        .schema
        .paths
        .changeReason,
    )
  },
)

test(
  'M08 RuleProfile preserves rule version and jurisdiction',
  () => {
    assert.ok(
      RuleProfile
        .schema
        .paths
        .version,
    )

    assert.ok(
      RuleProfile
        .schema
        .paths
        .jurisdictionCode,
    )

    assert.ok(
      RuleProfile
        .schema
        .paths
        .definition,
    )
  },
)

test(
  'M08 FoodCalculation preserves calculation source and rule lineage',
  () => {
    assert.ok(
      FoodCalculation
        .schema
        .paths
        .sourceVersions,
    )

    assert.ok(
      FoodCalculation
        .schema
        .paths
        .ruleProfileVersions,
    )

    assert.ok(
      FoodCalculation
        .schema
        .paths
        .fingerprint,
    )
  },
)

test(
  'M08 FoodCalculation contains no Marketplace commercial truth',
  () => {
    const paths =
      Object.keys(
        FoodCalculation
          .schema
          .paths,
      )

    assert.equal(
      paths.includes(
        'price',
      ),
      false,
    )

    assert.equal(
      paths.includes(
        'stock',
      ),
      false,
    )

    assert.equal(
      paths.includes(
        'inventory',
      ),
      false,
    )

    assert.equal(
      paths.includes(
        'serviceability',
      ),
      false,
    )
  },
)

test(
  'M08 Food Intelligence models do not create application access roles or modes',
  () => {
    const models = [
      Allergen,
      Nutrient,
      IngredientRelation,
      RuleProfile,
      FoodCalculation,
    ]

    for (
      const model of
      models
    ) {
      const paths =
        Object.keys(
          model.schema.paths,
        )

      assert.equal(
        paths.includes(
          'activeMode',
        ),
        false,
      )

      assert.equal(
        paths.includes(
          'hostEnabled',
        ),
        false,
      )

      assert.equal(
        paths.includes(
          'superAdminEnabled',
        ),
        false,
      )

      assert.equal(
        paths.includes(
          'sellerEnabled',
        ),
        false,
      )

      assert.equal(
        paths.includes(
          'brandEnabled',
        ),
        false,
      )

      assert.equal(
        paths.includes(
          'b2bEnabled',
        ),
        false,
      )
    }
  },
)