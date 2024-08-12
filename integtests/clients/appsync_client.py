import os
from gql import Client
from gql.transport.aiohttp import AIOHTTPTransport
from gql.dsl import DSLMutation, DSLSchema, DSLQuery, dsl_gql


class AppSyncClient:
    def __init__(self, endpoint: str, id_token: str) -> None:
        self.transport = AIOHTTPTransport(url=endpoint)
        if id_token is not None:
            self.transport.headers = {"Authorization": id_token}
        dir_path = os.path.dirname(os.path.realpath(__file__))
        with open(dir_path + "/../../lib/chatbot-api/schema/schema.graphql") as f:
            schema_string = f.read()

        # remove AWS specific syntax from the schema
        schema_string = schema_string.replace("@aws_cognito_user_pools", "")
        schema_string = schema_string.replace("@aws_iam", "")
        schema_string = schema_string.replace(
            '@aws_subscribe(mutations: ["publishResponse"])', ""
        )
        schema_string = schema_string.replace("AWSDateTime", "String")

        self.client = Client(transport=self.transport, schema=schema_string)
        self.schema = DSLSchema(self.client.schema)

    def send_query(self, data: str):
        query = dsl_gql(DSLMutation(self.schema.Mutation.sendQuery.args(data=data)))
        return self.client.execute(query)

    def list_models(self):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.listModels.select(
                    self.schema.Model.name,
                    self.schema.Model.provider,
                    self.schema.Model.interface,
                    self.schema.Model.ragSupported,
                    self.schema.Model.inputModalities,
                    self.schema.Model.outputModalities,
                    self.schema.Model.streaming,
                )
            )
        )
        return self.client.execute(query).get("listModels")

    def list_rag_engines(self):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.listRagEngines.select(
                    self.schema.RagEngine.id,
                    self.schema.RagEngine.name,
                    self.schema.RagEngine.enabled,
                )
            )
        )
        return self.client.execute(query).get("listRagEngines")

    def delete_session(self, id: str):
        query = dsl_gql(
            DSLMutation(
                self.schema.Mutation.deleteSession.args(id=id).select(
                    self.schema.DeleteSessionResult.id,
                    self.schema.DeleteSessionResult.deleted,
                )
            )
        )
        return self.client.execute(query).get("deleteSession")

    def delete_user_sessions(self):
        query = dsl_gql(
            DSLMutation(
                self.schema.Mutation.deleteUserSessions.select(
                    self.schema.DeleteSessionResult.id,
                    self.schema.DeleteSessionResult.deleted,
                )
            )
        )
        return self.client.execute(query).get("deleteUserSessions")

    def list_sessions(self):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.listSessions.select(
                    self.schema.Session.id,
                    self.schema.Session.startTime,
                    self.schema.Session.title,
                    self.schema.Session.history.select(
                        self.schema.SessionHistoryItem.type,
                        self.schema.SessionHistoryItem.content,
                        self.schema.SessionHistoryItem.metadata,
                    ),
                )
            )
        )
        return self.client.execute(query).get("listSessions")

    def get_session(self, id):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.getSession(id=id).select(
                    self.schema.Session.id,
                    self.schema.Session.startTime,
                    self.schema.Session.title,
                    self.schema.Session.history.select(
                        self.schema.SessionHistoryItem.type,
                        self.schema.SessionHistoryItem.content,
                        self.schema.SessionHistoryItem.metadata,
                    ),
                )
            )
        )
        return self.client.execute(query).get("getSession")

    def create_opensearch_workspace(self, input):
        query = dsl_gql(
            DSLMutation(
                self.schema.Mutation.createOpenSearchWorkspace.args(input=input).select(
                    self.schema.Workspace.id,
                )
            )
        )
        return self.client.execute(query).get("createOpenSearchWorkspace")
    
    def list_workspaces(self):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.listWorkspaces.select(
                    self.schema.Workspace.id,
                    self.schema.Workspace.name,
                )
            )
        )
        return self.client.execute(query).get("listWorkspaces")
    
    def list_workspaces(self):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.listWorkspaces.select(
                    self.schema.Workspace.id,
                    self.schema.Workspace.name,
                    self.schema.Workspace.status,
                )
            )
        )
        return self.client.execute(query).get("listWorkspaces")
    
    def get_workspace(self, id):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.getWorkspace.args(workspaceId=id).select(
                    self.schema.Workspace.id,
                    self.schema.Workspace.name,
                    self.schema.Workspace.status,
                )
            )
        )
        return self.client.execute(query).get("getWorkspace")
    
    def delete_workspace(self, id):
        query = dsl_gql(
            DSLMutation(
                self.schema.Mutation.deleteWorkspace.args(workspaceId=id)
            )
        )
        return self.client.execute(query)
    
    def add_text(self, input):
        query = dsl_gql(
            DSLMutation(
                self.schema.Mutation.addTextDocument.args(input=input).select(
                    self.schema.DocumentResult.documentId,
                    self.schema.DocumentResult.status
                )
            )
        )
        return self.client.execute(query).get("addTextDocument")
    
    
    def get_document(self, input):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.getDocument.args(input=input).select(
                    self.schema.Document.workspaceId,
                    self.schema.Document.id,
                    self.schema.Document.status
                )
            )
        )
        return self.client.execute(query).get("getDocument")
    
    def semantic_search(self, input):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.performSemanticSearch.args(input=input).select(
                    self.schema.SemanticSearchResult.engine,
                    self.schema.SemanticSearchResult.workspaceId,
                    self.schema.SemanticSearchResult.items.select(
                        self.schema.SemanticSearchItem.content,
                        self.schema.SemanticSearchItem.documentId,
                        self.schema.SemanticSearchItem.score
                        ),
                )
            )
        )
        return self.client.execute(query).get("performSemanticSearch")
    
    def delete_document(self, input):
        query = dsl_gql(
            DSLMutation(
                self.schema.Mutation.deleteDocument.args(input=input).select(
                    self.schema.DeleteDocumentResult.deleted,
                    self.schema.DeleteDocumentResult.documentId,
                )
            )
        )
        return self.client.execute(query)
    
    def calculate_embeding(self, input):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.calculateEmbeddings.args(input=input).select(
                    self.schema.Embedding.passage,
                    self.schema.Embedding.vector,
                )
            )
        )
        return self.client.execute(query).get("calculateEmbeddings")
    
    
    def rank_passages(self, input):
        query = dsl_gql(
            DSLQuery(
                self.schema.Query.rankPassages.args(input=input).select(
                    self.schema.PassageRank.score,
                    self.schema.PassageRank.passage,
                )
            )
        )
        return self.client.execute(query).get("rankPassages")
    