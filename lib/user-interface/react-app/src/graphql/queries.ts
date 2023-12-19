/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "../API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const none = /* GraphQL */ `query None {
  none
}
` as GeneratedQuery<APITypes.NoneQueryVariables, APITypes.NoneQuery>;
export const checkHealth = /* GraphQL */ `query CheckHealth {
  checkHealth
}
` as GeneratedQuery<
  APITypes.CheckHealthQueryVariables,
  APITypes.CheckHealthQuery
>;
export const getUploadFileURL = /* GraphQL */ `query GetUploadFileURL($input: FileUploadInput!) {
  getUploadFileURL(input: $input) {
    url
    fields
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetUploadFileURLQueryVariables,
  APITypes.GetUploadFileURLQuery
>;
export const listModels = /* GraphQL */ `query ListModels {
  listModels {
    name
    provider
    interface
    ragSupported
    inputModalities
    outputModalities
    streaming
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListModelsQueryVariables,
  APITypes.ListModelsQuery
>;
export const listWorkspaces = /* GraphQL */ `query ListWorkspaces {
  listWorkspaces {
    id
    name
    formatVersion
    engine
    status
    aossEngine
    languages
    hasIndex
    embeddingsModelProvider
    embeddingsModelName
    embeddingsModelDimensions
    crossEncoderModelName
    crossEncoderModelProvider
    metric
    index
    hybridSearch
    chunkingStrategy
    chunkSize
    chunkOverlap
    vectors
    documents
    sizeInBytes
    kendraIndexId
    kendraIndexExternal
    kendraUseAllData
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListWorkspacesQueryVariables,
  APITypes.ListWorkspacesQuery
>;
export const getWorkspace = /* GraphQL */ `query GetWorkspace($workspaceId: String!) {
  getWorkspace(workspaceId: $workspaceId) {
    id
    name
    formatVersion
    engine
    status
    aossEngine
    languages
    hasIndex
    embeddingsModelProvider
    embeddingsModelName
    embeddingsModelDimensions
    crossEncoderModelName
    crossEncoderModelProvider
    metric
    index
    hybridSearch
    chunkingStrategy
    chunkSize
    chunkOverlap
    vectors
    documents
    sizeInBytes
    kendraIndexId
    kendraIndexExternal
    kendraUseAllData
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetWorkspaceQueryVariables,
  APITypes.GetWorkspaceQuery
>;
export const listRagEngines = /* GraphQL */ `query ListRagEngines {
  listRagEngines {
    id
    name
    enabled
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListRagEnginesQueryVariables,
  APITypes.ListRagEnginesQuery
>;
export const performSemanticSearch = /* GraphQL */ `query PerformSemanticSearch($input: SemanticSearchInput!) {
  performSemanticSearch(input: $input) {
    engine
    workspaceId
    queryLanguage
    supportedLanguages
    detectedLanguages {
      code
      score
      __typename
    }
    items {
      sources
      chunkId
      workspaceId
      documentId
      documentSubId
      documentSubType
      documentType
      path
      language
      title
      content
      contentComplement
      vectorSearchScore
      keywordSearchScore
      score
      __typename
    }
    vectorSearchMetric
    vectorSearchItems {
      sources
      chunkId
      workspaceId
      documentId
      documentSubId
      documentSubType
      documentType
      path
      language
      title
      content
      contentComplement
      vectorSearchScore
      keywordSearchScore
      score
      __typename
    }
    keywordSearchItems {
      sources
      chunkId
      workspaceId
      documentId
      documentSubId
      documentSubType
      documentType
      path
      language
      title
      content
      contentComplement
      vectorSearchScore
      keywordSearchScore
      score
      __typename
    }
    __typename
  }
}
` as GeneratedQuery<
  APITypes.PerformSemanticSearchQueryVariables,
  APITypes.PerformSemanticSearchQuery
>;
export const listSessions = /* GraphQL */ `query ListSessions {
  listSessions {
    id
    title
    startTime
    history {
      type
      content
      metadata
      __typename
    }
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListSessionsQueryVariables,
  APITypes.ListSessionsQuery
>;
export const listEmbeddingModels = /* GraphQL */ `query ListEmbeddingModels {
  listEmbeddingModels {
    provider
    name
    dimensions
    default
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListEmbeddingModelsQueryVariables,
  APITypes.ListEmbeddingModelsQuery
>;
export const calculateEmbeddings = /* GraphQL */ `query CalculateEmbeddings($input: CalculateEmbeddingsInput!) {
  calculateEmbeddings(input: $input) {
    passage
    vector
    __typename
  }
}
` as GeneratedQuery<
  APITypes.CalculateEmbeddingsQueryVariables,
  APITypes.CalculateEmbeddingsQuery
>;
export const getSession = /* GraphQL */ `query GetSession($id: String!) {
  getSession(id: $id) {
    id
    title
    startTime
    history {
      type
      content
      metadata
      __typename
    }
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetSessionQueryVariables,
  APITypes.GetSessionQuery
>;
export const listKendraIndexes = /* GraphQL */ `query ListKendraIndexes {
  listKendraIndexes {
    id
    name
    external
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListKendraIndexesQueryVariables,
  APITypes.ListKendraIndexesQuery
>;
export const isKendraDataSynching = /* GraphQL */ `query IsKendraDataSynching($workspaceId: String!) {
  isKendraDataSynching(workspaceId: $workspaceId)
}
` as GeneratedQuery<
  APITypes.IsKendraDataSynchingQueryVariables,
  APITypes.IsKendraDataSynchingQuery
>;
export const listDocuments = /* GraphQL */ `query ListDocuments($input: ListDocumentsInput!) {
  listDocuments(input: $input) {
    items {
      workspaceId
      id
      type
      subType
      status
      title
      path
      sizeInBytes
      vectors
      subDocuments
      crawlerProperties {
        followLinks
        limit
        __typename
      }
      errors
      createdAt
      updatedAt
      rssFeedId
      rssLastCheckedAt
      __typename
    }
    lastDocumentId
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListDocumentsQueryVariables,
  APITypes.ListDocumentsQuery
>;
export const getDocument = /* GraphQL */ `query GetDocument($input: GetDocumentInput!) {
  getDocument(input: $input) {
    workspaceId
    id
    type
    subType
    status
    title
    path
    sizeInBytes
    vectors
    subDocuments
    crawlerProperties {
      followLinks
      limit
      __typename
    }
    errors
    createdAt
    updatedAt
    rssFeedId
    rssLastCheckedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetDocumentQueryVariables,
  APITypes.GetDocumentQuery
>;
export const getRSSPosts = /* GraphQL */ `query GetRSSPosts($input: GetRSSPostsInput!) {
  getRSSPosts(input: $input) {
    items {
      workspaceId
      id
      type
      subType
      status
      title
      path
      sizeInBytes
      vectors
      subDocuments
      crawlerProperties {
        followLinks
        limit
        __typename
      }
      errors
      createdAt
      updatedAt
      rssFeedId
      rssLastCheckedAt
      __typename
    }
    lastDocumentId
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetRSSPostsQueryVariables,
  APITypes.GetRSSPostsQuery
>;
export const listCrossEncoders = /* GraphQL */ `query ListCrossEncoders {
  listCrossEncoders {
    provider
    name
    default
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListCrossEncodersQueryVariables,
  APITypes.ListCrossEncodersQuery
>;
export const rankPassages = /* GraphQL */ `query RankPassages($input: RankPassagesInput!) {
  rankPassages(input: $input) {
    score
    passage
    __typename
  }
}
` as GeneratedQuery<
  APITypes.RankPassagesQueryVariables,
  APITypes.RankPassagesQuery
>;
