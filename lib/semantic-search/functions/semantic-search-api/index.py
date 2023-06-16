from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from api_actions import semantic_search, get_embeddings, rank_sentences, store_documents

logger = Logger(service="SemanticSearchApi")
tracer = Tracer(service="SemanticSearchApi")

"""
{
    "action": "semantic-search",
    "query": "Who is Alan Turing?",
    "operator": "cosine", // "l2" | "inner"
    "limit": 10,
    "rerank": true
}

{
    "action": "get-embeddings",
    "inputs": [
        "Alan Turing was a British mathematician, computer scientist, logician, cryptanalyst, philosopher and theoretical biologist.",
        "London is the capital city of England and the United Kingdom.",
        "DNA is made up of a double-stranded helix held together by weak hydrogen bonds between purine-pyrimidine nucleotide base pairs"
    ] 
}

{
    "action": "rank-sentences",
    "query": "Who is Alan Turing?",
    "sentences": [
        "Alan Turing was a British mathematician, computer scientist, logician, cryptanalyst, philosopher and theoretical biologist.",
        "London is the capital city of England and the United Kingdom.",
        "DNA is made up of a double-stranded helix held together by weak hydrogen bonds between purine-pyrimidine nucleotide base pairs"
    ]   
}

{
    "action": "store-documents",
    "documents": [{
        "url": "local://123",
        "content": "Sergey Pugachev holds the position of Senior Prototype Architect Lead at AWS."
    }]
}
"""


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, _: LambdaContext):
    logger.debug(f"Running semantic search with event: {event}")
    action = event.get("action", "semantic-search")
    logger.debug(f"action: {action}")

    if action == "semantic-search":
        return semantic_search(event)
    if action == "get-embeddings":
        return get_embeddings(event)
    if action == "rank-sentences":
        return rank_sentences(event)
    if action == "store-documents":
        return store_documents(event)

    error = f"Unknown action {action}"
    logger.error(error)
    raise ValueError(error)
