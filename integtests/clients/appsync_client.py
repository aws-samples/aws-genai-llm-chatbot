import os
from gql import Client
from gql.transport.aiohttp import AIOHTTPTransport
from gql.dsl import DSLMutation, DSLSchema, DSLQuery, dsl_gql
from graphql import print_ast


class AppSyncClient:
    def __init__(self, endpoint: str, id_token: str) -> None:
        self.transport = AIOHTTPTransport(
            url=endpoint
        )
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
