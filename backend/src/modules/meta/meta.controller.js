import { ApiResponse } from '../../utils/ApiResponse.js'
import { getBootstrapMeta } from './meta.service.js'

export async function bootstrapMetaController(req, res) {
  const data = await getBootstrapMeta()

  return res.status(200).json(
    new ApiResponse(
      200,
      { ...data, requestId: req.requestId },
      'EPANTRY bootstrap metadata loaded',
    ),
  )
}
