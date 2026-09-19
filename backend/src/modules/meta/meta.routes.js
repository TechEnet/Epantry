import { Router } from 'express'

import { bootstrapMetaController } from './meta.controller.js'

const router = Router()

router.get('/', bootstrapMetaController)
router.get('/bootstrap', bootstrapMetaController)

export default router
