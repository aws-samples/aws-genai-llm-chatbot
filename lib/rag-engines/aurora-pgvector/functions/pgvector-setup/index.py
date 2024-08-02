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
    AURORA_DB_NAME= resource_properties["AURORA_DB_NAME"]

    secret_response = secretsmanager_client.get_secret_value(
        SecretId=AURORA_DB_SECRET_ID
    )
    database_secrets = json.loads(secret_response["SecretString"])

    if request_type == "Create" or request_type == "Update":
        db_conn_args = {
            "host": database_secrets["host"],
            "user": database_secrets["username"],
            "password": database_secrets["password"],
            "port": database_secrets["port"],
            "connect_timeout":10,
        }
        if "dbname" in database_secrets:
            db_conn_args["dbname"] = database_secrets["dbname"]
        dbconn = psycopg2.connect(**db_conn_args)
        dbconn.set_session(autocommit=True)
        cur = dbconn.cursor()

        # Check if database exists, if not create it.
        cur.execute(f"SELECT * FROM pg_database WHERE LOWER(datname) = LOWER('{AURORA_DB_NAME}')")
        rows = cur.fetchall()
        if len(rows) == 0:
            cur.execute(f"CREATE DATABASE {AURORA_DB_NAME}")
            logger.info(f"Created database {AURORA_DB_NAME}")
            # close existing connection and re-open connect to the new database
            cur.close()
            db_conn_args["dbname"] = AURORA_DB_NAME
            dbconn = psycopg2.connect(**db_conn_args)
            dbconn.set_session(autocommit=True)
            cur = dbconn.cursor()
        else:
            logger.info(f"Database {AURORA_DB_NAME} already exists")
        cur.close()

        # Create vector extension if not exists. This will create the vector type.
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
