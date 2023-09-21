import json
import logging
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

codebuild = boto3.client("codebuild")


def on_event(event, context):
    logger.info(f"Event: {json.dumps(event)}")

    if event["RequestType"] == "Create":
        logger.info("Starting the build...")
        response = codebuild.start_build(
            projectName=event["ResourceProperties"]["ProjectName"]
        )
        build_id = response["build"]["id"]
        logger.info(f"Build started with ID: {build_id}")
        return {"PhysicalResourceId": build_id, "Data": {"BuildId": build_id}}

    if event["RequestType"] == "Delete":
        logger.info("Delete event - nothing to do")
        return {"PhysicalResourceId": event["PhysicalResourceId"], "IsComplete": True}

    error_message = "Invalid request type"
    logger.error(error_message)
    raise Exception(error_message)


def is_complete(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    if event["RequestType"] == "Delete":
        logger.info("Delete event - nothing to do")
        return {"PhysicalResourceId": event["PhysicalResourceId"], "IsComplete": True}

    build_id = event["Data"]["BuildId"]
    logger.info(f"Checking build status for Build ID: {build_id}")

    response = codebuild.batch_get_builds(ids=[build_id])
    build = response["builds"][0]
    build_status = build["buildStatus"]

    logger.info(f"Build status: {build_status}")

    if build_status == "SUCCEEDED":
        return {"PhysicalResourceId": build_id, "IsComplete": True}

    if build_status in ["FAILED", "FAULT", "STOPPED", "TIMED_OUT"]:
        error_message = f"Build failed with status: {build_status}"
        logger.error(error_message)
        raise Exception(error_message)

    return {"PhysicalResourceId": build_id, "IsComplete": False}
