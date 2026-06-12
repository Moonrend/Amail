import { z } from 'zod'
import { validationError } from '../errors.js'

const sendEmailSchema = z.object({
  from: z.string().optional(),
  to: z.union([z.string(), z.array(z.string()).max(50)]),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  reply_to: z.union([z.string(), z.array(z.string())]).optional(),
  headers: z.record(z.string()).optional(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  attachments: z.array(z.object({
    content: z.union([z.string(), z.instanceof(Buffer)]).optional(),
    filename: z.string().optional(),
    path: z.string().optional(),
    content_type: z.string().optional(),
    content_id: z.string().optional(),
  })).optional(),
  scheduled_at: z.string().optional(),
  provider: z.string().min(1).optional(),
  provider_id: z.string().min(1).optional(),
}).superRefine((value, ctx) => {
  if (!value.provider && !value.provider_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['provider_id'],
      message: 'provider_id is required',
    })
  }
}).transform(({ provider_id, ...value }) => ({
  ...value,
  provider: value.provider ?? provider_id!,
}))

export const batchEmailSchema = z.array(sendEmailSchema).max(100)

export type ParsedSendEmailBody = z.infer<typeof sendEmailSchema>

export function parseSendEmailBody(body: unknown) {
  return sendEmailSchema.safeParse(body)
}

export function parseBatchEmailBody(body: unknown) {
  return batchEmailSchema.safeParse(body)
}

export function assertParsed<T>(result: z.SafeParseReturnType<unknown, T>): T {
  if (result.success) return result.data
  throw validationError(result.error.issues.map((issue) => issue.message).join(', '), result.error)
}
