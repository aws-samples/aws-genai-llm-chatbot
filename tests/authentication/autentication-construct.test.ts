import { App, Stack } from "aws-cdk-lib";
import { Authentication } from "../../lib/authentication";
import { getTestConfig } from "../utils/config-util";
import { Template } from "aws-cdk-lib/assertions";

const app = new App();
const stack = new Stack(app);

new Authentication(stack, "AuthenticationConstruct", getTestConfig());

test("snapshot test", () => {
  const template = Template.fromStack(stack);
  expect(template).toMatchSnapshot();
});
