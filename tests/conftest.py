import sys
import os

here = os.path.dirname(__file__)
# Prioritize bedrock-agents path first to avoid conflicts
sys.path.insert(
    0, here + "/../lib/model-interfaces/bedrock-agents/functions/request-handler"
)
sys.path.append(here + "/../lib/chatbot-api/functions/api-handler")
sys.path.append(here + "/../lib/model-interfaces/langchain/functions/request-handler")
sys.path.append(here + "/../lib/shared/layers/python-sdk/python")

os.environ["AWS_REGION"] = "us-east-1"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
os.environ["DOCUMENTS_TABLE_NAME"] = "DocumentTableName"
os.environ["SESSIONS_TABLE_NAME"] = "SessionsTableName"
os.environ["SESSIONS_BY_USER_ID_INDEX_NAME"] = "index"
os.environ["PROCESSING_BUCKET_NAME"] = "Bucket"
