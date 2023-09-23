import { Construct } from "constructs";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import { CreateKendraWorkspace } from "./create-kendra-workspace";

export interface KendraRetrievalProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
}

export class KendraRetrieval extends Construct {
  public readonly createKendraWorkspaceWorkflow: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: KendraRetrievalProps) {
    super(scope, id);

    const createWorkflow = new CreateKendraWorkspace(
      this,
      "CreateAuroraWorkspace",
      {
        config: props.config,
        shared: props.shared,
        ragDynamoDBTables: props.ragDynamoDBTables,
      }
    );

    this.createKendraWorkspaceWorkflow = createWorkflow.stateMachine;
  }
}
