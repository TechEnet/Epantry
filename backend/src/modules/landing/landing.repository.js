import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Featured Grocery
|--------------------------------------------------------------------------
*/

export async function findFeaturedProducts(limit = 4) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  return mongoose.connection
    .collection("products")
    .find({})
    .project({
      _id: 0,
      id: 1,
      name: 1,
      slug: 1,
      brandId: 1,
      subCategory: 1,
      image: 1,
      description: 1,
      quantity: 1,
      unit: 1,
      price: 1,
      currency: 1,
      availability: 1,
      isFeatured: 1,
    })
    .sort({
      isFeatured: -1,
      id: 1,
    })
    .limit(limit)
    .toArray();
}

/*
|--------------------------------------------------------------------------
| Featured Brands
|--------------------------------------------------------------------------
*/

export async function findFeaturedBrands(limit = null) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  const now = new Date();

  const pipeline = [
    {
      $match: {
        status: "active",
      },
    },
    {
      $lookup: {
        from: "productFamilies",
        let: {
          brandId: "$_id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: ["$brandId", "$$brandId"],
                  },
                  {
                    $eq: ["$status", "active"],
                  },
                ],
              },
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],
        as: "featuredBrandFamilies",
      },
    },
    {
      $lookup: {
        from: "productVariants",
        let: {
          familyIds: "$featuredBrandFamilies._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: ["$familyId", "$$familyIds"],
                  },
                  {
                    $eq: ["$status", "active"],
                  },
                ],
              },
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],
        as: "featuredBrandVariants",
      },
    },
    {
      $lookup: {
        from: "packs",
        let: {
          variantIds: "$featuredBrandVariants._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: ["$variantId", "$$variantIds"],
                  },
                  {
                    $eq: ["$status", "active"],
                  },
                ],
              },
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],
        as: "featuredBrandPacks",
      },
    },
    {
      $lookup: {
        from: "productVersions",
        let: {
          packIds: "$featuredBrandPacks._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: ["$packId", "$$packIds"],
                  },
                  {
                    $eq: ["$publicationStatus", "published"],
                  },
                  {
                    $or: [
                      {
                        $eq: ["$effectiveFrom", null],
                      },
                      {
                        $lte: ["$effectiveFrom", now],
                      },
                    ],
                  },
                  {
                    $or: [
                      {
                        $eq: ["$effectiveTo", null],
                      },
                      {
                        $gt: ["$effectiveTo", now],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$packId",
            },
          },
        ],
        as: "featuredBrandPublishedPacks",
      },
    },
    {
      $lookup: {
        from: "sellerOffers",
        let: {
          packIds: "$featuredBrandPublishedPacks._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: ["$packId", "$$packIds"],
                  },
                  {
                    $eq: ["$status", "active"],
                  },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$packId",
            },
          },
        ],
        as: "featuredBrandListedPacks",
      },
    },
    {
      $addFields: {
        featuredBrandSortName: {
          $toLower: "$name",
        },
        productCount: {
          $size: "$featuredBrandListedPacks",
        },
      },
    },
    {
      $sort: {
        featuredBrandSortName: 1,
        _id: 1,
      },
    },
    {
      $project: {
        _id: 0,
        id: {
          $toString: "$_id",
        },
        name: 1,
        slug: 1,
        productCount: 1,
      },
    },
  ];

  if (Number.isInteger(limit) && limit > 0) {
    pipeline.push({
      $limit: limit,
    });
  }

  return mongoose.connection
    .collection("brands")
    .aggregate(pipeline)
    .toArray();
}

/*
|--------------------------------------------------------------------------
| Featured Recipes
|--------------------------------------------------------------------------
*/

export async function findFeaturedRecipes(limit = 3) {
  if (mongoose.connection.readyState !== 1) {
    return [];
  }

  return mongoose.connection
    .collection("recipes")
    .find({})
    .project({
      _id: 0,
      id: 1,
      name: 1,
      slug: 1,
      image: 1,
      description: 1,
      cuisine: 1,
      dietaryType: 1,
      servings: 1,
      preparationTime: 1,
      cookingTime: 1,
      isFeatured: 1,
    })
    .sort({
      isFeatured: -1,
      id: 1,
    })
    .limit(limit)
    .toArray();
}