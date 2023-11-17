import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as oss from "aws-cdk-lib/aws-opensearchserverless";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { Utils } from "../../shared/utils";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { CreateOpenSearchWorkspace } from "./create-opensearch-workspace";

export interface OpenSearchVectorProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
}

export class OpenSearchVector extends Construct {
  public readonly openSearchCollectionName: string;
  public readonly openSearchCollectionEndpoint: string;
  public readonly openSearchCollection: oss.CfnCollection;
  public readonly createOpenSearchWorkspaceWorkflow: sfn.StateMachine;
  public addToAccessPolicy: (
    name: string,
    principal: (string | undefined)[],
    permission: string[]
  ) => void;

  constructor(scope: Construct, id: string, props: OpenSearchVectorProps) {
    super(scope, id);

    const collectionName = Utils.getName(
      props.config,
      "genaichatbot-workspaces"
    );

    const sg = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc: props.shared.vpc,
    });

    sg.addIngressRule(
      ec2.Peer.ipv4(props.shared.vpc.vpcCidrBlock),
      ec2.Port.tcp(443)
    );

    const cfnVpcEndpoint = new oss.CfnVpcEndpoint(this, "VpcEndpoint", {
      name: Utils.getName(props.config, "genaichatbot-vpce"),
      subnetIds: props.shared.vpc.privateSubnets.map((subnet) => subnet.subnetId),
      vpcId: props.shared.vpc.vpcId,
      securityGroupIds: [sg.securityGroupId],
    });

    const cfnNetworkSecurityPolicy = new oss.CfnSecurityPolicy(
      this,
      "NetworkSecurityPolicy",
      {
        name: Utils.getName(props.config, "genaichatbot-network-policy"),
        type: "network",
        policy: JSON.stringify([
          {
            Rules: [
              {
                ResourceType: "collection",
                Resource: [`collection/${collectionName}`],
              },
            ],
            AllowFromPublic: false,
            SourceVPCEs: [cfnVpcEndpoint.attrId],
          },
        ]).replace(/(\r\n|\n|\r)/gm, ""),
      }
    );

    cfnNetworkSecurityPolicy.node.addDependency(cfnVpcEndpoint);

    const cfnEncryptionSecurityPolicy = new oss.CfnSecurityPolicy(
      this,
      "EncryptionSecurityPolicy",
      {
        name: Utils.getName(props.config, "genaichatbot-encryption-policy", 32),
        type: "encryption",
        policy: JSON.stringify({
          Rules: [
            {
              ResourceType: "collection",
              Resource: [`collection/${collectionName}`],
            },
          ],
          AWSOwnedKey: true,
        }).replace(/(\r\n|\n|\r)/gm, ""),
      }
    );

    cfnEncryptionSecurityPolicy.node.addDependency(cfnNetworkSecurityPolicy);

    const cfnCollection = new oss.CfnCollection(this, "OpenSearchCollection", {
      name: collectionName,
      type: "VECTORSEARCH",
    });

    const createWorkflow = new CreateOpenSearchWorkspace(
      this,
      "CreateAuroraWorkspace",
      {
        config: props.config,
        shared: props.shared,
        ragDynamoDBTables: props.ragDynamoDBTables,
        openSearchCollectionName: collectionName,
        openSearchCollection: cfnCollection,
        collectionEndpoint: cfnCollection.attrCollectionEndpoint,
      }
    );

    cfnCollection.node.addDependency(cfnNetworkSecurityPolicy);
    cfnCollection.node.addDependency(cfnEncryptionSecurityPolicy);

    this.addToAccessPolicyIntl(
      props.config,
      collectionName,
      "create-workflow",
      [createWorkflow.createWorkspaceRole?.roleArn],
      [
        "aoss:CreateIndex",
        "aoss:DeleteIndex",
        "aoss:UpdateIndex",
        "aoss:DescribeIndex",
      ]
    );

    this.addToAccessPolicy = (
      name: string,
      principal: (string | undefined)[],
      permission: string[]
    ) => {
      this.addToAccessPolicyIntl(
        props.config,
        collectionName,
        name,
        principal,
        permission
      );
    };

    this.createOpenSearchWorkspaceWorkflow = createWorkflow.stateMachine;
    this.openSearchCollectionEndpoint = cfnCollection.attrCollectionEndpoint;
    this.openSearchCollection = cfnCollection;
  }

  private addToAccessPolicyIntl(
    config: SystemConfig,
    collectionName: string,
    name: string,
    principal: (string | undefined)[],
    permission: string[]
  ) {
    new oss.CfnAccessPolicy(this, `AccessPolicy-${name}`, {
      name: Utils.getName(config, `access-policy-${name}`, 32),
      type: "data",
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: "index",
              Resource: [`index/${collectionName}/*`],
              Permission: permission,
            },
          ],
          Principal: principal,
        },
      ]).replace(/(\r\n|\n|\r)/gm, ""),
    });
  }
}
