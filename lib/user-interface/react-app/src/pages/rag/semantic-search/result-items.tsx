import {
  Box,
  ColumnLayout,
  Container,
  Header,
  SpaceBetween,
} from "@cloudscape-design/components";
import {
  SemanticSearchResult,
  SemanticSearchResultItem,
} from "../../../common/types";
import { Labels } from "../../../common/constants";
import React from "react";

export interface ResultItemsProps {
  items: SemanticSearchResultItem[];
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
  item: SemanticSearchResultItem;
  result: SemanticSearchResult;
}) {
  const { item, result } = props;

  return (
    <ColumnLayout columns={2} variant="text-grid">
      <SpaceBetween size="xs">
        <div>
          <Box variant="awsui-key-label">Sources</Box>
          <div>
            {item.sources.map((c) => Labels.sourceTypeMap[c]).join(", ")}
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
        {item.score != null && (
          <div>
            <Box variant="awsui-key-label">Ranking score (cross-encoder)</Box>
            <div>{item.score}</div>
          </div>
        )}
        {item.vectorSearchScore != null && (
          <div>
            <Box variant="awsui-key-label">
              Vector search score (
              {Labels.distainceFunctionMap[result.vectorSearchMetric]})
            </Box>
            <div>{item.vectorSearchScore}</div>
          </div>
        )}
        {item.keywordSearchScore != null && (
          <div>
            <Box variant="awsui-key-label">Keyword search score</Box>
            <div>{item.keywordSearchScore}</div>
          </div>
        )}
      </SpaceBetween>
    </ColumnLayout>
  );
}
