import json
import boto3
import psycopg2
import cfnresponse
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext
from pgvector.psycopg2 import register_vector

logger = Logger()
secretsmanager_client = boto3.client("secretsmanager")


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    request_type = event["RequestType"]
    resource_properties = event["ResourceProperties"]
    AURORA_DB_SECRET_ID = resource_properties["AURORA_DB_SECRET_ID"]

    secret_response = secretsmanager_client.get_secret_value(
        SecretId=AURORA_DB_SECRET_ID
    )
    database_secrets = json.loads(secret_response["SecretString"])
    dbhost = database_secrets["host"]
    dbport = database_secrets["port"]
    dbuser = database_secrets["username"]
    dbpass = database_secrets["password"]

    if request_type == "Create" or request_type == "Update":
        dbconn = psycopg2.connect(
            host=dbhost, user=dbuser, password=dbpass, port=dbport, connect_timeout=10
        )

        dbconn.set_session(autocommit=True)

        cur = dbconn.cursor()

        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        register_vector(dbconn)

        cur.execute("SELECT typname FROM pg_type WHERE typname = 'vector';")
        rows = cur.fetchall()

        for row in rows:
            logger.info(f"pg_type.typname: {row}")

        cur.close()
        dbconn.close()

        logger.info("Created vector extension")

    cfnresponse.send(event, context, cfnresponse.SUCCESS, {"ok": True})

    return {"ok": True}
