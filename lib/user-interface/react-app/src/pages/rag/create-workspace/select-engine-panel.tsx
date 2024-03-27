import {
  Container,
  Header,
  FormField,
  Tiles,
} from "@cloudscape-design/components";

export default function SelectEnginePanel(props: {
  engine: string;
  engines: Map<string, boolean>;
  setEngine: (engine: string) => void;
}) {
  return (
    <Container header={<Header variant="h2">Workspace Engine</Header>}>
      <FormField label="Vector Engine" stretch={true}>
        <Tiles
          items={[
            {
              value: "aurora",
              label: "Aurora Serverless v2 PostgreSQL (pgvector)",
              description:
                "Pgvector is open-source vector similarity search for PostgreSQL.",
              disabled: props.engines.get("aurora") !== true,
            },
            {
              value: "opensearch",
              label: "Amazon OpenSearch Serverless",
              description:
                "The vector engine for Amazon OpenSearch Serverless introduces a simple, scalable, and high-performing vector storage and search capability.",
              disabled: props.engines.get("opensearch") !== true,
            },
            {
              value: "kendra",
              label: "Amazon Kendra",
              description:
                "Uses Kendra Retrieve API as a retriever for retrieval augmented generation (RAG) systems.",
              disabled: props.engines.get("kendra") !== true,
            },
            {
              value: "bedrock_kb",
              label: "Amazon Bedrock Knowledge Base",
              description:
                "Uses Bedrock Knowledge Base Retrieve API as a retriever for retrieval augmented generation (RAG) systems.",
              disabled: props.engines.get("bedrock_kb") !== true,
            },
          ]}
          value={props.engine}
          onChange={(e) => props.setEngine(e.detail.value)}
        />
      </FormField>
    </Container>
  );
}
