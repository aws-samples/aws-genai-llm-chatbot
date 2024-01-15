import genai_core.parameters
import genai_core.kendra
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.appsync import Router

tracer = Tracer()
router = Router()
logger = Logger()


class KendraDataSynchRequest(BaseModel):
    workspaceId: str


@router.resolver(field_name="listKendraIndexes")
@tracer.capture_method
def kendra_indexes():
    indexes = genai_core.kendra.get_kendra_indexes()

    return indexes


@router.resolver(field_name="startKendraDataSync")
@tracer.capture_method
def kendra_data_sync(workspaceId: str):
    genai_core.kendra.start_kendra_data_sync(workspace_id=workspaceId)

    return True


@router.resolver(field_name="isKendraDataSynching")
@tracer.capture_method
def kendra_is_syncing(workspaceId: str):
    result = genai_core.kendra.kendra_is_syncing(workspace_id=workspaceId)

    return result
