import {
  Box,
  ColumnLayout,
  Container,
  Header,
  SpaceBetween,
} from "@cloudscape-design/components";
import { Labels } from "../../../common/constants";
import React from "react";
import { SemanticSearchItem, SemanticSearchResult } from "../../../API";

export interface ResultItemsProps {
  items: SemanticSearchItem[];
  result: SemanticSearchResult;
}

export default function ResultItems(props: ResultItemsProps) {
  return (
    <SpaceBetween size="l">
      {props.items.map((item) => (
        <React.Fragment key={item.chunkId}>
          {item.contentComplement ? (
            <Container
              footer={<ItemDetails item={item} result={props.result} />}
            >
              <SpaceBetween size="xs">
                <div>
                  <Header variant="h3">Question</Header>
                  {item.content}
                </div>
                <div>
                  <Header variant="h3">Answer</Header>
                  {item.contentComplement}
                </div>
              </SpaceBetween>
            </Container>
          ) : (
            <Container
              footer={<ItemDetails item={item} result={props.result} />}
            >
              {item.content}
            </Container>
          )}
        </React.Fragment>
      ))}
    </SpaceBetween>
  );
}

function ItemDetails(props: {
  item: SemanticSearchItem;
  result: SemanticSearchResult;
}) {
  const { item, result } = props;
  const hasScores =
    (typeof item.score !== "undefined" && item.score !== null) ||
    (typeof item.vectorSearchScore !== "undefined" &&
      item.vectorSearchScore !== null) ||
    (typeof item.keywordSearchScore !== "undefined" &&
      item.keywordSearchScore !== null);

  if (!hasScores) {
    return (
      <ColumnLayout columns={2} variant="text-grid">
        <SpaceBetween size="xs">
          <div>
            <Box variant="awsui-key-label">Sources</Box>
            <div>
              {item
                /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
                .sources!.map((c: any) => Labels.sourceTypeMap[c])
                .join(", ")}
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Source type</Box>
            <div>{Labels.documentTypeMap[item.documentType]}</div>
          </div>
        </SpaceBetween>
        <SpaceBetween size="xs">
          {item.title && (
            <div>
              <Box variant="awsui-key-label">Title</Box>
              <div>{item.title}</div>
            </div>
          )}
          {item.path && (
            <div>
              <Box variant="awsui-key-label">Path</Box>
              <div>{item.path}</div>
            </div>
          )}
        </SpaceBetween>
      </ColumnLayout>
    );
  }

  return (
    <ColumnLayout columns={2} variant="text-grid">
      <SpaceBetween size="xs">
        <div>
          <Box variant="awsui-key-label">Sources</Box>
          <div>
            {
              /* eslint-disable-next-line  @typescript-eslint/no-explicit-any */
              item.sources!.map((c: any) => Labels.sourceTypeMap[c]).join(", ")
            }
          </div>
        </div>
        <div>
          <Box variant="awsui-key-label">Source type</Box>
          <div>{Labels.documentTypeMap[item.documentType]}</div>
        </div>
        {item.title && (
          <div>
            <Box variant="awsui-key-label">Title</Box>
            <div>{item.title}</div>
          </div>
        )}
        {item.path && (
          <div>
            <Box variant="awsui-key-label">Path</Box>
            <div>{item.path}</div>
          </div>
        )}
      </SpaceBetween>
      <SpaceBetween size="xs">
        {typeof item.score !== "undefined" && item.score !== null && (
          <div>
            <Box variant="awsui-key-label">Ranking score (cross-encoder)</Box>
            <div>{item.score}</div>
          </div>
        )}
        {typeof item.vectorSearchScore !== "undefined" &&
          item.vectorSearchScore !== null && (
            <div>
              <Box variant="awsui-key-label">
                Vector search score (
                {Labels.getDistanceFunctionScoreName(result)})
              </Box>
              <div>{item.vectorSearchScore}</div>
            </div>
          )}
        {typeof item.keywordSearchScore !== "undefined" &&
          item.keywordSearchScore !== null && (
            <div>
              <Box variant="awsui-key-label">Keyword search score</Box>
              <div>{item.keywordSearchScore}</div>
            </div>
          )}
      </SpaceBetween>
    </ColumnLayout>
  );
}
