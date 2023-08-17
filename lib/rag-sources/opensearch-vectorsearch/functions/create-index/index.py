import os
import urllib.parse

import boto3
import cfnresponse
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth

tracer = Tracer()
logger = Logger()


@logger.inject_lambda_context(log_event=True)
@tracer.capture_lambda_handler
def handler(event, context: LambdaContext):
    request_type = event["RequestType"]
    resource_properties = event["ResourceProperties"]

    logger.info(request_type)
    logger.info(resource_properties)

    # Mandatory properties
    index_name = resource_properties["IndexName"]
    endpoint = resource_properties["Endpoint"]

    # Optional properties
    dimension = resource_properties.get("Dimension", 512)
    vector_field = resource_properties.get("VectorField", "vector_field")
    text_field = resource_properties.get("TextField", "text")
    metadata_field = resource_properties.get("MetadataField", "metadata")
    port = resource_properties.get("Port", 443)
    region = resource_properties.get("Region", os.environ["AWS_REGION"])
    timeout = resource_properties.get("Timeout", 300)
    knn_algo_param_ef_search = resource_properties.get("KnnAlgoParamEfSearch", 512)

    service = "aoss"
    credentials = boto3.Session().get_credentials()
    awsauth = AWS4Auth(
        credentials.access_key,
        credentials.secret_key,
        region,
        service,
        session_token=credentials.token,
    )

    host = urllib.parse.urlparse(endpoint).hostname

    opensearch = OpenSearch(
        hosts=[{"host": host, "port": int(port)}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=timeout,
    )

    if request_type == "Create":
        logger.info(f"Creating index {index_name}")
        try:
            create_index(
                opensearch,
                index_name,
                vector_field,
                text_field,
                metadata_field,
                dimension,
                knn_algo_param_ef_search,
            )
        except Exception as e:
            logger.error(e)
            error = f"Error creating index {index_name}: {e}"
            logger.error(error)
            cfnresponse.send(
                event, context, cfnresponse.FAILED, {"ok": False, "error": error}
            )

    elif request_type == "Update":
        logger.info(f"Updating index {index_name}")
        try:
            delete_index(opensearch, index_name)
            create_index(
                opensearch,
                index_name,
                vector_field,
                text_field,
                metadata_field,
                dimension,
                knn_algo_param_ef_search,
            )
        except Exception as e:
            logger.error(e)
            error = f"Error updating index {index_name}: {e}"
            logger.error(error)
            cfnresponse.send(
                event, context, cfnresponse.FAILED, {"ok": False, "error": error}
            )

    elif request_type == "Delete":
        logger.info(f"Deleting index {index_name}")
        try:
            delete_index(opensearch, index_name)
        except Exception as e:
            logger.error(e)
            error = f"Error deleting index {index_name}: {e}"
            logger.error(error)
            cfnresponse.send(
                event, context, cfnresponse.FAILED, {"ok": False, "error": error}
            )

    else:
        error = f"Unknown request type {request_type}"
        logger.error(error)
        cfnresponse.send(
            event, context, cfnresponse.FAILED, {"ok": False, "error": error}
        )

    cfnresponse.send(event, context, cfnresponse.SUCCESS, {"ok": True})


def create_index(
    opensearch,
    index_name,
    vector_field,
    text_field,
    metadata_field,
    dimension,
    knn_algo_param_ef_search,
):
    index_body = {
        "settings": {
            "index": {
                "knn": True,
                "knn.algo_param.ef_search": knn_algo_param_ef_search,
            }
        },
        "mappings": {
            "properties": {
                vector_field: {
                    "type": "knn_vector",
                    "dimension": int(dimension),
                    "method": {
                        "name": "hnsw",
                        "space_type": "l2",
                        "engine": "nmslib",
                        "parameters": {"ef_construction": 512, "m": 16},
                    },
                },
                text_field: {"type": "text", "index": False},
                "url": {"type": "text", "index": True},
            }
        },
    }
    logger.info(f"Creating index {index_name} with body:")
    logger.info(index_body)

    response = opensearch.indices.create(index_name, body=index_body)
    logger.info(response)


def delete_index(opensearch, index_name):
    response = opensearch.indices.delete(index_name)
    logger.info(response)
