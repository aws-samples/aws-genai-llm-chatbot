import { Construct } from "constructs";
import { Shared } from "../../shared";
import { SystemConfig } from "../../shared/types";
import { RagDynamoDBTables } from "../rag-dynamodb-tables";

export interface KendraRetrievalProps {
  readonly config: SystemConfig;
  readonly shared: Shared;
  readonly ragDynamoDBTables: RagDynamoDBTables;
}

export class KendraRetrieval extends Construct {
  constructor(scope: Construct, id: string, props: KendraRetrievalProps) {
    super(scope, id);
  }
}
