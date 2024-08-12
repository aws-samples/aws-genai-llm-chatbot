import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { Layer } from "../../lib/layer";
import * as path from "path";
import { removeAssetHashes } from "../utils/template-util";

const app = new App({
  context: {
    "aws:cdk:bundling-stacks": [],
  },
});
const stack = new Stack(app);
new Layer(stack, "CommonLayer", {
  runtime: Runtime.PYTHON_3_11,
  architecture: Architecture.X86_64,
  path: path.join(__dirname, "../../lib/shared/layers/common"),
});

test("snapshot test", () => {
  const templateJson = Template.fromStack(stack).toJSON();
  removeAssetHashes(templateJson);
  expect(templateJson).toMatchSnapshot();
});
