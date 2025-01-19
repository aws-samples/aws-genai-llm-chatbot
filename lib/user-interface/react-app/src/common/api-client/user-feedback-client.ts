import { GraphQLResult } from "@aws-amplify/api-graphql";
import { API, GraphQLQuery } from "@aws-amplify/api";
import { AddUserFeedbackMutation } from "../../API.ts";
import { addUserFeedback } from "../../graphql/mutations.ts";
import { FeedbackData } from "../../components/chatbot/types.ts";

export class UserFeedbackClient {
  async addUserFeedback(params: {
    feedbackData: FeedbackData;
  }): Promise<GraphQLResult<GraphQLQuery<AddUserFeedbackMutation>>> {
    const result = API.graphql<GraphQLQuery<AddUserFeedbackMutation>>({
      query: addUserFeedback,
      variables: {
        input: {
          sessionId: params.feedbackData.sessionId,
          key: params.feedbackData.key,
          feedback: params.feedbackData.feedback,
          prompt: params.feedbackData.prompt,
          completion: params.feedbackData.completion,
          model: params.feedbackData.model,
          applicationId: params.feedbackData.applicationId,
        },
      },
    });
    return result;
  }
}
