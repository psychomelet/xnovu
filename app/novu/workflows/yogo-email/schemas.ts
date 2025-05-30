import { z } from "zod";

// Learn more about zod at the official website: https://zod.dev/
export const yogoEmailPayloadSchema = z.object({
  inAppSubject: z
    .string()
    .describe("The subject of the notification")
    .default("**Welcome to Yogo!**"),
  inAppBody: z
    .string()
    .describe("The body of the notification")
    .default("This is an in-app notification powered by Yogo."),
});

export const yogoEmailControlSchema = z.object({
  subject: z.string().default("A Successful Test on Yogo!"),
  showHeader: z.boolean().default(true),
  components: z.array(z.string()).default([]),
});
