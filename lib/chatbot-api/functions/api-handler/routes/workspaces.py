import re
import genai_core.types
import genai_core.parameters
import genai_core.workspaces
from pydantic import BaseModel
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler.api_gateway import Router

tracer = Tracer()
router = Router()
logger = Logger()

name_regex = re.compile(r'^[\w+_-]+$')


class GenericCreateWorkspaceRequest(BaseModel):
    kind: str


class CreateWorkspaceAuroraRequest(BaseModel):
    kind: str
    name: str
    embeddingsModelProvider: str
    embeddingsModelName: str
    crossEncoderModelProvider: str
    crossEncoderModelName: str
    languages: list[str]
    metric: str
    index: bool
    hybridSearch: bool
    chunking_strategy: str
    chunkSize: int
    chunkOverlap: int


@router.get("/workspaces")
@tracer.capture_method
def workspaces():
    workspaces = genai_core.workspaces.list_workspaces()

    ret_value = [_convert_workspace(workspace) for workspace in workspaces]

    return {"ok": True, "data": ret_value}


@router.get("/workspaces/<workspace_id>")
@tracer.capture_method
def workspace(workspace_id: str):
    workspace = genai_core.workspaces.get_workspace(workspace_id)

    if not workspace:
        return {"ok": True, "data": None}

    ret_value = _convert_workspace(workspace)

    return {"ok": True, "data": ret_value}


@router.put("/workspaces")
@tracer.capture_method
def create_workspace():
    data: dict = router.current_event.json_body
    generic_request = GenericCreateWorkspaceRequest(**data)
    config = genai_core.parameters.get_config()

    if generic_request.kind == "aurora":
        request = CreateWorkspaceAuroraRequest(**data)
        ret_value = _create_workspace_aurora(request, config)
    elif generic_request.kind == "opensearch":
        ret_value = genai_core.workspaces.create_workspace_opensearch(data)
    elif generic_request.kind == "kendra":
        ret_value = genai_core.workspaces.create_workspace_kendra(data)
    else:
        raise genai_core.types.CommonError("Invalid engine")

    return {"ok": True, "data": ret_value}


def _create_workspace_aurora(request: CreateWorkspaceAuroraRequest, config: dict):
    workspace_name = request.name.strip()
    embedding_models = config["rag"]["embeddingsModels"]
    cross_encoder_models = config["rag"]["crossEncoderModels"]

    embeddings_model = None
    cross_encoder_model = None
    for model in embedding_models:
        if model["provider"] == request.embeddingsModelProvider and model["name"] == request.embeddingsModelName:
            embeddings_model = model
            break

    for model in cross_encoder_models:
        if model["provider"] == request.crossEncoderModelProvider and model["name"] == request.crossEncoderModelName:
            cross_encoder_model = model
            break

    if embeddings_model is None:
        raise genai_core.types.CommonError("Embeddings model not found")

    if cross_encoder_model is None:
        raise genai_core.types.CommonError("Cross encoder model not found")

    embeddings_model_dimensions = embeddings_model["dimensions"]

    workspace_name_match = name_regex.match(workspace_name)
    workspace_name_is_match = bool(workspace_name_match)
    if len(workspace_name) == 0 or len(workspace_name) > 100 or not workspace_name_is_match:
        raise genai_core.types.CommonError("Invalid workspace name")

    if len(request.languages) == 0 or len(request.languages) > 3:
        raise genai_core.types.CommonError("Invalid languages")

    if request.metric not in ["inner", "cosine", "l2"]:
        raise genai_core.types.CommonError("Invalid metric")

    if request.chunking_strategy not in ["recursive"]:
        raise genai_core.types.CommonError("Invalid chunking strategy")

    if request.chunkSize < 100 or request.chunkSize > 10000:
        raise genai_core.types.CommonError("Invalid chunk size")

    if request.chunkOverlap < 0 or request.chunkOverlap >= request.chunkSize:
        raise genai_core.types.CommonError("Invalid chunk overlap")

    return genai_core.workspaces.create_workspace_aurora(workspace_name=workspace_name,
                                                         embeddings_model_provider=request.embeddingsModelProvider,
                                                         embeddings_model_name=request.embeddingsModelName,
                                                         embeddings_model_dimensions=embeddings_model_dimensions,
                                                         cross_encoder_model_provider=request.crossEncoderModelProvider,
                                                         cross_encoder_model_name=request.crossEncoderModelName,
                                                         languages=request.languages,
                                                         metric=request.metric,
                                                         has_index=request.index,
                                                         hybrid_search=request.hybridSearch,
                                                         chunking_strategy=request.chunking_strategy,
                                                         chunk_size=request.chunkSize,
                                                         chunk_overlap=request.chunkOverlap)


def _convert_workspace(workspace: dict):
    return {
        "id": workspace["workspace_id"],
        "name": workspace["name"],
        "engine": workspace["engine"],
        "status": workspace["status"],
        "languages": workspace["languages"],
        "embeddingsModelProvider": workspace["embeddings_model_provider"],
        "embeddingsModelName": workspace["embeddings_model_name"],
        "embeddingsModelDimensions": workspace["embeddings_model_dimensions"],
        "crossEncoderModelProvider": workspace["cross_encoder_model_provider"],
        "crossEncoderModelName": workspace["cross_encoder_model_name"],
        "metric": workspace["metric"],
        "index": workspace["has_index"],
        "hybridSearch": workspace["hybrid_search"],
        "chunkingStrategy": workspace["chunking_strategy"],
        "chunkSize": workspace["chunk_size"],
        "chunkOverlap": workspace["chunk_overlap"],
        "vectors": workspace["vectors"],
        "documents": workspace["documents"],
        "sizeInBytes": workspace["size_in_bytes"],
        "createdAt": workspace["created_at"],
        "updatedAt": workspace["updated_at"],
    }
