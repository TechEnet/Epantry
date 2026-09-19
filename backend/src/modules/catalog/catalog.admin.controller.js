import {
  ApiError,
} from "../../utils/ApiError.js";

import {
  ApiResponse,
} from "../../utils/ApiResponse.js";

import {
  catalogIdParamsSchema,
  createCatalogBrandSchema,
  createCatalogCategorySchema,
  createNextProductVersionSchema,
  createProductDraftSchema,
  createProductFamilySchema,
  createProductPackSchema,
  createProductVariantSchema,
  listCatalogBrandsQuerySchema,
  listCatalogCategoriesQuerySchema,
  listProductFamiliesQuerySchema,
  listProductPacksQuerySchema,
  listProductVariantsQuerySchema,
  listProductVersionsQuerySchema,
  updateCatalogBrandSchema,
  updateCatalogCategorySchema,
  updateProductDraftSchema,
  updateProductFamilySchema,
  updateProductPackSchema,
  updateProductVariantSchema,
} from "./catalog.admin.validation.js";

import {
  createCatalogBrand,
  createCatalogCategory,
  createNextProductVersion,
  createProductDraft,
  createProductFamily,
  createProductPack,
  createProductVariant,
  getProductVersion,
  listCatalogBrands,
  listCatalogCategories,
  listProductFamilies,
  listProductPacks,
  listProductVariants,
  listProductVersions,
  submitProductVersionForReview,
  updateCatalogBrand,
  updateCatalogCategory,
  updateProductDraft,
  updateProductFamily,
  updateProductPack,
  updateProductVariant,
} from "./catalog.admin.service.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function parseOrThrow(
  schema,
  value,
  code,
  fallbackMessage,
) {
  const parsed =
    schema.safeParse(
      value,
    );

  if (
    !parsed.success
  ) {
    throw new ApiError(
      400,
      parsed.error
        .issues[0]
        ?.message ||
        fallbackMessage,
      [
        {
          code,
        },
      ],
    );
  }

  return parsed.data;
}

function getActorUserId(
  req,
) {
  const actorUserId =
    req.currentUser?._id ||
    req.user?._id ||
    req.authUser?._id;

  if (!actorUserId) {
    throw new ApiError(
      401,
      "Authenticated catalog actor is required.",
      [
        {
          code:
            "CATALOG_ACTOR_REQUIRED",
        },
      ],
    );
  }

  return actorUserId;
}

function sendSuccess(
  req,
  res,
  status,
  data,
  message,
) {
  return res
    .status(status)
    .json(
      new ApiResponse(
        status,
        {
          ...data,

          requestId:
            req.requestId,
        },
        message,
      ),
    );
}

function wrapController(
  handler,
) {
  return async function controller(
    req,
    res,
    next,
  ) {
    try {
      return await handler(
        req,
        res,
      );
    } catch (error) {
      return next(
        error,
      );
    }
  };
}

/*
|--------------------------------------------------------------------------
| Brands
|--------------------------------------------------------------------------
*/

export const listCatalogBrandsController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listCatalogBrandsQuerySchema,
          req.query,
          "CATALOG_BRAND_QUERY_INVALID",
          "Invalid Brand query.",
        );

      const result =
        await listCatalogBrands(
          query,
        );

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Catalog Brands loaded",
      );
    },
  );

export const createCatalogBrandController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createCatalogBrandSchema,
          req.body,
          "CATALOG_BRAND_INPUT_INVALID",
          "Invalid Brand input.",
        );

      const brand =
        await createCatalogBrand(
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          brand,
        },
        "Catalog Brand created",
      );
    },
  );

export const updateCatalogBrandController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_BRAND_ID_INVALID",
          "Invalid Brand ID.",
        );

      const input =
        parseOrThrow(
          updateCatalogBrandSchema,
          req.body,
          "CATALOG_BRAND_INPUT_INVALID",
          "Invalid Brand input.",
        );

      const brand =
        await updateCatalogBrand(
          id,
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          brand,
        },
        "Catalog Brand updated",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Categories
|--------------------------------------------------------------------------
*/

export const listCatalogCategoriesController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listCatalogCategoriesQuerySchema,
          req.query,
          "CATALOG_CATEGORY_QUERY_INVALID",
          "Invalid Category query.",
        );

      const result =
        await listCatalogCategories(
          query,
        );

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Catalog Categories loaded",
      );
    },
  );

export const createCatalogCategoryController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createCatalogCategorySchema,
          req.body,
          "CATALOG_CATEGORY_INPUT_INVALID",
          "Invalid Category input.",
        );

      const category =
        await createCatalogCategory(
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          category,
        },
        "Catalog Category created",
      );
    },
  );

export const updateCatalogCategoryController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_CATEGORY_ID_INVALID",
          "Invalid Category ID.",
        );

      const input =
        parseOrThrow(
          updateCatalogCategorySchema,
          req.body,
          "CATALOG_CATEGORY_INPUT_INVALID",
          "Invalid Category input.",
        );

      const category =
        await updateCatalogCategory(
          id,
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          category,
        },
        "Catalog Category updated",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Product Families
|--------------------------------------------------------------------------
*/

export const listProductFamiliesController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listProductFamiliesQuerySchema,
          req.query,
          "CATALOG_FAMILY_QUERY_INVALID",
          "Invalid Product Family query.",
        );

      const result =
        await listProductFamilies(
          query,
        );

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Product Families loaded",
      );
    },
  );

export const createProductFamilyController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createProductFamilySchema,
          req.body,
          "CATALOG_FAMILY_INPUT_INVALID",
          "Invalid Product Family input.",
        );

      const family =
        await createProductFamily(
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          family,
        },
        "Product Family created",
      );
    },
  );

export const updateProductFamilyController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_FAMILY_ID_INVALID",
          "Invalid Product Family ID.",
        );

      const input =
        parseOrThrow(
          updateProductFamilySchema,
          req.body,
          "CATALOG_FAMILY_INPUT_INVALID",
          "Invalid Product Family input.",
        );

      const family =
        await updateProductFamily(
          id,
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          family,
        },
        "Product Family updated",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Product Variants
|--------------------------------------------------------------------------
*/

export const listProductVariantsController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listProductVariantsQuerySchema,
          req.query,
          "CATALOG_VARIANT_QUERY_INVALID",
          "Invalid Product Variant query.",
        );

      const result =
        await listProductVariants(
          query,
        );

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Product Variants loaded",
      );
    },
  );

export const createProductVariantController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createProductVariantSchema,
          req.body,
          "CATALOG_VARIANT_INPUT_INVALID",
          "Invalid Product Variant input.",
        );

      const variant =
        await createProductVariant(
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          variant,
        },
        "Product Variant created",
      );
    },
  );

export const updateProductVariantController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_VARIANT_ID_INVALID",
          "Invalid Product Variant ID.",
        );

      const input =
        parseOrThrow(
          updateProductVariantSchema,
          req.body,
          "CATALOG_VARIANT_INPUT_INVALID",
          "Invalid Product Variant input.",
        );

      const variant =
        await updateProductVariant(
          id,
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          variant,
        },
        "Product Variant updated",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Packs
|--------------------------------------------------------------------------
*/

export const listProductPacksController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listProductPacksQuerySchema,
          req.query,
          "CATALOG_PACK_QUERY_INVALID",
          "Invalid Pack query.",
        );

      const result =
        await listProductPacks(
          query,
        );

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Product Packs loaded",
      );
    },
  );

export const createProductPackController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createProductPackSchema,
          req.body,
          "CATALOG_PACK_INPUT_INVALID",
          "Invalid Pack input.",
        );

      const pack =
        await createProductPack(
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          pack,
        },
        "Product Pack created",
      );
    },
  );

export const updateProductPackController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_PACK_ID_INVALID",
          "Invalid Pack ID.",
        );

      const input =
        parseOrThrow(
          updateProductPackSchema,
          req.body,
          "CATALOG_PACK_INPUT_INVALID",
          "Invalid Pack input.",
        );

      const pack =
        await updateProductPack(
          id,
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          pack,
        },
        "Product Pack updated",
      );
    },
  );

/*
|--------------------------------------------------------------------------
| Product Versions
|--------------------------------------------------------------------------
*/

export const listProductVersionsController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const query =
        parseOrThrow(
          listProductVersionsQuerySchema,
          req.query,
          "CATALOG_VERSION_QUERY_INVALID",
          "Invalid Product Version query.",
        );

      const result =
        await listProductVersions(
          query,
        );

      return sendSuccess(
        req,
        res,
        200,
        result,
        "Product Versions loaded",
      );
    },
  );

export const getProductVersionController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_VERSION_ID_INVALID",
          "Invalid Product Version ID.",
        );

      const productVersion =
        await getProductVersion(
          id,
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          productVersion,
        },
        "Product Version loaded",
      );
    },
  );

export const createProductDraftController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const input =
        parseOrThrow(
          createProductDraftSchema,
          req.body,
          "CATALOG_VERSION_INPUT_INVALID",
          "Invalid Product draft.",
        );

      const productVersion =
        await createProductDraft(
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          productVersion,
        },
        "Product draft created",
      );
    },
  );

export const updateProductDraftController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_VERSION_ID_INVALID",
          "Invalid Product Version ID.",
        );

      const input =
        parseOrThrow(
          updateProductDraftSchema,
          req.body,
          "CATALOG_VERSION_INPUT_INVALID",
          "Invalid Product Version input.",
        );

      const productVersion =
        await updateProductDraft(
          id,
          input,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          productVersion,
        },
        "Product draft updated",
      );
    },
  );

export const submitProductVersionForReviewController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_VERSION_ID_INVALID",
          "Invalid Product Version ID.",
        );

      const productVersion =
        await submitProductVersionForReview(
          id,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        200,
        {
          productVersion,
        },
        "Product Version submitted for review",
      );
    },
  );

export const createNextProductVersionController =
  wrapController(
    async (
      req,
      res,
    ) => {
      const {
        id,
      } =
        parseOrThrow(
          catalogIdParamsSchema,
          req.params,
          "CATALOG_VERSION_ID_INVALID",
          "Invalid Product Version ID.",
        );

      const {
        changeReason,
      } =
        parseOrThrow(
          createNextProductVersionSchema,
          req.body,
          "CATALOG_VERSION_INPUT_INVALID",
          "A change reason is required.",
        );

      const productVersion =
        await createNextProductVersion(
          id,
          changeReason,
          getActorUserId(
            req,
          ),
        );

      return sendSuccess(
        req,
        res,
        201,
        {
          productVersion,
        },
        "Next Product Version created",
      );
    },
  );