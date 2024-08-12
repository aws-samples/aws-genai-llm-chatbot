import { App, Stack } from "aws-cdk-lib";
import { Authentication } from "../../lib/authentication";
import { getTestConfig } from "../utils/config-util";
import { Template } from "aws-cdk-lib/assertions";
import { ChatBotApi } from "../../lib/chatbot-api";
import { RagEngines } from "../../lib/rag-engines";
import { Shared } from "../../lib/shared";
import { Models } from "../../lib/models";
import { removeAssetHashes } from "../utils/template-util";

jest.spyOn(console, "log").mockImplementation(() => {});

const app = new App({
  context: {
    "aws:cdk:bundling-stacks": [],
  },
});
const stack = new Stack(app);

const config = getTestConfig();
const authentication = new Authentication(stack, "Authentication", config);
const shared = new Shared(stack, "Shared", { config });
const ragEngines = new RagEngines(stack, "RagEngines", {
  shared,
  config,
});
const models = new Models(stack, "Models", {
  config: config,
  shared,
});

new ChatBotApi(stack, "ChatBotApiConstruct", {
  shared,
  config,
  ragEngines,
  userPool: authentication.userPool,
  modelsParameter: models.modelsParameter,
  models: models.models,
});

test("snapshot test", () => {
  const templateJson = Template.fromStack(stack).toJSON();
  removeAssetHashes(templateJson);
  expect(templateJson).toMatchSnapshot();
});
