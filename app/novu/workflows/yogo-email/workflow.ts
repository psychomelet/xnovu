import { workflow } from "@novu/framework";
import { yogoEmailControlSchema, yogoEmailPayloadSchema } from "./schemas";
  
export const yogoEmail = workflow(
  "yogo-email",
  async ({ step, payload }) => {
    await step.email(
      "send-email-yogo",
      async (controls) => {
        return {
          subject: controls.subject,
          body: `Hello World, ${payload.inAppSubject} ${payload.inAppBody}`,
        };
      },
      {
        controlSchema: yogoEmailControlSchema,
      },
    );

    await step.inApp("In-App Step Yogo", async () => {
      return {
        subject: payload.inAppSubject,
        body: payload.inAppBody,
      };
    });
  },
  {
    payloadSchema: yogoEmailPayloadSchema,
  },
);
