import boto3
import genai_core.types
import genai_core.parameters

sts_client = boto3.client("sts")


def get_kb_runtime_client_for_id(knowledge_base_id: str):
    config = genai_core.parameters.get_config()
    kb_config = config.get("rag", {}).get("engines", {}).get("knowledgeBase", {})
    external = kb_config.get("external", [])

    for kb in external:
        current_id = kb.get("knowledgeBaseId", "")
        current_name = kb.get("name", "")
        region_name = kb.get("region")
        role_arn = kb.get("roleArn")

        if not current_id or not current_name:
            continue

        if current_id == knowledge_base_id:
            config_data = {"service_name": "bedrock-agent-runtime"}
            if region_name:
                config_data["region_name"] = region_name

            if role_arn:
                assumed_role_object = sts_client.assume_role(
                    RoleArn=role_arn,
                    RoleSessionName="AssumedRoleSession",
                )

                credentials = assumed_role_object["Credentials"]
                config_data["aws_access_key_id"] = credentials["AccessKeyId"]
                config_data["aws_secret_access_key"] = credentials["SecretAccessKey"]
                config_data["aws_session_token"] = credentials["SessionToken"]

            client = boto3.client(**config_data)

            return client

    raise genai_core.types.CommonError(
        f"Could not find Amazon Bedrock KnowledgeBase ID {knowledge_base_id}"
    )
