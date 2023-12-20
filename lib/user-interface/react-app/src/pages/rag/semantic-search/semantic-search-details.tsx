import {
  ExpandableSection,
  ColumnLayout,
  SpaceBetween,
  Box,
} from "@cloudscape-design/components";
import { Labels } from "../../../common/constants";
import RouterLink from "../../../components/wrappers/router-link";
import { SemanticSearchResult } from "../../../API";

export interface SemanticSearchDetailsProps {
  searchResults: SemanticSearchResult | null;
  detailsExpanded: boolean;
  setDetailsExpanded: (expanded: boolean) => void;
}

export default function SemanticSearchDetails(
  props: SemanticSearchDetailsProps
) {
  if (!props.searchResults) {
    return null;
  }

  return (
    <ExpandableSection
      variant="footer"
      headerText="Details"
      expanded={props.detailsExpanded}
      onChange={({ detail: { expanded } }) =>
        props.setDetailsExpanded(expanded)
      }
    >
      <ColumnLayout columns={2} variant="text-grid">
        <SpaceBetween size="l">
          <div>
            <Box variant="awsui-key-label">Workspace Id</Box>
            <div>
              <RouterLink
                href={`/rag/workspaces/${props.searchResults.workspaceId}`}
              >
                {props.searchResults.workspaceId}
              </RouterLink>
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Engine</Box>
            <div>{Labels.engineMap[props.searchResults.engine]}</div>
          </div>
          {props.searchResults.vectorSearchMetric && (
            <div>
              <Box variant="awsui-key-label">Vector search metric</Box>
              <div>
                {Labels.getDistanceFunctionScoreName(props.searchResults)}
              </div>
            </div>
          )}
        </SpaceBetween>
        <SpaceBetween size="l">
          {props.searchResults.supportedLanguages && (
            <div>
              <Box variant="awsui-key-label">Workspace languages</Box>
              <div>
                {props.searchResults.supportedLanguages
                  .map((lang) => Labels.languageMap.get(lang))
                  .join(", ")}
              </div>
            </div>
          )}
          {props.searchResults.detectedLanguages && (
            <div>
              <Box variant="awsui-key-label">Detected languages</Box>
              <div>
                {props.searchResults.detectedLanguages
                  .map((lang) => `${lang.code} (${lang.score.toFixed(2)})`)
                  .join(", ")}
              </div>
            </div>
          )}
          {props.searchResults.queryLanguage && (
            <div>
              <Box variant="awsui-key-label">Effective language</Box>
              <div>
                {Labels.languageMap.get(props.searchResults.queryLanguage)}
              </div>
            </div>
          )}
        </SpaceBetween>
      </ColumnLayout>
    </ExpandableSection>
  );
}
