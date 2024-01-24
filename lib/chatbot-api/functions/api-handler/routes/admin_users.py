import urllib.parse
import json
from typing import Optional
import genai_core.types
import genai_core.admin_user_management
from pydantic import BaseModel
from genai_core.auth import UserPermissions
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

tracer = Tracer()
router = Router()
logger = Logger()
permissions = UserPermissions(router)


class User(BaseModel):
    email: str
    phoneNumber: Optional[str] = None
    role: str
    name: str
    previousEmail: Optional[str] = None



@router.resolver(field_name="listUsers")
@tracer.capture_method
@permissions.admin_only
def list_users():
    try:
        users = genai_core.admin_user_management.list_users()
        return users
    except Exception as e:
        logger.exception(e)
        return str(e)


@router.resolver(field_name="getUser")
@tracer.capture_method
@permissions.admin_only
def get_user(user_id: str):
    try:
        user = genai_core.admin_user_management.get_user(user_id)
        return json.dumps(user)
    except Exception as e:
        logger.exception(e)
        return str(e)


@router.resolver(field_name="createUser")
@tracer.capture_method
@permissions.admin_only
def create_user(input: dict):
    try:
        user = User(
            email=input["email"],
            phoneNumber=input.get("phoneNumber", ""),
            name=input.get("name"),
            role=input.get("role", "chatbot_user"),
        )
        if user.role in UserPermissions.VALID_ROLES:
            genai_core.admin_user_management.create_user(
                email=user.email,
                phone_number=user.phoneNumber,
                role=user.role,
                name=user.name,
            )
            return True
        else:
            return False
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}


@router.resolver(field_name="editUser")
@tracer.capture_method
@permissions.admin_only
def edit_user(input: dict):
    try:
        user = User(**input)
        user_id = user.previousEmail if user.previousEmail else user.email
        genai_core.admin_user_management.update_user_details(
            current_email=user_id,
            email=user.email,
            role=user.role,
            name=user.name,
            phone_number=user.phoneNumber,
        )
        return True
    except Exception as e:
        logger.exception(e)
        return False


@router.resolver(field_name="toggleUser")
@tracer.capture_method
@permissions.admin_only
def toggle_user(input: dict):
    action = input["action"]
    email = input["email"]
    try:
        if action == "enable":
            genai_core.admin_user_management.enable_user(email)
            return True
        if action == "disable":
            genai_core.admin_user_management.disable_user(email)
            return True
    except Exception as e:
        logger.exception(e)
        return str(e)


@router.resolver(field_name="deleteUser")
@tracer.capture_method
@permissions.admin_only
def delete_user(input: dict):
    email = input["email"]
    try:
        response = genai_core.admin_user_management.delete_user(email)
        if response:
            return True
        else:
            return (
                "The user is not disabled. To delete a user, first disable the user, then delete the user.",
            )

    except Exception as e:
        logger.exception(e)
        return str(e)


@router.resolver(field_name="resetPassword")
@tracer.capture_method
@permissions.admin_only
def reset_password(input: dict):
    email = input["email"]
    try:
        genai_core.admin_user_management.reset_user_password(email)
        return True
    except Exception as e:
        logger.exception(e)
        return str(e)
