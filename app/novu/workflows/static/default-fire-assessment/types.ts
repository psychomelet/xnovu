import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type FireAssessmentPayload = z.infer<typeof payloadSchema>
export type FireAssessmentControls = z.infer<typeof controlSchema>