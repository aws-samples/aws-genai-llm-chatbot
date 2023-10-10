import { Construct } from "constructs";
import { SystemConfig } from "../../shared/types";
import { Shared } from "../../shared";
import { DeleteWorkspace } from "./delete-wrokspace";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import { AuroraPgVector } from "../aurora-pgvector";
import { OpenSearchVector } from "../opensearch-vector";
import { KendraRetrieval } from "../kendra-retrieval";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";

export interface WorkkspacesProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
  readonly auroraPgVector?: AuroraPgVector;
  readonly openSearch?: OpenSearchVector;
  readonly kendraRetrieval?: KendraRetrieval;
}

export class Workspaces extends Construct {
  public readonly deleteWorkspaceWorkflow?: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: WorkkspacesProps) {
    super(scope, id);

    const workflow = new DeleteWorkspace(this, "DeleteWorkspace", {
      config: props.config,
      shared: props.shared,
      ragDynamoDBTables: props.ragDynamoDBTables,
      auroraPgVector: props.auroraPgVector,
      openSearch: props.openSearch,
      kendraRetrieval: props.kendraRetrieval,
    });

    this.deleteWorkspaceWorkflow = workflow.stateMachine;
  }
}
