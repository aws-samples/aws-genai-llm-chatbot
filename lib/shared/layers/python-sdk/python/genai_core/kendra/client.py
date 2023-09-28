import os
import boto3
import genai_core.types
import genai_core.parameters

DEFAULT_KENDRA_INDEX_ID = os.environ.get("DEFAULT_KENDRA_INDEX_ID", "")
DEFAULT_KENDRA_INDEX_NAME = os.environ.get("DEFAULT_KENDRA_INDEX_NAME", "")

sts_client = boto3.client("sts")


def get_kendra_client_for_index(kendra_index_id: str):
    is_default = kendra_index_id == DEFAULT_KENDRA_INDEX_ID

    if is_default:
        kendra = boto3.client("kendra")
        return kendra

    config = genai_core.parameters.get_config()
    kendra_config = config.get("rag", {}).get("engines", {}).get("kendra", {})
    external = kendra_config.get("external", {})

    for kendraIndex in external:
        current_id = kendraIndex.get("kendraId", "")
        current_name = kendraIndex.get("name", "")
        region_name = kendraIndex.get("region")
        role_arn = kendraIndex.get("roleArn")

        if not current_id or not current_name:
            continue

        if current_id == kendra_index_id:
            kendra_config_data = {"service_name": "kendra"}
            if region_name:
                kendra_config_data["region_name"] = region_name

            if role_arn:
                assumed_role_object = sts_client.assume_role(
                    RoleArn=role_arn,
                    RoleSessionName="AssumedRoleSession",
                )

                credentials = assumed_role_object["Credentials"]
                kendra_config_data["aws_access_key_id"] = credentials["AccessKeyId"]
                kendra_config_data["aws_secret_access_key"] = credentials[
                    "SecretAccessKey"
                ]
                kendra_config_data["aws_session_token"] = credentials["SessionToken"]

            kendra = boto3.client(**kendra_config_data)

            return kendra

    raise genai_core.types.CommonError(f"Could not find kendra index {kendra_index_id}")
