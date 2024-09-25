import os
import boto3
import psycopg2
import psycopg2.extras
from datetime import datetime, timedelta
from pgvector.psycopg2 import register_vector

client = boto3.client("rds")

AURORA_DB_USER = os.environ.get("AURORA_DB_USER")
AURORA_DB_HOST = os.environ.get("AURORA_DB_HOST")
AURORA_DB_PORT = os.environ.get("AURORA_DB_PORT")
AURORA_DB_REGION = os.environ.get("AWS_REGION")


class AuroraConnection(object):
    token = None
    token_refresh = datetime.now() - timedelta(minutes=1)

    def __init__(self, autocommit=True):
        now = datetime.now()
        if AuroraConnection.token_refresh < now:
            AuroraConnection.token_refresh = now + timedelta(
                minutes=10
            )  # Expires after 15 min
            # Base on
            # https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.Connecting.Python.html
            AuroraConnection.token = client.generate_db_auth_token(
                DBHostname=AURORA_DB_HOST,
                Port=AURORA_DB_PORT,
                DBUsername=AURORA_DB_USER,
                Region=AURORA_DB_REGION,
            )
        self.autocommit = autocommit

        self.dbhost = AURORA_DB_HOST
        self.dbport = AURORA_DB_PORT
        self.dbuser = AURORA_DB_USER
        self.dbpass = AuroraConnection.token

        if AuroraConnection.token is None:
            raise ValueError("Token is not set.")

    def __enter__(self):
        connection = psycopg2.connect(
            database="postgres",
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
