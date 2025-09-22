import boto3
from botocore.exceptions import ClientError
import os
import uuid
from datetime import datetime


def create_user_application_record(username, user_attributes):
    """Create an Application record for the user in DynamoDB"""
    try:
        # Construct the Applications table name based on the stack naming pattern
        # The table name follows the pattern: GenAIChatBotStack-ChatBotApiAppDynamoDBTablesApplicationsTable*
        # We'll use boto3 to list tables and find the one that matches the pattern
        dynamodb = boto3.client("dynamodb")
        
        # List all tables and find the Applications table
        response = dynamodb.list_tables()
        applications_table_name = None
        
        for table_name in response.get("TableNames", []):
            if "ApplicationsTable" in table_name and "GenAIChatBotStack" in table_name:
                applications_table_name = table_name
                break
        
        if not applications_table_name:
            print("Applications table not found")
            return

        # Use DynamoDB resource for easier item operations
        dynamodb_resource = boto3.resource("dynamodb")
        table = dynamodb_resource.Table(applications_table_name)
        
        # Get user email for the application name
        email = user_attributes.get("email", username)
        application_name = f"Application for {email}"
        
        # Create application record
        timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        application_record = {
            "Id": username,  # Use username as ID to match user
            "userId": username,
            "email": email,
            "name": application_name,  # Add the required name field
            "role": "admin",  # Default role
            "createdAt": timestamp,
            "updatedAt": timestamp,
        }
        
        table.put_item(Item=application_record)
        print(f"Created application record for user {username} in table {applications_table_name}")
        
    except Exception as e:
        print(f"Error creating application record for user {username}: {str(e)}")


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
    print(f"Event received: {event}")

    # Handle different trigger types with different event structures
    if "request" in event and "userAttributes" in event["request"]:
        # POST_AUTHENTICATION trigger
        user_attributes = event["request"]["userAttributes"]
        username = user_attributes.get("sub") or user_attributes.get("username")
        new_group = user_attributes.get("custom:chatbot_role")
        user_pool_id = event["userPoolId"]
        trigger_type = "POST_AUTHENTICATION"
    elif "userAttributes" in event:
        # PRE_AUTHENTICATION trigger
        user_attributes = event["userAttributes"]
        username = user_attributes.get("sub")
        new_group = user_attributes.get("custom:chatbot_role")
        user_pool_id = event["userPoolId"]
        trigger_type = "PRE_AUTHENTICATION"
    elif (
        "request" in event
        and "userAttributes" in event["request"]
        and "validationData" in event["request"]
    ):
        # POST_CONFIRMATION trigger
        user_attributes = event["request"]["userAttributes"]
        username = user_attributes.get("sub") or user_attributes.get("username")
        new_group = user_attributes.get("custom:chatbot_role")
        user_pool_id = event["userPoolId"]
        trigger_type = "POST_CONFIRMATION"
    elif (
        "request" in event
        and "userAttributes" in event["request"]
        and "validationData" not in event["request"]
    ):
        # PRE_SIGN_UP trigger
        user_attributes = event["request"]["userAttributes"]
        # For Pre sign-up, username might be in different fields
        username = (
            user_attributes.get("sub")
            or user_attributes.get("username")
            or user_attributes.get("email")
        )
        new_group = user_attributes.get("custom:chatbot_role")
        user_pool_id = event["userPoolId"]
        trigger_type = "PRE_SIGN_UP"
    else:
        print("No user attributes found in event")
        return event

    print(f"Trigger type: {trigger_type}")
    print(f"User attributes: {user_attributes}")
    print(f"Username: {username}")
    print(f"New group: {new_group}")
    print(f"User pool ID: {user_pool_id}")

    # Get default group from environment variable or use 'user' as fallback
    default_group = os.environ.get("DEFAULT_USER_GROUP", "user")

    # If no custom:chatbot_role is provided, use default group
    if not new_group:
        new_group = default_group
        print(f"No custom:chatbot_role found, using default group: {default_group}")

    # For Pre sign-up, we cannot assign groups because the user doesn't exist yet
    if trigger_type == "PRE_SIGN_UP":
        print("Pre sign-up trigger - user will be created after this trigger completes")
        print(f"Will assign user to group: {new_group}")
        print(
            "Note: Group assignment will happen in a separate \
            trigger (POST_CONFIRMATION)"
        )

        # For Pre sign-up, we can only validate or modify the sign-up request
        # We cannot assign groups yet as the user doesn't exist
        # The group assignment will need to happen in
        # POST_CONFIRMATION or PRE_AUTHENTICATION

        # You might want to add the group information to the user attributes
        # so it can be used later in POST_CONFIRMATION
        if "custom:chatbot_role" not in user_attributes:
            user_attributes["custom:chatbot_role"] = new_group
            print(f"Added custom:chatbot_role attribute: {new_group}")

        return event

    # For other triggers (PRE_AUTHENTICATION, POST_AUTHENTICATION, POST_CONFIRMATION)
    if username:
        cognito = boto3.client("cognito-idp")

        current_groups = get_user_groups(
            cognito=cognito, username=username, user_pool_id=user_pool_id
        )

        print(f"Current groups for user {username}: {current_groups}")

        # Remove user from all groups except the new one
        for group in current_groups:
            if group != new_group:
                remove_user_from_group(cognito, username, group, user_pool_id)

        # Add user to the new group if not already in it
        if new_group not in current_groups:
            add_user_to_group(
                cognito=cognito,
                username=username,
                group_name=new_group,
                user_pool_id=user_pool_id,
            )
        else:
            print(f"User {username} is already in group {new_group}")

        # Create Application record for POST_CONFIRMATION trigger
        if trigger_type == "POST_CONFIRMATION":
            create_user_application_record(username, user_attributes)
    else:
        print("No username found in user attributes, skipping group assignment")

    return event
