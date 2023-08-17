import json

from aws_lambda_powertools import Logger

logger = Logger(service="SemanticSearchApi")


def query_cross_encoder_model(client, endpoint_name, sentence, candidates):
    logger.debug(
        f"Querying cross-encoder model {endpoint_name} with sentence: {sentence} and candidates: {candidates}"
    )
    payload = {"kind": "cross-encoder", "sentence": sentence, "candidates": candidates}
    logger.debug(f"payload: {payload}")

    payload_json = json.dumps(payload).encode("utf-8")
    logger.debug(f"payload_json: {payload_json}")

    logger.debug(f"Invoking endpoint {endpoint_name}")
    response = client.invoke_endpoint(
        EndpointName=endpoint_name, ContentType="application/json", Body=payload_json
    )
    logger.debug(f"response: {response}")

    bytes_data = response["Body"].read()
    logger.debug(f"bytes_data: {bytes_data}")

    str_data = bytes_data.decode("utf-8")
    logger.debug(f"str_data: {str_data}")

    model_predictions = json.loads(str_data)
    logger.debug(f"model_predictions: {model_predictions}")

    return model_predictions
