import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import { Shared } from "../shared";
import { SystemConfig } from "../shared/types";
import { AuroraPgVector } from "./aurora-pgvector";
import { DataImport } from "./data-import";
import { KendraRetrieval } from "./kendra-retrieval";
import { OpenSearchVector } from "./opensearch-vector";
import { RagDynamoDBTables } from "./rag-dynamodb-tables";
import { SageMakerRagModels } from "./sagemaker-rag-models";
import { Workspaces } from "./workspaces";

export interface RagEnginesProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
}

export class RagEngines extends Construct {
  public readonly auroraPgVector: AuroraPgVector | null;
  public readonly openSearchVector: OpenSearchVector | null;
  public readonly kendraRetrieval: KendraRetrieval | null;
  public readonly sageMakerRagModels: SageMakerRagModels | null;
  public readonly uploadBucket: s3.Bucket;
  public readonly processingBucket: s3.Bucket;
  public readonly documentsTable: dynamodb.Table;
  public readonly workspacesTable: dynamodb.Table;
  public readonly workspacesByObjectTypeIndexName: string;
  public readonly documentsByCompountKeyIndexName: string;
  public readonly documentsByStatusIndexName: string;
  public readonly fileImportWorkflow?: sfn.StateMachine;
  public readonly websiteCrawlingWorkflow?: sfn.StateMachine;
  public readonly deleteWorkspaceWorkflow: sfn.StateMachine;
  public readonly deleteDocumentWorkflow: sfn.StateMachine;
  public readonly dataImport: DataImport;

  constructor(scope: Construct, id: string, props: RagEnginesProps) {
    super(scope, id);

    const tables = new RagDynamoDBTables(this, "RagDynamoDBTables", {
      kmsKey: props.shared.kmsKey,
      retainOnDelete: props.config.retainOnDelete,
    });

    let sageMakerRagModels: SageMakerRagModels | null = null;
    if (
      props.config.rag.engines.aurora.enabled ||
      props.config.rag.engines.opensearch.enabled
    ) {
      sageMakerRagModels = new SageMakerRagModels(this, "SageMaker", {
        shared: props.shared,
        config: props.config,
      });
    }

    let auroraPgVector: AuroraPgVector | null = null;
    if (props.config.rag.engines.aurora.enabled) {
      auroraPgVector = new AuroraPgVector(this, "AuroraPgVector", {
        shared: props.shared,
        config: props.config,
        ragDynamoDBTables: tables,
      });
    }

    let openSearchVector: OpenSearchVector | null = null;
    if (props.config.rag.engines.opensearch.enabled) {
      openSearchVector = new OpenSearchVector(this, "OpenSearchVector", {
        shared: props.shared,
        config: props.config,
        ragDynamoDBTables: tables,
      });
    }

    let kendraRetrieval: KendraRetrieval | null = null;
    if (props.config.rag.engines.kendra.enabled) {
      kendraRetrieval = new KendraRetrieval(this, "KendraRetrieval", {
        shared: props.shared,
        config: props.config,
        ragDynamoDBTables: tables,
      });
    }

    const dataImport = new DataImport(this, "DataImport", {
      shared: props.shared,
      config: props.config,
      auroraDatabase: auroraPgVector?.database,
      sageMakerRagModels: sageMakerRagModels ?? undefined,
      workspacesTable: tables.workspacesTable,
      documentsTable: tables.documentsTable,
      ragDynamoDBTables: tables,
      workspacesByObjectTypeIndexName: tables.workspacesByObjectTypeIndexName,
      documentsByCompoundKeyIndexName: tables.documentsByCompoundKeyIndexName,
      openSearchVector: openSearchVector ?? undefined,
      kendraRetrieval: kendraRetrieval ?? undefined,
    });

    const workspaces = new Workspaces(this, "Workspaces", {
      shared: props.shared,
      config: props.config,
      dataImport,
      ragDynamoDBTables: tables,
      auroraPgVector: auroraPgVector ?? undefined,
      openSearchVector: openSearchVector ?? undefined,
      kendraRetrieval: kendraRetrieval ?? undefined,
    });
    this.auroraPgVector = auroraPgVector;
    this.openSearchVector = openSearchVector;
    this.kendraRetrieval = kendraRetrieval;
    this.sageMakerRagModels = sageMakerRagModels;
    this.uploadBucket = dataImport.uploadBucket;
    this.processingBucket = dataImport.processingBucket;
    this.workspacesTable = tables.workspacesTable;
    this.documentsTable = tables.documentsTable;
    this.workspacesByObjectTypeIndexName =
      tables.workspacesByObjectTypeIndexName;
    this.documentsByCompountKeyIndexName =
      tables.documentsByCompoundKeyIndexName;
    this.documentsByStatusIndexName = tables.documentsByStatusIndexName;
    this.fileImportWorkflow = dataImport.fileImportWorkflow;
    this.websiteCrawlingWorkflow = dataImport.websiteCrawlingWorkflow;
    this.deleteWorkspaceWorkflow = workspaces.deleteWorkspaceWorkflow;
    this.deleteDocumentWorkflow = workspaces.deleteDocumentWorkflow;
    this.dataImport = dataImport;
  }
}
