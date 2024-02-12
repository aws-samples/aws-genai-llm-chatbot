import { util, extensions } from "@aws-appsync/utils";

export function request(ctx) {
  return {
    payload: null,
  };
}

export function response(ctx) {
  const filter = {
    and: [
      { userId: { eq: ctx.identity.sub } },
      { sessionId: { eq: ctx.args.sessionId } },
    ],
  };
  extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter(filter));
  return null;
}
