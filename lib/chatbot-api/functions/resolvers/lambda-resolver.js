import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const { source, args } = ctx;
  return {
    operation: "Invoke",
    payload: {
      fieldName: ctx.info.fieldName,
      arguments: args,
      identity: ctx.identity,
      source,
    },
  };
}

export function response(ctx) {
  const { result, error } = ctx;
  if (error) {
    util.error(error.message, error.type, result);
  }
  return result;
}
