import {
  Router,
} from "express";

import {
  landingFeaturedController,
} from "./landing.controller.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Public Landing Routes
|--------------------------------------------------------------------------
*/

router.get(
  "/featured",
  landingFeaturedController
);

export default router;