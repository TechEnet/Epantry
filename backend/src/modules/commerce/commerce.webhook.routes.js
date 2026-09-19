import express, {
  Router,
} from 'express'

import {
  ApiResponse,
} from '../../utils/ApiResponse.js'

import {
  processRazorpayWebhook,
} from './commerce.final.service.js'

const router =
  Router()

router.post(
  '/payment',

  express.raw({
    type:
      'application/json',

    limit:
      '256kb',
  }),

  async (
    req,
    res,
    next,
  ) => {
    try {
      const result =
        await processRazorpayWebhook({
          rawBody:
            req.body,

          signature:
            req.get(
              'x-razorpay-signature',
            ) ||
            '',

          providerEventId:
            req.get(
              'x-razorpay-event-id',
            ) ||
            '',
        })

      return res
        .status(
          200,
        )
        .json(
          new ApiResponse(
            200,
            {
              ...result,

              requestId:
                req.requestId,
            },
            'Payment webhook processed.',
          ),
        )
    } catch (
      error
    ) {
      return next(
        error,
      )
    }
  },
)

export default router