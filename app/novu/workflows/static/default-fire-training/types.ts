import { z } from 'zod'
import { payloadSchema, controlSchema } from './schemas'

export type FireTrainingPayload = z.infer<typeof payloadSchema>
export type FireTrainingControls = z.infer<typeof controlSchema>