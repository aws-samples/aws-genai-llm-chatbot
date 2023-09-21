import { Construct } from "constructs";
import { SageMakerRagModels } from "./sagemaker-rag-models";
import { SystemConfig } from "../shared/types";
import { Shared } from "../shared";
import { AuroraPgVector } from "./aurora-pgvector";
import { DataImport } from "./data-import";
import { RagDynamoDBTables } from "./rag-dynamodb-tables";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";

export interface RagEnginesProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
}

export class RagEngines extends Construct {
  public readonly uploadBucket: s3.Bucket;
  public readonly processingBucket: s3.Bucket;
  public readonly documentsTable: dynamodb.Table;
  public readonly workspacesTable: dynamodb.Table;
  public readonly workspacesByObjectTypeIndexName: string;
  public readonly documentsByCompountKeyIndexName: string;
  public readonly sageMakerRagModelsEndpoint: sagemaker.CfnEndpoint;
  public readonly auroraDatabase?: rds.DatabaseCluster;
  public readonly createAuroraWorkspaceWorkflow?: sfn.StateMachine;
  public readonly fileImportWorkflow?: sfn.StateMachine;
  public readonly websiteCrawlingWorkflow?: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: RagEnginesProps) {
    super(scope, id);

    const tables = new RagDynamoDBTables(this, "RagDynamoDBTables");

    const sageMakerRagModels = new SageMakerRagModels(
      this,
      "SageMakerRagModels",
      {
        shared: props.shared,
        config: props.config,
      }
    );

    let auroraPgVector: AuroraPgVector | null = null;
    if (props.config.rag.engines.aurora.enabled) {
      auroraPgVector = new AuroraPgVector(this, "AuroraPgVector", {
        shared: props.shared,
        config: props.config,
        ragDynamoDBTables: tables,
      });
    }

    const dataImport = new DataImport(this, "DataImport", {
      shared: props.shared,
      config: props.config,
      auroraDatabase: auroraPgVector?.database,
      sageMakerRagModelsEndpoint: sageMakerRagModels.model.endpoint,
      workspacesTable: tables.workspacesTable,
      documentsTable: tables.documentsTable,
      ragDynamoDBTables: tables,
      workspacesByObjectTypeIndexName: tables.workspacesByObjectTypeIndexName,
      documentsByCompountKeyIndexName: tables.documentsByCompountKeyIndexName,
    });

    this.sageMakerRagModelsEndpoint = sageMakerRagModels.model.endpoint;
    this.uploadBucket = dataImport.uploadBucket;
    this.processingBucket = dataImport.processingBucket;
    this.workspacesTable = tables.workspacesTable;
    this.documentsTable = tables.documentsTable;
    this.workspacesByObjectTypeIndexName =
      tables.workspacesByObjectTypeIndexName;
    this.documentsByCompountKeyIndexName =
      tables.documentsByCompountKeyIndexName;
    this.auroraDatabase = auroraPgVector?.database;
    this.createAuroraWorkspaceWorkflow =
      auroraPgVector?.createAuroraWorkspaceWorkflow;
    this.fileImportWorkflow = dataImport.fileImportWorkflow;
    this.websiteCrawlingWorkflow = dataImport.websiteCrawlingWorkflow;
  }
}
