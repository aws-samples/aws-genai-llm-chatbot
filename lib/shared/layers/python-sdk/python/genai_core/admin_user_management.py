import boto3
import genai_core.auth
import os

COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID")

idp = boto3.client("cognito-idp")


def create_user(name, email, role, phone_number=None):
    if role in genai_core.auth.UserPermissions.VALID_ROLES:
        attributes = [
            {"Name": "email", "Value": email},
            {"Name": "name", "Value": name},
        ]
        if phone_number:
            attributes.append({"Name": "phone_number", "Value": phone_number})
        idp.admin_create_user(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
            UserAttributes=attributes,
        )
        idp.admin_add_user_to_group(
            UserPoolId=COGNITO_USER_POOL_ID,
            Username=email,
            GroupName=role,
        )
        return True
    else:
        raise Exception("Invalid role")


def list_users():
    response = idp.list_users(UserPoolId=COGNITO_USER_POOL_ID)
    chatbot_users = idp.list_users_in_group(
        UserPoolId=COGNITO_USER_POOL_ID, GroupName="chatbot_user"
    )["Users"]
    chatbot_workspaces_users = idp.list_users_in_group(
        UserPoolId=COGNITO_USER_POOL_ID, GroupName="chatbot_workspaces_user"
    )["Users"]
    chatbot_workspaces_managers = idp.list_users_in_group(
        UserPoolId=COGNITO_USER_POOL_ID, GroupName="chatbot_workspaces_manager"
    )["Users"]
    chatbot_admin = idp.list_users_in_group(
        UserPoolId=COGNITO_USER_POOL_ID, GroupName="chatbot_admin"
    )["Users"]
    users = []
    for user in response["Users"]:
        user_data = {}
        for attribute in user["Attributes"]:
            if attribute["Name"] == "name":
                user_data["name"] = attribute["Value"]
            if attribute["Name"] == "email":
                user_data["email"] = attribute["Value"]
            if attribute["Name"] == "phone_number":
                user_data["phoneNumber"] = attribute["Value"]
        if len(chatbot_users) > 0 and user["Username"] in (
            group_user["Username"] for group_user in chatbot_users
        ):
            user_data["role"] = "chatbot_user"
        if len(chatbot_workspaces_users) > 0 and user["Username"] in (
            group_user["Username"] for group_user in chatbot_workspaces_users
        ):
            user_data["role"] = "chatbot_workspaces_user"
        if len(chatbot_workspaces_managers) > 0 and user["Username"] in (
            group_user["Username"] for group_user in chatbot_workspaces_managers
        ):
            user_data["role"] = "chatbot_workspaces_manager"
        if len(chatbot_admin) > 0 and user["Username"] in (
            group_user["Username"] for group_user in chatbot_admin
        ):
            user_data["role"] = "chatbot_admin"
        user_data["enabled"] = user["Enabled"]
        user_data["userStatus"] = user["UserStatus"]
        users.append(user_data)
    return users


def get_user(email):
    response = idp.admin_get_user(UserPoolId=COGNITO_USER_POOL_ID, Username=email)
    chatbot_users = idp.list_users_in_group(
        UserPoolId=COGNITO_USER_POOL_ID, GroupName="chatbot_user"
    )
    chatbot_workspaces_users = idp.list_users_in_group(
        UserPoolId=COGNITO_USER_POOL_ID, GroupName="chatbot_workspaces_user"
    )
    chatbot_workspaces_managers = idp.list_users_in_group(
        UserPoolId=COGNITO_USER_POOL_ID, GroupName="chatbot_workspaces_manager"
    )
    chatbot_admin = idp.list_users_in_group(
        UserPoolId=COGNITO_USER_POOL_ID, GroupName="chatbot_admin"
    )
    if response["ResponseMetadata"]["HTTPStatusCode"] == 200:
        user_data = {}
        for attribute in response["UserAttributes"]:
            if attribute["Name"] == "name":
                user_data["name"] = attribute["Value"]
            if attribute["Name"] == "email":
                user_data["email"] = attribute["Value"]
            if attribute["Name"] == "phone_number":
                user_data["phoneNumber"] = attribute["Value"]
        if response["username"] in (
            group_user["Username"] for group_user in chatbot_users["Users"]
        ):
            user_data["role"] = "chatbot_users"
        if response["username"] in (
            group_user["Username"] for group_user in chatbot_workspaces_users["Users"]
        ):
            user_data["role"] = "chatbot_workspaces_users"
        if response["username"] in (
            group_user["Username"]
            for group_user in chatbot_workspaces_managers["Users"]
        ):
            user_data["role"] = "chatbot_workspaces_managers"
        if response["username"] in (
            group_user["Username"] for group_user in chatbot_admin["Users"]
        ):
            user_data["role"] = "chatbot_admin"
        user_data["enabled"] = response["Enabled"]
        user_data["userStatus"] = response["UserStatus"]
    return user_data


def delete_user(email):
    user_details_response = idp.admin_get_user(
        UserPoolId=COGNITO_USER_POOL_ID, Username=email
    )
    if user_details_response["Enabled"] == False:
        idp.admin_delete_user(UserPoolId=COGNITO_USER_POOL_ID, Username=email)
        return True
    else:
        return False


def disable_user(email):
    idp.admin_disable_user(UserPoolId=COGNITO_USER_POOL_ID, Username=email)
    return True


def enable_user(email):
    idp.admin_enable_user(UserPoolId=COGNITO_USER_POOL_ID, Username=email)
    return True


def update_user_details(current_email, **kwargs):
    attributes = []
    if "name" in kwargs and len(kwargs["name"]) > 0:
        attributes.append({"Name": "name", "Value": kwargs["name"]})
    if "email" in kwargs and len(kwargs["email"]) > 0:
        attributes.append({"Name": "email", "Value": kwargs["email"]})
        attributes.append({"Name": "email_verified", "Value": "true"})
    if "phone_number" in kwargs and len(kwargs["phone_number"]) > 0:
        attributes.append({"Name": "phone_number", "Value": kwargs["phone_number"]})
        attributes.append({"Name": "phone_number_verified", "Value": "true"})
    if (
        "role" in kwargs
        and kwargs["role"] in genai_core.auth.UserPermissions.VALID_ROLES
    ):
        for group in genai_core.auth.UserPermissions.VALID_ROLES:
            if group == kwargs["role"]:
                idp.admin_add_user_to_group(
                    UserPoolId=COGNITO_USER_POOL_ID,
                    Username=current_email,
                    GroupName=group,
                )
            else:
                idp.admin_remove_user_from_group(
                    UserPoolId=COGNITO_USER_POOL_ID,
                    Username=current_email,
                    GroupName=group,
                )
    response = idp.admin_update_user_attributes(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=current_email,
        UserAttributes=attributes,
    )
    if response["ResponseMetadata"]["HTTPStatusCode"] == 200:
        return True
    else:
        return False


def reset_user_password(email):
    idp.admin_reset_user_password(UserPoolId=COGNITO_USER_POOL_ID, Username=email)
    return True
