import { z } from 'zod'

export const healthResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    timestamp: z.string(),
    requestId: z.string(),
  }),
})

export const bootstrapResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    app: z.object({
      name: z.string(),
      apiVersion: z.string(),
      environment: z.string(),
    }),
    features: z.record(z.string(), z.boolean()),
    requestId: z.string(),
  }),
})
