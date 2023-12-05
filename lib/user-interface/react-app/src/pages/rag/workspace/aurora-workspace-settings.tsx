import {
  ColumnLayout,
  SpaceBetween,
  Box,
  StatusIndicator,
  Container,
  Header,
} from "@cloudscape-design/components";
import { Labels } from "../../../common/constants";
import { WorkspaceItem } from "../../../common/types";

export interface AuroraWorkspaceSettingsProps {
  workspace: WorkspaceItem;
}

export default function AuroraWorkspaceSettings(
  props: AuroraWorkspaceSettingsProps
) {
  return (
    <Container header={<Header variant="h2">Aurora Workspace Settings</Header>}>
      <ColumnLayout columns={3} variant="text-grid">
        <SpaceBetween size="l">
          <div>
            <Box variant="awsui-key-label">Workspace Id</Box>
            <div>{props.workspace.id}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Engine</Box>
            <div>{Labels.engineMap[props.workspace.engine]}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Name</Box>
            <div>{props.workspace.name}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Languages</Box>
            <div>
              {(props.workspace.languages ?? [])
                .map((c) => Labels.languageMap.get(c))
                .join(", ")}
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Status</Box>
            <div>
              <StatusIndicator
                type={Labels.statusTypeMap[props.workspace.status]}
              >
                {Labels.statusMap[props.workspace.status]}
              </StatusIndicator>
            </div>
          </div>
        </SpaceBetween>
        <SpaceBetween size="l">
          <div>
            <Box variant="awsui-key-label">Embeddings provider</Box>
            <div>{props.workspace.embeddingsModelProvider}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Embeddings model</Box>
            <div>{props.workspace.embeddingsModelName}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Embeddings dimensions</Box>
            <div>{props.workspace.embeddingsModelDimensions}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Cross-encoder provider</Box>
            <div>{props.workspace.crossEncoderModelProvider}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Cross-encoder model</Box>
            <div>{props.workspace.crossEncoderModelName}</div>
          </div>
        </SpaceBetween>
        <SpaceBetween size="l">
          <div>
            <Box variant="awsui-key-label">Metric (scoring function)</Box>
            <div>
              {
                Labels.distainceFunctionScoreMapAurora[
                  props.workspace.metric ?? ""
                ]
              }
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Indexing</Box>
            <div>{props.workspace.index ? "yes" : "no"}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Hybrid search</Box>
            <div>{props.workspace.hybridSearch ? "yes" : "no"}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Chunk size</Box>
            <div>{props.workspace.chunkSize}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Chunk overlap</Box>
            <div>{props.workspace.chunkOverlap}</div>
          </div>
        </SpaceBetween>
      </ColumnLayout>
    </Container>
  );
}
