import genai_core.parameters
import genai_core.kendra
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

tracer = Tracer()
router = Router()
logger = Logger()


class KendraDataSynchRequest(BaseModel):
    workspaceId: str


@router.get("/rag/engines/kendra/indexes")
@tracer.capture_method
def kendra_indexes():
    indexes = genai_core.kendra.get_kendra_indexes()

    return {"ok": True, "data": indexes}


@router.post("/rag/engines/kendra/data-sync")
@tracer.capture_method
def kendra_data_sync():
    data: dict = router.current_event.json_body
    request = KendraDataSynchRequest(**data)

    genai_core.kendra.start_kendra_data_sync(workspace_id=request.workspaceId)

    return {"ok": True, "data": True}


@router.get("/rag/engines/kendra/data-sync/<workspace_id>")
@tracer.capture_method
def kendra_is_syncing(workspace_id: str):
    result = genai_core.kendra.kendra_is_syncing(workspace_id=workspace_id)

    return {"ok": True, "data": result}
