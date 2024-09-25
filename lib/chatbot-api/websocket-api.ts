import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";

import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as xray from "aws-cdk-lib/aws-xray";
import { Construct } from "constructs";

import { Shared } from "../shared";
import { Direction } from "../shared/types";
import { RealtimeResolvers } from "./appsync-ws";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import * as appsync from "aws-cdk-lib/aws-appsync";
import { NagSuppressions } from "cdk-nag";

interface RealtimeGraphqlApiBackendProps {
  readonly shared: Shared;
  readonly userPool: UserPool;
  readonly api: appsync.GraphqlApi;
  readonly logRetention?: number;
  readonly advancedMonitoring?: boolean;
}

export class RealtimeGraphqlApiBackend extends Construct {
  public readonly messagesTopic: sns.Topic;
  public readonly resolvers: RealtimeResolvers;
  public readonly queue: sqs.Queue;

  constructor(
    scope: Construct,
    id: string,
    props: RealtimeGraphqlApiBackendProps
  ) {
    super(scope, id);
    // Create the main Message Topic acting as a message bus
    const messagesTopic = new sns.Topic(this, "MessagesTopic", {
      enforceSSL: true,
      masterKey: props.shared.kmsKey,
      tracingConfig: props.advancedMonitoring
        ? sns.TracingConfig.ACTIVE
        : sns.TracingConfig.PASS_THROUGH,
    });

    if (props.advancedMonitoring) {
      // https://docs.aws.amazon.com/xray/latest/devguide/xray-services-sns.html#xray-services-sns-configuration
      const stack = cdk.Stack.of(scope);
      new xray.CfnResourcePolicy(this, "SNSResourcePolicy", {
        policyName: "SNSResourcePolicy",
        policyDocument: JSON.stringify(
          new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                principals: [new iam.ServicePrincipal("sns.amazonaws.com")],
                actions: [
                  "xray:PutTraceSegments",
                  "xray:GetSamplingRules",
                  "xray:GetSamplingTargets",
                ],
                resources: ["*"],
                conditions: {
                  StringEquals: {
                    "aws:SourceAccount": stack.account,
                  },
                  StringLike: {
                    "aws:SourceArn": `arn:${stack.partition}:sns:${stack.region}:${stack.account}:*`,
                  },
                },
              }),
            ],
          })
        ),
      });
    }

    const deadLetterQueue = new sqs.Queue(this, "OutgoingMessagesDLQ", {
      encryption: props.shared.queueKmsKey
        ? sqs.QueueEncryption.KMS
        : undefined,
      encryptionMasterKey: props.shared.queueKmsKey,
      enforceSSL: true,
    });

    const queue = new sqs.Queue(this, "OutgoingMessagesQueue", {
      encryption: props.shared.queueKmsKey
        ? sqs.QueueEncryption.KMS
        : undefined,
      encryptionMasterKey: props.shared.queueKmsKey,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      enforceSSL: true,
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // grant eventbridge permissions to send messages to the queue
    queue.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ["sqs:SendMessage"],
        resources: [queue.queueArn],
        principals: [
          new iam.ServicePrincipal("events.amazonaws.com"),
          new iam.ServicePrincipal("sqs.amazonaws.com"),
        ],
      })
    );

    const resolvers = new RealtimeResolvers(this, "Resolvers", {
      queue: queue,
      topic: messagesTopic,
      topicKey: props.shared.kmsKey,
      userPool: props.userPool,
      shared: props.shared,
      api: props.api,
      logRetention: props.logRetention,
      advancedMonitoring: props.advancedMonitoring,
    });

    // Route all outgoing messages to the websocket interface queue
    messagesTopic.addSubscription(
      new subscriptions.SqsSubscription(queue, {
        filterPolicyWithMessageBody: {
          direction: sns.FilterOrPolicy.filter(
            sns.SubscriptionFilter.stringFilter({
              allowlist: [Direction.Out],
            })
          ),
        },
      })
    );

    this.messagesTopic = messagesTopic;
    this.resolvers = resolvers;
    this.queue = queue;

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(messagesTopic, [
      { id: "AwsSolutions-SNS2", reason: "No sensitive data in topic." },
      { id: "AwsSolutions-SNS3", reason: "No sensitive data in topic." },
    ]);
  }
}
