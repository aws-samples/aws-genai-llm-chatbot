/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const createKendraWorkspace = /* GraphQL */ `mutation CreateKendraWorkspace($input: CreateWorkspaceKendraInput!) {
  createKendraWorkspace(input: $input) {
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
    knowledgeBaseId
    knowledgeBaseExternal
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateKendraWorkspaceMutationVariables,
  APITypes.CreateKendraWorkspaceMutation
>;
export const createBedrockKBWorkspace = /* GraphQL */ `mutation CreateBedrockKBWorkspace($input: CreateWorkspaceBedrockKBInput!) {
  createBedrockKBWorkspace(input: $input) {
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
    knowledgeBaseId
    knowledgeBaseExternal
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateBedrockKBWorkspaceMutationVariables,
  APITypes.CreateBedrockKBWorkspaceMutation
>;
export const createOpenSearchWorkspace = /* GraphQL */ `mutation CreateOpenSearchWorkspace($input: CreateWorkspaceOpenSearchInput!) {
  createOpenSearchWorkspace(input: $input) {
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
    knowledgeBaseId
    knowledgeBaseExternal
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateOpenSearchWorkspaceMutationVariables,
  APITypes.CreateOpenSearchWorkspaceMutation
>;
export const createAuroraWorkspace = /* GraphQL */ `mutation CreateAuroraWorkspace($input: CreateWorkspaceAuroraInput!) {
  createAuroraWorkspace(input: $input) {
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
    knowledgeBaseId
    knowledgeBaseExternal
    createdAt
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateAuroraWorkspaceMutationVariables,
  APITypes.CreateAuroraWorkspaceMutation
>;
export const startKendraDataSync = /* GraphQL */ `mutation StartKendraDataSync($workspaceId: String!) {
  startKendraDataSync(workspaceId: $workspaceId)
}
` as GeneratedMutation<
  APITypes.StartKendraDataSyncMutationVariables,
  APITypes.StartKendraDataSyncMutation
>;
export const deleteWorkspace = /* GraphQL */ `mutation DeleteWorkspace($workspaceId: String!) {
  deleteWorkspace(workspaceId: $workspaceId)
}
` as GeneratedMutation<
  APITypes.DeleteWorkspaceMutationVariables,
  APITypes.DeleteWorkspaceMutation
>;
export const deleteDocument = /* GraphQL */ `mutation DeleteDocument($input: DeleteDocumentInput!) {
  deleteDocument(input: $input) {
    documentId
    deleted
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteDocumentMutationVariables,
  APITypes.DeleteDocumentMutation
>;
export const addTextDocument = /* GraphQL */ `mutation AddTextDocument($input: TextDocumentInput!) {
  addTextDocument(input: $input) {
    workspaceId
    documentId
    status
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AddTextDocumentMutationVariables,
  APITypes.AddTextDocumentMutation
>;
export const addUserFeedback = /* GraphQL */ `mutation AddUserFeedback($input: UserFeedbackInput!) {
  addUserFeedback(input: $input) {
    feedback_id
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AddUserFeedbackMutationVariables,
  APITypes.AddUserFeedbackMutation
>;
export const addQnADocument = /* GraphQL */ `mutation AddQnADocument($input: QnADocumentInput!) {
  addQnADocument(input: $input) {
    workspaceId
    documentId
    status
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AddQnADocumentMutationVariables,
  APITypes.AddQnADocumentMutation
>;
export const setDocumentSubscriptionStatus = /* GraphQL */ `mutation SetDocumentSubscriptionStatus(
  $input: DocumentSubscriptionStatusInput!
) {
  setDocumentSubscriptionStatus(input: $input) {
    workspaceId
    documentId
    status
    __typename
  }
}
` as GeneratedMutation<
  APITypes.SetDocumentSubscriptionStatusMutationVariables,
  APITypes.SetDocumentSubscriptionStatusMutation
>;
export const addWebsite = /* GraphQL */ `mutation AddWebsite($input: WebsiteInput!) {
  addWebsite(input: $input) {
    workspaceId
    documentId
    status
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AddWebsiteMutationVariables,
  APITypes.AddWebsiteMutation
>;
export const addRssFeed = /* GraphQL */ `mutation AddRssFeed($input: RssFeedInput!) {
  addRssFeed(input: $input) {
    workspaceId
    documentId
    status
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AddRssFeedMutationVariables,
  APITypes.AddRssFeedMutation
>;
export const updateRssFeed = /* GraphQL */ `mutation UpdateRssFeed($input: UpdateRssFeedInput!) {
  updateRssFeed(input: $input) {
    workspaceId
    documentId
    status
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateRssFeedMutationVariables,
  APITypes.UpdateRssFeedMutation
>;
export const deleteUserSessions = /* GraphQL */ `mutation DeleteUserSessions {
  deleteUserSessions {
    id
    deleted
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteUserSessionsMutationVariables,
  APITypes.DeleteUserSessionsMutation
>;
export const deleteSession = /* GraphQL */ `mutation DeleteSession($id: String!) {
  deleteSession(id: $id) {
    id
    deleted
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteSessionMutationVariables,
  APITypes.DeleteSessionMutation
>;
export const sendQuery = /* GraphQL */ `mutation SendQuery($data: String) {
  sendQuery(data: $data)
}
` as GeneratedMutation<
  APITypes.SendQueryMutationVariables,
  APITypes.SendQueryMutation
>;
export const publishResponse = /* GraphQL */ `mutation PublishResponse($sessionId: String, $userId: String, $data: String) {
  publishResponse(sessionId: $sessionId, userId: $userId, data: $data) {
    data
    sessionId
    userId
    __typename
  }
}
` as GeneratedMutation<
  APITypes.PublishResponseMutationVariables,
  APITypes.PublishResponseMutation
>;
export const createApplication = /* GraphQL */ `mutation CreateApplication($input: ManageApplicationInput!) {
  createApplication(input: $input) {
    id
    name
    model
    workspace
    systemPrompt
    systemPromptRag
    condenseSystemPrompt
    roles
    allowImageInput
    allowDocumentInput
    allowVideoInput
    outputModalities
    enableGuardrails
    streaming
    maxTokens
    temperature
    topP
    seed
    createTime
    updateTime
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateApplicationMutationVariables,
  APITypes.CreateApplicationMutation
>;
export const updateApplication = /* GraphQL */ `mutation UpdateApplication($input: ManageApplicationInput!) {
  updateApplication(input: $input) {
    id
    name
    model
    workspace
    systemPrompt
    systemPromptRag
    condenseSystemPrompt
    roles
    allowImageInput
    allowDocumentInput
    allowVideoInput
    outputModalities
    enableGuardrails
    streaming
    maxTokens
    temperature
    topP
    seed
    createTime
    updateTime
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateApplicationMutationVariables,
  APITypes.UpdateApplicationMutation
>;
export const deleteApplication = /* GraphQL */ `mutation DeleteApplication($id: String!) {
  deleteApplication(id: $id)
}
` as GeneratedMutation<
  APITypes.DeleteApplicationMutationVariables,
  APITypes.DeleteApplicationMutation
>;
