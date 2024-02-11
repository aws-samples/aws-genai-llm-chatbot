import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";

import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
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
}

export class RealtimeGraphqlApiBackend extends Construct {
  public readonly messagesTopic: sns.Topic;
  public readonly resolvers: RealtimeResolvers;

  constructor(
    scope: Construct,
    id: string,
    props: RealtimeGraphqlApiBackendProps
  ) {
    super(scope, id);
    // Create the main Message Topic acting as a message bus
    const messagesTopic = new sns.Topic(this, "MessagesTopic");

    const deadLetterQueue = new sqs.Queue(this, "OutgoingMessagesDLQ", {
      enforceSSL: true,
    });

    const queue = new sqs.Queue(this, "OutgoingMessagesQueue", {
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
      userPool: props.userPool,
      shared: props.shared,
      api: props.api,
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

    /**
     * CDK NAG suppression
     */
    NagSuppressions.addResourceSuppressions(messagesTopic, [
      { id: "AwsSolutions-SNS2", reason: "No sensitive data in topic." },
      { id: "AwsSolutions-SNS3", reason: "No sensitive data in topic." },
    ]);
  }
}
