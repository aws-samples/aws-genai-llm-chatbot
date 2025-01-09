import json
import os
from urllib.parse import urlparse
import boto3
from botocore.awsrequest import AWSRequest
from botocore.auth import SigV4Auth
from aws_lambda_powertools import Logger, Tracer
import requests
import datetime

logger = Logger()
tracer = Tracer()

AWS_REGION = os.environ["AWS_REGION"]
APPSYNC_ENDPOINT = os.environ["APPSYNC_ENDPOINT"]


def query(user_id, session_id, data_object):
    # Create the data object and convert it to a JSON string

    # Convert to JSON string and escape quotes
    data_json = json.dumps(data_object).replace('"', '\\"')

    return f"""mutation Mutation {{
        publishResponse(
          data: "{data_json}",
          sessionId: "{session_id}",
          userId: "{user_id}"
        ) {{
          data
          sessionId
          userId
        }}
    }}"""


@tracer.capture_method
def direct_send_to_client(data):
    logger.info("Received message to send to client", data=data)
    query_string = query(
        user_id=data["userId"],
        session_id=data["data"]["sessionId"],
        data_object=data,
    )
    method = "POST"
    service = "appsync"
    url = APPSYNC_ENDPOINT
    region = AWS_REGION
    host = urlparse(APPSYNC_ENDPOINT).netloc
    session = boto3.Session()

    # Create the request with the current timestamp
    request = AWSRequest(
        method, url, headers={"Host": host, "Content-Type": "application/json"}
    )

    # Set the timestamp in the request context
    request.context["timestamp"] = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    # Get the SigV4 signer
    signer = SigV4Auth(session.get_credentials(), service, region)

    # Add logging before signing
    payload = json.dumps({"query": query_string.strip(), "variables": {}})
    request.data = payload.encode("utf-8")

    # Add auth headers
    signer.add_auth(request)

    try:
        response = requests.request(
            method,
            url,
            headers=dict(request.headers),
            data=payload,
            timeout=5,
        )
        logger.info("Request URL", url=url)
        logger.info("Request Payload", payload=payload)
        logger.info("Response Status", status=response.status_code)
        logger.info("Response Body", body=json.loads(response.content.decode("utf-8")))

        if response.status_code != 200:
            logger.error("Error Response Headers", headers=response.headers)
            for header, value in response.headers.items():
                logger.error(f"{header}: {value}")

        return response
    except Exception as e:
        logger.error(f"Error: {e}")
        raise
