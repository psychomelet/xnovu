import { z } from "zod";
import { yogoEmailPayloadSchema, yogoEmailControlSchema } from "./schemas";

export type YogoEmailPayloadSchema = z.infer<typeof yogoEmailPayloadSchema>;
export type YogoEmailControlSchema = z.infer<typeof yogoEmailControlSchema>;
