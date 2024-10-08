import {
  ColumnLayout,
  SpaceBetween,
  Box,
  StatusIndicator,
  Form,
  Container,
  Header,
} from "@cloudscape-design/components";
import { Labels } from "../../../common/constants";
import { Workspace } from "../../../API";

export interface BedrockKBWorkspaceSettingsProps {
  workspace: Workspace;
}

export default function BedrockKBWorkspaceSettings(
  props: BedrockKBWorkspaceSettingsProps
) {
  return (
    <Form>
      <SpaceBetween size="l">
        <Container
          header={
            <Header variant="h2">
              Amazon Bedrock Knowledge Base Workspace Settings
            </Header>
          }
        >
          <ColumnLayout columns={2} variant="text-grid">
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
                <Box variant="awsui-key-label">Workspace Name</Box>
                <div>{props.workspace.name}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Status</Box>
                <div>
                  <StatusIndicator
                    type={Labels.statusTypeMap[props.workspace.status!]}
                  >
                    {Labels.statusMap[props.workspace.status!]}
                  </StatusIndicator>
                </div>
              </div>
            </SpaceBetween>
            <SpaceBetween size="l">
              {typeof props.workspace.knowledgeBaseId !== "undefined" && (
                <div>
                  <Box variant="awsui-key-label">Knowledge Base Id</Box>
                  <div>{props.workspace.knowledgeBaseId}</div>
                </div>
              )}
              <div>
                <Box variant="awsui-key-label">Hybrid search</Box>
                <div>{props.workspace.hybridSearch ? "Yes" : "No"}</div>
              </div>
              {typeof props.workspace.knowledgeBaseExternal !== "undefined" && (
                <div>
                  <Box variant="awsui-key-label">External</Box>
                  <div>
                    {props.workspace.knowledgeBaseExternal ? "Yes" : "No"}
                  </div>
                </div>
              )}
            </SpaceBetween>
          </ColumnLayout>
        </Container>
      </SpaceBetween>
    </Form>
  );
}
