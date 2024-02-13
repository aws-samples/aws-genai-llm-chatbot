import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import * as geo from "aws-cdk-lib/aws-location";
import { bedrock } from "@cdklabs/generative-ai-cdk-constructs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { VectorIndex } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/opensearch-vectorindex";
import { VectorCollection } from "@cdklabs/generative-ai-cdk-constructs/lib/cdk-lib/opensearchserverless";
import { NagSuppressions } from "cdk-nag";

export class BedrockWeatherAgent extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const powertools = lambda.LayerVersion.fromLayerVersionArn(
      this,
      "powertools",
      `arn:aws:lambda:${
        cdk.Stack.of(this).region
      }:017000801446:layer:AWSLambdaPowertoolsPythonV2:58`
    );

    new geo.CfnPlaceIndex(this, "place-index", {
      dataSource: "Esri",
      indexName: "Test",
      pricingPlan: "RequestBasedUsage",
    });

    const vectorStore = new VectorCollection(this, "vector-collection");
    const vectorIndex = new VectorIndex(this, "vector-index", {
      collection: vectorStore,
      indexName: "weather",
      vectorField: "vector",
      vectorDimensions: 1536,
      mappings: [
        {
          mappingField: "AMAZON_BEDROCK_TEXT_CHUNK",
          dataType: "text",
          filterable: true,
        },
        {
          mappingField: "AMAZON_BEDROCK_METADATA",
          dataType: "text",
          filterable: false,
        },
      ],
    });

    const weather = new lambda.Function(this, "weather", {
      runtime: lambda.Runtime.PYTHON_3_9,
      description:
        "Lambda function that implements APIs to retrieve weather data",
      code: lambda.Code.fromDockerBuild(path.join(__dirname, "weather")),
      handler: "lambda.handler",
      memorySize: 512,
      timeout: cdk.Duration.seconds(10),
      layers: [powertools],
    });

    const policy = new iam.Policy(this, "weather-policy", {
      statements: [
        new iam.PolicyStatement({
          actions: ["geo:SearchPlaceIndexForText"],
          resources: ["*"],
        }),
      ],
    });
    weather.role?.attachInlinePolicy(policy);

    const kb = new bedrock.KnowledgeBase(this, "weather-kb", {
      embeddingsModel: bedrock.BedrockFoundationModel.TITAN_EMBED_TEXT_V1,
      vectorField: "vector",
      vectorIndex: vectorIndex,
      indexName: "weather",
      instruction: "answers questions about WMO and metereology",
    });

    const bucket = new Bucket(this, "bedrock-kb-datasource-bucket", {
      enforceSSL: true,
    });

    const keyPrefix = "my-docs";
    new bedrock.S3DataSource(this, "my-docs-datasource", {
      bucket: bucket,
      dataSourceName: "my-docs",
      knowledgeBase: kb,
      inclusionPrefixes: [keyPrefix],
    });

    const agent = new bedrock.Agent(this, "weather-agent", {
      foundationModel:
        bedrock.BedrockFoundationModel.ANTHROPIC_CLAUDE_INSTANT_V1_2,
      instruction:
        "You are a weather expert and answer user question about weather in different places. You answer the questions in the same language they have been asked.",
      description: "an agent to interact with a weather api",
      knowledgeBases: [kb],
    });

    agent.addActionGroup({
      actionGroupExecutor: weather,
      apiSchema: bedrock.ApiSchema.fromAsset(
        path.join(__dirname, "weather", "schema.json")
      ),
      actionGroupState: "ENABLED",
    });

    new BucketDeployment(this, "my-docs-files", {
      destinationBucket: bucket,
      destinationKeyPrefix: keyPrefix,
      sources: [Source.asset(path.join(__dirname, "my-documents"))],
    });

    new cdk.CfnOutput(this, "weather-function-name", {
      value: weather.functionName,
    });

    NagSuppressions.addResourceSuppressions(weather.role!, [
      {
        id: "AwsSolutions-IAM4",
        reason: "IAM role implicitly created by CDK.",
      },
    ]);

    NagSuppressions.addResourceSuppressions(policy, [
      {
        id: "AwsSolutions-IAM5",
        reason: "IAM role implicitly created by CDK.",
      },
    ]);

    NagSuppressions.addResourceSuppressions(bucket, [
      {
        id: "AwsSolutions-S1",
        reason: "Access logs not required",
      },
    ]);
  }
}
