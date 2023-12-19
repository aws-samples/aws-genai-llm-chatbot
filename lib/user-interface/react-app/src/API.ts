/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type Channel = {
  __typename: "Channel",
  data?: string | null,
  sessionId?: string | null,
  userId?: string | null,
};

export type CreateWorkspaceKendraInput = {
  name: string,
  kind: string,
  kendraIndexId: string,
  useAllData: boolean,
};

export type Workspace = {
  __typename: "Workspace",
  id: string,
  name: string,
  formatVersion?: number | null,
  engine: string,
  status?: string | null,
  aossEngine?: string | null,
  languages?: Array< string | null > | null,
  hasIndex?: boolean | null,
  embeddingsModelProvider?: string | null,
  embeddingsModelName?: string | null,
  embeddingsModelDimensions?: number | null,
  crossEncoderModelName?: string | null,
  crossEncoderModelProvider?: string | null,
  metric?: string | null,
  index?: boolean | null,
  hybridSearch?: boolean | null,
  chunkingStrategy?: string | null,
  chunkSize?: number | null,
  chunkOverlap?: number | null,
  vectors?: number | null,
  documents?: number | null,
  sizeInBytes?: number | null,
  kendraIndexId?: string | null,
  kendraIndexExternal?: string | null,
  kendraUseAllData?: boolean | null,
  createdAt: string,
  updatedAt: string,
};

export type CreateWorkspaceOpenSearchInput = {
  name: string,
  kind: string,
  embeddingsModelProvider: string,
  embeddingsModelName: string,
  crossEncoderModelProvider: string,
  crossEncoderModelName: string,
  languages: Array< string >,
  hybridSearch: boolean,
  chunkingStrategy: string,
  chunkSize: number,
  chunkOverlap: number,
};

export type CreateWorkspaceAuroraInput = {
  name: string,
  kind: string,
  embeddingsModelProvider: string,
  embeddingsModelName: string,
  crossEncoderModelProvider: string,
  crossEncoderModelName: string,
  languages: Array< string >,
  metric: string,
  index: boolean,
  hybridSearch: boolean,
  chunkingStrategy: string,
  chunkSize: number,
  chunkOverlap: number,
};

export type TextDocumentInput = {
  workspaceId: string,
  title: string,
  content: string,
};

export type DocumentResult = {
  __typename: "DocumentResult",
  workspaceId: string,
  documentId: string,
  status?: string | null,
};

export type QnADocumentInput = {
  workspaceId: string,
  question: string,
  answer: string,
};

export type DocumentSubscriptionStatusInput = {
  workspaceId: string,
  documentId: string,
  status: string,
};

export type WebsiteInput = {
  workspaceId: string,
  sitemap: boolean,
  address: string,
  followLinks: boolean,
  limit: number,
};

export type RssFeedInput = {
  workspaceId: string,
  address: string,
  limit: number,
  title?: string | null,
  followLinks: boolean,
};

export type DeleteSessionResult = {
  __typename: "DeleteSessionResult",
  id?: string | null,
  deleted: boolean,
};

export type FileUploadInput = {
  workspaceId: string,
  fileName: string,
};

export type FileUploadResult = {
  __typename: "FileUploadResult",
  url: string,
  fields?: string | null,
};

export type Model = {
  __typename: "Model",
  name: string,
  provider: string,
  interface: string,
  ragSupported: boolean,
  inputModalities: Array< string >,
  outputModalities: Array< string >,
  streaming: boolean,
};

export type RagEngine = {
  __typename: "RagEngine",
  id: string,
  name: string,
  enabled: boolean,
};

export type SemanticSearchInput = {
  workspaceId: string,
  query: string,
};

export type SemanticSearchResult = {
  __typename: "SemanticSearchResult",
  engine: string,
  workspaceId: string,
  queryLanguage?: string | null,
  supportedLanguages?: Array< string > | null,
  detectedLanguages?:  Array<DetectedLanguage > | null,
  items?:  Array<SemanticSearchItem > | null,
  vectorSearchMetric?: string | null,
  vectorSearchItems?:  Array<SemanticSearchItem > | null,
  keywordSearchItems?:  Array<SemanticSearchItem > | null,
};

export type DetectedLanguage = {
  __typename: "DetectedLanguage",
  code: string,
  score: number,
};

export type SemanticSearchItem = {
  __typename: "SemanticSearchItem",
  sources?: Array< string | null > | null,
  chunkId?: string | null,
  workspaceId: string,
  documentId?: string | null,
  documentSubId?: string | null,
  documentSubType?: string | null,
  documentType: string,
  path?: string | null,
  language?: string | null,
  title?: string | null,
  content?: string | null,
  contentComplement?: string | null,
  vectorSearchScore?: number | null,
  keywordSearchScore?: number | null,
  score?: number | null,
};

export type Session = {
  __typename: "Session",
  id: string,
  title?: string | null,
  startTime: string,
  history?:  Array<SessionHistoryItem | null > | null,
};

export type SessionHistoryItem = {
  __typename: "SessionHistoryItem",
  type: string,
  content: string,
  metadata?: string | null,
};

export type EmbeddingModel = {
  __typename: "EmbeddingModel",
  provider: string,
  name: string,
  dimensions: number,
  default?: boolean | null,
};

export type CalculateEmbeddingsInput = {
  provider: string,
  model: string,
  passages: Array< string | null >,
};

export type Embedding = {
  __typename: "Embedding",
  passage?: string | null,
  vector: Array< number >,
};

export type KendraIndex = {
  __typename: "KendraIndex",
  id: string,
  name: string,
  external: boolean,
};

export type ListDocumentsInput = {
  workspaceId: string,
  documentType: string,
  lastDocumentId?: string | null,
};

export type DocumentsResult = {
  __typename: "DocumentsResult",
  items:  Array<Document | null >,
  lastDocumentId?: string | null,
};

export type Document = {
  __typename: "Document",
  workspaceId: string,
  id: string,
  type: string,
  subType?: string | null,
  status?: string | null,
  title?: string | null,
  path?: string | null,
  sizeInBytes?: number | null,
  vectors?: number | null,
  subDocuments?: number | null,
  crawlerProperties?: CrawlerProperties | null,
  errors?: Array< string > | null,
  createdAt: string,
  updatedAt?: string | null,
  rssFeedId?: string | null,
  rssLastCheckedAt?: string | null,
};

export type CrawlerProperties = {
  __typename: "CrawlerProperties",
  followLinks?: boolean | null,
  limit?: number | null,
};

export type GetDocumentInput = {
  workspaceId: string,
  documentId: string,
};

export type GetRSSPostsInput = {
  workspaceId: string,
  documentId: string,
  lastDocumentId?: string | null,
};

export type CrossEncoderData = {
  __typename: "CrossEncoderData",
  provider: string,
  name: string,
  default: boolean,
};

export type RankPassagesInput = {
  provider: string,
  model: string,
  reference: string,
  passages: Array< string | null >,
};

export type PassageRank = {
  __typename: "PassageRank",
  score: number,
  passage: string,
};

export type SendQueryMutationVariables = {
  data?: string | null,
};

export type SendQueryMutation = {
  sendQuery?: string | null,
};

export type PublishResponseMutationVariables = {
  sessionId?: string | null,
  userId?: string | null,
  data?: string | null,
};

export type PublishResponseMutation = {
  publishResponse?:  {
    __typename: "Channel",
    data?: string | null,
    sessionId?: string | null,
    userId?: string | null,
  } | null,
};

export type CreateKendraWorkspaceMutationVariables = {
  input: CreateWorkspaceKendraInput,
};

export type CreateKendraWorkspaceMutation = {
  createKendraWorkspace:  {
    __typename: "Workspace",
    id: string,
    name: string,
    formatVersion?: number | null,
    engine: string,
    status?: string | null,
    aossEngine?: string | null,
    languages?: Array< string | null > | null,
    hasIndex?: boolean | null,
    embeddingsModelProvider?: string | null,
    embeddingsModelName?: string | null,
    embeddingsModelDimensions?: number | null,
    crossEncoderModelName?: string | null,
    crossEncoderModelProvider?: string | null,
    metric?: string | null,
    index?: boolean | null,
    hybridSearch?: boolean | null,
    chunkingStrategy?: string | null,
    chunkSize?: number | null,
    chunkOverlap?: number | null,
    vectors?: number | null,
    documents?: number | null,
    sizeInBytes?: number | null,
    kendraIndexId?: string | null,
    kendraIndexExternal?: string | null,
    kendraUseAllData?: boolean | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type CreateOpenSearchWorkspaceMutationVariables = {
  input: CreateWorkspaceOpenSearchInput,
};

export type CreateOpenSearchWorkspaceMutation = {
  createOpenSearchWorkspace:  {
    __typename: "Workspace",
    id: string,
    name: string,
    formatVersion?: number | null,
    engine: string,
    status?: string | null,
    aossEngine?: string | null,
    languages?: Array< string | null > | null,
    hasIndex?: boolean | null,
    embeddingsModelProvider?: string | null,
    embeddingsModelName?: string | null,
    embeddingsModelDimensions?: number | null,
    crossEncoderModelName?: string | null,
    crossEncoderModelProvider?: string | null,
    metric?: string | null,
    index?: boolean | null,
    hybridSearch?: boolean | null,
    chunkingStrategy?: string | null,
    chunkSize?: number | null,
    chunkOverlap?: number | null,
    vectors?: number | null,
    documents?: number | null,
    sizeInBytes?: number | null,
    kendraIndexId?: string | null,
    kendraIndexExternal?: string | null,
    kendraUseAllData?: boolean | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type CreateAuroraWorkspaceMutationVariables = {
  input: CreateWorkspaceAuroraInput,
};

export type CreateAuroraWorkspaceMutation = {
  createAuroraWorkspace:  {
    __typename: "Workspace",
    id: string,
    name: string,
    formatVersion?: number | null,
    engine: string,
    status?: string | null,
    aossEngine?: string | null,
    languages?: Array< string | null > | null,
    hasIndex?: boolean | null,
    embeddingsModelProvider?: string | null,
    embeddingsModelName?: string | null,
    embeddingsModelDimensions?: number | null,
    crossEncoderModelName?: string | null,
    crossEncoderModelProvider?: string | null,
    metric?: string | null,
    index?: boolean | null,
    hybridSearch?: boolean | null,
    chunkingStrategy?: string | null,
    chunkSize?: number | null,
    chunkOverlap?: number | null,
    vectors?: number | null,
    documents?: number | null,
    sizeInBytes?: number | null,
    kendraIndexId?: string | null,
    kendraIndexExternal?: string | null,
    kendraUseAllData?: boolean | null,
    createdAt: string,
    updatedAt: string,
  },
};

export type StartKendraDataSyncMutationVariables = {
  workspaceId: string,
};

export type StartKendraDataSyncMutation = {
  startKendraDataSync?: boolean | null,
};

export type DeleteWorkspaceMutationVariables = {
  workspaceId: string,
};

export type DeleteWorkspaceMutation = {
  deleteWorkspace?: boolean | null,
};

export type AddTextDocumentMutationVariables = {
  input: TextDocumentInput,
};

export type AddTextDocumentMutation = {
  addTextDocument?:  {
    __typename: "DocumentResult",
    workspaceId: string,
    documentId: string,
    status?: string | null,
  } | null,
};

export type AddQnADocumentMutationVariables = {
  input: QnADocumentInput,
};

export type AddQnADocumentMutation = {
  addQnADocument?:  {
    __typename: "DocumentResult",
    workspaceId: string,
    documentId: string,
    status?: string | null,
  } | null,
};

export type SetDocumentSubscriptionStatusMutationVariables = {
  input: DocumentSubscriptionStatusInput,
};

export type SetDocumentSubscriptionStatusMutation = {
  setDocumentSubscriptionStatus?:  {
    __typename: "DocumentResult",
    workspaceId: string,
    documentId: string,
    status?: string | null,
  } | null,
};

export type AddWebsiteMutationVariables = {
  input: WebsiteInput,
};

export type AddWebsiteMutation = {
  addWebsite?:  {
    __typename: "DocumentResult",
    workspaceId: string,
    documentId: string,
    status?: string | null,
  } | null,
};

export type AddRssFeedMutationVariables = {
  input: RssFeedInput,
};

export type AddRssFeedMutation = {
  addRssFeed?:  {
    __typename: "DocumentResult",
    workspaceId: string,
    documentId: string,
    status?: string | null,
  } | null,
};

export type UpdateRssFeedMutationVariables = {
  input: RssFeedInput,
};

export type UpdateRssFeedMutation = {
  updateRssFeed?:  {
    __typename: "DocumentResult",
    workspaceId: string,
    documentId: string,
    status?: string | null,
  } | null,
};

export type DeleteUserSessionsMutationVariables = {
};

export type DeleteUserSessionsMutation = {
  deleteUserSessions?:  Array< {
    __typename: "DeleteSessionResult",
    id?: string | null,
    deleted: boolean,
  } > | null,
};

export type DeleteSessionMutationVariables = {
  id: string,
};

export type DeleteSessionMutation = {
  deleteSession?:  {
    __typename: "DeleteSessionResult",
    id?: string | null,
    deleted: boolean,
  } | null,
};

export type NoneQueryVariables = {
};

export type NoneQuery = {
  none?: string | null,
};

export type CheckHealthQueryVariables = {
};

export type CheckHealthQuery = {
  checkHealth?: boolean | null,
};

export type GetUploadFileURLQueryVariables = {
  input: FileUploadInput,
};

export type GetUploadFileURLQuery = {
  getUploadFileURL?:  {
    __typename: "FileUploadResult",
    url: string,
    fields?: string | null,
  } | null,
};

export type ListModelsQueryVariables = {
};

export type ListModelsQuery = {
  listModels:  Array< {
    __typename: "Model",
    name: string,
    provider: string,
    interface: string,
    ragSupported: boolean,
    inputModalities: Array< string >,
    outputModalities: Array< string >,
    streaming: boolean,
  } >,
};

export type ListWorkspacesQueryVariables = {
};

export type ListWorkspacesQuery = {
  listWorkspaces:  Array< {
    __typename: "Workspace",
    id: string,
    name: string,
    formatVersion?: number | null,
    engine: string,
    status?: string | null,
    aossEngine?: string | null,
    languages?: Array< string | null > | null,
    hasIndex?: boolean | null,
    embeddingsModelProvider?: string | null,
    embeddingsModelName?: string | null,
    embeddingsModelDimensions?: number | null,
    crossEncoderModelName?: string | null,
    crossEncoderModelProvider?: string | null,
    metric?: string | null,
    index?: boolean | null,
    hybridSearch?: boolean | null,
    chunkingStrategy?: string | null,
    chunkSize?: number | null,
    chunkOverlap?: number | null,
    vectors?: number | null,
    documents?: number | null,
    sizeInBytes?: number | null,
    kendraIndexId?: string | null,
    kendraIndexExternal?: string | null,
    kendraUseAllData?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } >,
};

export type GetWorkspaceQueryVariables = {
  workspaceId: string,
};

export type GetWorkspaceQuery = {
  getWorkspace?:  {
    __typename: "Workspace",
    id: string,
    name: string,
    formatVersion?: number | null,
    engine: string,
    status?: string | null,
    aossEngine?: string | null,
    languages?: Array< string | null > | null,
    hasIndex?: boolean | null,
    embeddingsModelProvider?: string | null,
    embeddingsModelName?: string | null,
    embeddingsModelDimensions?: number | null,
    crossEncoderModelName?: string | null,
    crossEncoderModelProvider?: string | null,
    metric?: string | null,
    index?: boolean | null,
    hybridSearch?: boolean | null,
    chunkingStrategy?: string | null,
    chunkSize?: number | null,
    chunkOverlap?: number | null,
    vectors?: number | null,
    documents?: number | null,
    sizeInBytes?: number | null,
    kendraIndexId?: string | null,
    kendraIndexExternal?: string | null,
    kendraUseAllData?: boolean | null,
    createdAt: string,
    updatedAt: string,
  } | null,
};

export type ListRagEnginesQueryVariables = {
};

export type ListRagEnginesQuery = {
  listRagEngines:  Array< {
    __typename: "RagEngine",
    id: string,
    name: string,
    enabled: boolean,
  } >,
};

export type PerformSemanticSearchQueryVariables = {
  input: SemanticSearchInput,
};

export type PerformSemanticSearchQuery = {
  performSemanticSearch:  {
    __typename: "SemanticSearchResult",
    engine: string,
    workspaceId: string,
    queryLanguage?: string | null,
    supportedLanguages?: Array< string > | null,
    detectedLanguages?:  Array< {
      __typename: "DetectedLanguage",
      code: string,
      score: number,
    } > | null,
    items?:  Array< {
      __typename: "SemanticSearchItem",
      sources?: Array< string | null > | null,
      chunkId?: string | null,
      workspaceId: string,
      documentId?: string | null,
      documentSubId?: string | null,
      documentSubType?: string | null,
      documentType: string,
      path?: string | null,
      language?: string | null,
      title?: string | null,
      content?: string | null,
      contentComplement?: string | null,
      vectorSearchScore?: number | null,
      keywordSearchScore?: number | null,
      score?: number | null,
    } > | null,
    vectorSearchMetric?: string | null,
    vectorSearchItems?:  Array< {
      __typename: "SemanticSearchItem",
      sources?: Array< string | null > | null,
      chunkId?: string | null,
      workspaceId: string,
      documentId?: string | null,
      documentSubId?: string | null,
      documentSubType?: string | null,
      documentType: string,
      path?: string | null,
      language?: string | null,
      title?: string | null,
      content?: string | null,
      contentComplement?: string | null,
      vectorSearchScore?: number | null,
      keywordSearchScore?: number | null,
      score?: number | null,
    } > | null,
    keywordSearchItems?:  Array< {
      __typename: "SemanticSearchItem",
      sources?: Array< string | null > | null,
      chunkId?: string | null,
      workspaceId: string,
      documentId?: string | null,
      documentSubId?: string | null,
      documentSubType?: string | null,
      documentType: string,
      path?: string | null,
      language?: string | null,
      title?: string | null,
      content?: string | null,
      contentComplement?: string | null,
      vectorSearchScore?: number | null,
      keywordSearchScore?: number | null,
      score?: number | null,
    } > | null,
  },
};

export type ListSessionsQueryVariables = {
};

export type ListSessionsQuery = {
  listSessions:  Array< {
    __typename: "Session",
    id: string,
    title?: string | null,
    startTime: string,
    history?:  Array< {
      __typename: "SessionHistoryItem",
      type: string,
      content: string,
      metadata?: string | null,
    } | null > | null,
  } >,
};

export type ListEmbeddingModelsQueryVariables = {
};

export type ListEmbeddingModelsQuery = {
  listEmbeddingModels:  Array< {
    __typename: "EmbeddingModel",
    provider: string,
    name: string,
    dimensions: number,
    default?: boolean | null,
  } >,
};

export type CalculateEmbeddingsQueryVariables = {
  input: CalculateEmbeddingsInput,
};

export type CalculateEmbeddingsQuery = {
  calculateEmbeddings:  Array< {
    __typename: "Embedding",
    passage?: string | null,
    vector: Array< number >,
  } | null >,
};

export type GetSessionQueryVariables = {
  id: string,
};

export type GetSessionQuery = {
  getSession?:  {
    __typename: "Session",
    id: string,
    title?: string | null,
    startTime: string,
    history?:  Array< {
      __typename: "SessionHistoryItem",
      type: string,
      content: string,
      metadata?: string | null,
    } | null > | null,
  } | null,
};

export type ListKendraIndexesQueryVariables = {
};

export type ListKendraIndexesQuery = {
  listKendraIndexes:  Array< {
    __typename: "KendraIndex",
    id: string,
    name: string,
    external: boolean,
  } >,
};

export type IsKendraDataSynchingQueryVariables = {
  workspaceId: string,
};

export type IsKendraDataSynchingQuery = {
  isKendraDataSynching?: boolean | null,
};

export type ListDocumentsQueryVariables = {
  input: ListDocumentsInput,
};

export type ListDocumentsQuery = {
  listDocuments:  {
    __typename: "DocumentsResult",
    items:  Array< {
      __typename: "Document",
      workspaceId: string,
      id: string,
      type: string,
      subType?: string | null,
      status?: string | null,
      title?: string | null,
      path?: string | null,
      sizeInBytes?: number | null,
      vectors?: number | null,
      subDocuments?: number | null,
      crawlerProperties?:  {
        __typename: "CrawlerProperties",
        followLinks?: boolean | null,
        limit?: number | null,
      } | null,
      errors?: Array< string > | null,
      createdAt: string,
      updatedAt?: string | null,
      rssFeedId?: string | null,
      rssLastCheckedAt?: string | null,
    } | null >,
    lastDocumentId?: string | null,
  },
};

export type GetDocumentQueryVariables = {
  input: GetDocumentInput,
};

export type GetDocumentQuery = {
  getDocument?:  {
    __typename: "Document",
    workspaceId: string,
    id: string,
    type: string,
    subType?: string | null,
    status?: string | null,
    title?: string | null,
    path?: string | null,
    sizeInBytes?: number | null,
    vectors?: number | null,
    subDocuments?: number | null,
    crawlerProperties?:  {
      __typename: "CrawlerProperties",
      followLinks?: boolean | null,
      limit?: number | null,
    } | null,
    errors?: Array< string > | null,
    createdAt: string,
    updatedAt?: string | null,
    rssFeedId?: string | null,
    rssLastCheckedAt?: string | null,
  } | null,
};

export type GetRSSPostsQueryVariables = {
  input: GetRSSPostsInput,
};

export type GetRSSPostsQuery = {
  getRSSPosts?:  {
    __typename: "DocumentsResult",
    items:  Array< {
      __typename: "Document",
      workspaceId: string,
      id: string,
      type: string,
      subType?: string | null,
      status?: string | null,
      title?: string | null,
      path?: string | null,
      sizeInBytes?: number | null,
      vectors?: number | null,
      subDocuments?: number | null,
      crawlerProperties?:  {
        __typename: "CrawlerProperties",
        followLinks?: boolean | null,
        limit?: number | null,
      } | null,
      errors?: Array< string > | null,
      createdAt: string,
      updatedAt?: string | null,
      rssFeedId?: string | null,
      rssLastCheckedAt?: string | null,
    } | null >,
    lastDocumentId?: string | null,
  } | null,
};

export type ListCrossEncodersQueryVariables = {
};

export type ListCrossEncodersQuery = {
  listCrossEncoders?:  Array< {
    __typename: "CrossEncoderData",
    provider: string,
    name: string,
    default: boolean,
  } > | null,
};

export type RankPassagesQueryVariables = {
  input: RankPassagesInput,
};

export type RankPassagesQuery = {
  rankPassages:  Array< {
    __typename: "PassageRank",
    score: number,
    passage: string,
  } >,
};

export type ReceiveMessagesSubscriptionVariables = {
  sessionId?: string | null,
};

export type ReceiveMessagesSubscription = {
  receiveMessages?:  {
    __typename: "Channel",
    data?: string | null,
    sessionId?: string | null,
    userId?: string | null,
  } | null,
};
