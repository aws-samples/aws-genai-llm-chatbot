import os
import boto3
import urllib.parse
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth


OPEN_SEARCH_COLLECTION_ENDPOINT = os.environ.get("OPEN_SEARCH_COLLECTION_ENDPOINT")

port = 443
timeout = 300


def get_open_search_client():
    service = "aoss"
    session = boto3.Session()
    credentials = session.get_credentials()
    host = urllib.parse.urlparse(OPEN_SEARCH_COLLECTION_ENDPOINT).hostname

    awsauth = AWS4Auth(
        credentials.access_key,
        credentials.secret_key,
        session.region_name,
        service,
        session_token=credentials.token,
    )

    opensearch = OpenSearch(
        hosts=[{"host": host, "port": port}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection,
        timeout=timeout,
    )

    return opensearch
