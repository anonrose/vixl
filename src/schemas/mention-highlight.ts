import { z } from 'zod'

export const mentionHighlightSchema = z.object({
  kind: z.enum(['skill', 'mention', 'agent']),
  token: z.string().min(1),
})
