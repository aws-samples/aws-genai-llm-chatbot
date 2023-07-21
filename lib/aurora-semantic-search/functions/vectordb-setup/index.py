import json
import boto3
import psycopg2
import cfnresponse
from pgvector.psycopg2 import register_vector
from aws_lambda_powertools import Logger
from aws_lambda_powertools.utilities.typing import LambdaContext

VALID_INDEX_TYPES = ["cosine", "l2", "inner"]

logger = Logger()
secretsmanager_client = boto3.client("secretsmanager")


@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context: LambdaContext):
    request_type = event["RequestType"]
    resource_properties = event["ResourceProperties"]

    DB_SECRET_ID = resource_properties["DB_SECRET_ID"]
    INDEX_TYPES = resource_properties.get("INDEX_TYPES", '')
    INDEX_TYPES = list(map(lambda val: val.strip(), INDEX_TYPES.split(',')))
    for index_type in INDEX_TYPES:
        if not index_type:
            continue
        if index_type not in VALID_INDEX_TYPES:
            raise ValueError(f"Invalid index type: {index_type}")

    secret_response = secretsmanager_client.get_secret_value(
        SecretId=DB_SECRET_ID)
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

        cur.execute(
            "CREATE TABLE IF NOT EXISTS documents (id bigserial primary key, url text, content text, content_embeddings vector(384));")

        cur.execute(
            "CREATE INDEX IF NOT EXISTS fulltxt_idx ON documents USING GIN (to_tsvector('english', content));")

        cur.execute("CREATE INDEX IF NOT EXISTS url_idx ON documents (url);")

        if "cosine" in INDEX_TYPES:
            logger.info("Creating cosine index")
            cur.execute(
                "CREATE INDEX IF NOT EXISTS content_cosine_idx ON documents USING ivfflat (content_embeddings vector_cosine_ops) WITH (lists = 100);")
        else:
            logger.info("Dropping cosine index")
            cur.execute("DROP INDEX IF EXISTS content_cosine_idx;")

        if "l2" in INDEX_TYPES:
            logger.info("Creating l2 index")
            cur.execute(
                "CREATE INDEX IF NOT EXISTS content_l2_idx ON documents USING ivfflat (content_embeddings vector_l2_ops) WITH (lists = 100);")
        else:
            logger.info("Dropping l2 index")
            cur.execute("DROP INDEX IF EXISTS content_l2_idx;")

        if "inner" in INDEX_TYPES:
            logger.info("Creating inner index")
            cur.execute(
                "CREATE INDEX IF NOT EXISTS content_inner_idx ON documents USING ivfflat (content_embeddings vector_ip_ops) WITH (lists = 100);")
        else:
            logger.info("Dropping inner index")
            cur.execute("DROP INDEX IF EXISTS content_inner_idx;")

        cur.close()
        dbconn.close()

        logger.info("Created vector extension")

    cfnresponse.send(event, context, cfnresponse.SUCCESS, {"ok": True})

    return {"ok": True}
