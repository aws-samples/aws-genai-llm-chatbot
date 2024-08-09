import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { Construct } from "constructs";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { AuroraPgVector } from "../aurora-pgvector";
import { DataImport } from "../data-import";
import { KendraRetrieval } from "../kendra-retrieval";
import { OpenSearchVector } from "../opensearch-vector";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { DeleteWorkspace } from "./delete-workspace";
import { DeleteDocument } from "./delete-document";

export interface WorkkspacesProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly dataImport: DataImport;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly auroraPgVector?: AuroraPgVector;
  readonly openSearchVector?: OpenSearchVector;
  readonly kendraRetrieval?: KendraRetrieval;
}

export class Workspaces extends Construct {
  public readonly deleteWorkspaceWorkflow: sfn.StateMachine;
  public readonly deleteDocumentWorkflow: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: WorkkspacesProps) {
    super(scope, id);

    const deleteWorkspaceWorkflow = new DeleteWorkspace(
      this,
      "DeleteWorkspace",
      {
        config: props.config,
        shared: props.shared,
        dataImport: props.dataImport,
        ragDynamoDBTables: props.ragDynamoDBTables,
        auroraPgVector: props.auroraPgVector,
        openSearchVector: props.openSearchVector,
        kendraRetrieval: props.kendraRetrieval,
      }
    );

    const deleteDocumentWorkflow = new DeleteDocument(this, "DeleteDocument", {
      config: props.config,
      shared: props.shared,
      dataImport: props.dataImport,
      ragDynamoDBTables: props.ragDynamoDBTables,
      auroraPgVector: props.auroraPgVector,
      openSearchVector: props.openSearchVector,
      kendraRetrieval: props.kendraRetrieval,
    });

    this.deleteWorkspaceWorkflow = deleteWorkspaceWorkflow.stateMachine;
    this.deleteDocumentWorkflow = deleteDocumentWorkflow.stateMachine;
  }
}
