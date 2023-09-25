import os
import json
import boto3
import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector

secretsmanager_client = boto3.client("secretsmanager")
AURORA_DB_SECRET_ID = os.environ.get("AURORA_DB_SECRET_ID")


class AuroraConnection(object):
    def __init__(self, autocommit=True):
        secret_response = secretsmanager_client.get_secret_value(
            SecretId=AURORA_DB_SECRET_ID
        )
        database_secrets = json.loads(secret_response["SecretString"])
        self.autocommit = autocommit

        self.dbhost = database_secrets["host"]
        self.dbport = database_secrets["port"]
        self.dbuser = database_secrets["username"]
        self.dbpass = database_secrets["password"]

    def __enter__(self):
        connection = psycopg2.connect(
            host=self.dbhost,
            user=self.dbuser,
            password=self.dbpass,
            port=self.dbport,
            connect_timeout=10,
        )

        connection.set_session(autocommit=self.autocommit)
        psycopg2.extras.register_uuid()
        register_vector(connection)
        cursor = connection.cursor()
        self.connection = connection
        self.cursor = cursor

        return cursor

    def __exit__(self, *args):
        self.cursor.close()
        self.connection.close()
