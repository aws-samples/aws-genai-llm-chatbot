import urllib.parse
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


def __parse_email(encoded_email):
    return urllib.parse.unquote(encoded_email)


@router.resolver(field_name="listUsers")
@tracer.capture_method
@permissions.admin_only
def list_users():
    try:
        users = genai_core.admin_user_management.list_users()
        return {"ok": True, "data": users}
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}


@router.resolver(field_name="getUser")
@tracer.capture_method
@permissions.admin_only
def get_user(user_id: str):
    try:
        user = genai_core.admin_user_management.get_user(__parse_email(user_id))
        return {"ok": True, "data": user}
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}


@router.resolver(field_name="createUser")
@tracer.capture_method
@permissions.admin_only
def create_user():
    try:
        data: dict = router.current_event.json_body
        user = User(
            email=data["email"],
            phoneNumber=data.get("phoneNumber", ""),
            name=data.get("name"),
            role=data.get("role", "chatbot_user"),
        )
        if user.role in UserPermissions.VALID_ROLES:
            genai_core.admin_user_management.create_user(
                email=user.email,
                phone_number=user.phoneNumber,
                role=user.role,
                name=user.name,
            )
            return {"ok": True, "data": user}
        else:
            return {"ok": False, "error": "Invalid Role provided"}
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}


@router.resolver(field_name="editUser")
@tracer.capture_method
@permissions.admin_only
def edit_user():
    try:
        data: dict = router.current_event.json_body
        user = User(**data)
        user_id = user.previousEmail if user.previousEmail else user.email
        genai_core.admin_user_management.update_user_details(
            current_email=user_id,
            email=user.email,
            role=user.role,
            name=user.name,
            phone_number=user.phoneNumber,
        )
        return {"ok": True, "data": user}
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}


@router.resolver(field_name="disableUser")
@tracer.capture_method
@permissions.admin_only
def disable_user(user_id: str):
    try:
        genai_core.admin_user_management.disable_user(__parse_email(user_id))
        return {"ok": True}
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}


@router.resolver(field_name="enableUser")
@tracer.capture_method
@permissions.admin_only
def enable_user(user_id: str):
    try:
        genai_core.admin_user_management.enable_user(__parse_email(user_id))
        return {"ok": True}
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}


@router.resolver(field_name="deleteUser")
@tracer.capture_method
@permissions.admin_only
def delete_user(user_id: str):
    try:
        response = genai_core.admin_user_management.delete_user(__parse_email(user_id))
        if response:
            return {"ok": True}
        else:
            return {
                "ok": False,
                "error": "The user is not disabled. To delete a user, first disable the user, then delete the user.",
            }
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}


@router.resolver(field_name="resetPassword")
@tracer.capture_method
@permissions.admin_only
def reset_password(user_id: str):
    try:
        genai_core.admin_user_management.reset_user_password(__parse_email(user_id))
        return {"ok": True}
    except Exception as e:
        logger.exception(e)
        return {"ok": False, "error": str(e)}