import { z } from 'zod'

const objectIdSchema = z.string().trim().regex(/^[a-f\d]{24}$/i, 'A valid MongoDB ObjectId is required.')

export const settlementIdParamsSchema = z.object({ id: objectIdSchema }).strict()

export const organizationSettlementParamsSchema = z.object({
  organizationId: objectIdSchema,
}).strict()

export const hostFinanceQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: z.enum(['pending_approval', 'approved', 'rejected', 'paid', 'void']).optional(),
}).strict()

export const adminCreateSettlementSchema = z.object({
  organizationId: objectIdSchema,
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  reason: z.string().trim().min(3).max(4000),
}).strict().refine((value) => value.periodEnd > value.periodStart, {
  path: ['periodEnd'],
  message: 'Settlement period end must be after period start.',
})

export const adminSettlementDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(4000),
}).strict()

export const adminSettlementPaidSchema = z.object({
  payoutReference: z.string().trim().min(3).max(300),
  reason: z.string().trim().min(3).max(4000),
}).strict()