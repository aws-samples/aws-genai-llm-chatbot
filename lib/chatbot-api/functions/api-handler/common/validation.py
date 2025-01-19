from pydantic import BaseModel
from common.constant import ID_FIELD_VALIDATION


class WorkspaceIdValidation(BaseModel):
    workspaceId: str = ID_FIELD_VALIDATION


class IdValidation(BaseModel):
    id: str = ID_FIELD_VALIDATION
