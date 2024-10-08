import { App } from "aws-cdk-lib";
import { getTestConfig } from "./utils/config-util";
import { AwsGenAILLMChatbotStack } from "../lib/aws-genai-llm-chatbot-stack";
import { Template } from "aws-cdk-lib/assertions";
import { removeAssetHashes } from "./utils/template-util";

jest.spyOn(console, "log").mockImplementation(() => {});

const app = new App({
  context: {
    "aws:cdk:bundling-stacks": [],
  },
});
const config = getTestConfig();
config.createCMKs = true;
config.retainOnDelete = true;
const stack = new AwsGenAILLMChatbotStack(
  app,
  `${config.prefix}GenAIChatBotStack`,
  {
    config,
    env: {
      region: "us-east-1",
      account: "111111111",
    },
  }
);

test("snapshot test with CMK", () => {
  const templateJson = Template.fromStack(stack).toJSON();
  removeAssetHashes(templateJson);
  expect(templateJson).toMatchSnapshot();
});
