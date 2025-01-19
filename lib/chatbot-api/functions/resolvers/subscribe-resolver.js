import { util, extensions } from "@aws-appsync/utils";

const sessionIdRegexValidation = "[a-z0-9-]{10,50}";

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

  if (!util.matches(sessionIdRegexValidation, ctx.args.sessionId)) {
    util.error("Invalid session Id");
    return null;
  }

  extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter(filter));
  return null;
}
