import boto3
from botocore.exceptions import ClientError


def get_user_groups(cognito, username, user_pool_id):
    try:
        groups = []
        pagination_token = None
        page_count = 0
        max_pages = 100

        while True:
            if page_count >= max_pages:
                print(f"Reached maximum number of pages ({max_pages})")
                break

            kwargs = {"Username": username, "UserPoolId": user_pool_id}
            if pagination_token:
                kwargs["NextToken"] = pagination_token

            response = cognito.admin_list_groups_for_user(**kwargs)
            page_count += 1

            current_groups = [
                group["GroupName"] for group in response.get("Groups", [])
            ]
            groups.extend(current_groups)

            pagination_token = response.get("NextToken")
            if not pagination_token:
                break

        return groups

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "UnknownError")
        print(f"Error getting user {username} groups. Error code: {error_code}")
        raise e


def remove_user_from_group(cognito, username, group_name, user_pool_id):
    try:
        cognito.admin_remove_user_from_group(
            UserPoolId=user_pool_id, Username=username, GroupName=group_name
        )
        print(f"Successfully removed user {username} from group {group_name}")
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "UnknownError")
        print(
            f"Error removing user {username} from group {group_name}. Error code: {error_code}"  # noqa: E501
        )
        raise e


def add_user_to_group(cognito, username, group_name, user_pool_id):
    try:
        response = cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id, Username=username, GroupName=group_name
        )
        print(f"Successfully added user {username} to group {group_name}")
        return response
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "UnknownError")
        print(
            f"Error adding user {username} to group {group_name}. Error code: {error_code}"  # noqa: E501
        )
        if e.response["Error"]["Code"] != "ResourceNotFoundException":
            # ignore roles that do not exist.
            raise e


def handler(event, context):
    user_attributes = event["request"]["userAttributes"]
    print(f"User attributes {user_attributes}")
    # For federated users, the username will be the "sub" from the IdP
    username = event["request"]["userAttributes"]["sub"]
    new_group = event["request"]["userAttributes"].get("custom:chatbot_role")
    user_pool_id = event["userPoolId"]

    # if federated user
    if new_group:
        cognito = boto3.client("cognito-idp")

        current_groups = get_user_groups(
            cognito=cognito, username=username, user_pool_id=user_pool_id
        )

        for group in current_groups:
            if group != new_group:
                remove_user_from_group(cognito, username, group, user_pool_id)

        if new_group not in current_groups:
            add_user_to_group(
                cognito=cognito,
                username=username,
                group_name=new_group,
                user_pool_id=user_pool_id,
            )

    return event
