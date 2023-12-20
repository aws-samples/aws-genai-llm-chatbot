import { util } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    payload: {
      data: ctx.arguments.data,
      sessionId: ctx.arguments.sessionId,
      userId: ctx.arguments.userId,
    },
  };
}

export function response(ctx) {
  return ctx.result;
}
