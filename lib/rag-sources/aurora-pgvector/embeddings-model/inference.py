import logging

import torch
import torch.nn.functional as F
from transformers import AutoModel, AutoModelForSequenceClassification, AutoTokenizer

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

"""
{
    "kind": "embeddings",
    "sentence": "I love Berlin",
}

{
    "kind": "cross-encoder",
    "sentence": "I love Berlin",
    "candidates": ["I love Paris", "I love London"]
}

"""


def mean_pooling(model_output, attention_mask):
    """Mean Pooling - Take attention mask into account for correct averaging"""
    # First element of model_output contains all token embeddings
    token_embeddings = model_output[0]
    input_mask_expanded = (
        attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    )
    return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(
        input_mask_expanded.sum(1), min=1e-9
    )


def model_fn(model_dir):
    logger.info("model_fn")
    embeddings_model_dir = f"{model_dir}/all-MiniLM-L6-v2"
    cross_encoder_model_dir = f"{model_dir}/ms-marco-MiniLM-L-12-v2"

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    embeddings_tokenizer = AutoTokenizer.from_pretrained(embeddings_model_dir)
    embeddings_model = AutoModel.from_pretrained(embeddings_model_dir)
    embeddings_model.eval()
    embeddings_model.to(device)

    cross_encoder_model = AutoModelForSequenceClassification.from_pretrained(
        cross_encoder_model_dir
    )
    cross_encoder_tokenizer = AutoTokenizer.from_pretrained(cross_encoder_model_dir)
    cross_encoder_model.eval()
    cross_encoder_model.to(device)

    model = {
        "embeddings_model": embeddings_model,
        "embeddings_tokenizer": embeddings_tokenizer,
        "cross_encoder_model": cross_encoder_model,
        "cross_encoder_tokenizer": cross_encoder_tokenizer,
    }

    return model


def predict_fn(input_object, model):
    logger.info("predict_fn")

    embeddings_model = model["embeddings_model"]
    embeddings_tokenizer = model["embeddings_tokenizer"]
    cross_encoder_model = model["cross_encoder_model"]
    cross_encoder_tokenizer = model["cross_encoder_tokenizer"]

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if input_object["kind"] == "embeddings":
        sentence = input_object["sentence"]
        encoded_input = embeddings_tokenizer(
            sentence,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        encoded_input = encoded_input.to(device)

        with torch.no_grad():
            model_output = embeddings_model(**encoded_input)

        sentence_embeddings = mean_pooling(
            model_output, encoded_input["attention_mask"]
        )
        sentence_embeddings = F.normalize(sentence_embeddings, p=2, dim=1)
        response = sentence_embeddings.cpu().numpy()
        ret_value = response.tolist()

        return ret_value
    elif input_object["kind"] == "cross-encoder":
        sentence = input_object["sentence"]
        candidates = input_object["candidates"]
        data = [[sentence, candidate] for candidate in candidates]

        features = cross_encoder_tokenizer(
            data, padding=True, truncation=True, return_tensors="pt"
        )
        features = features.to(device)

        with torch.no_grad():
            scores = cross_encoder_model(**features).logits.cpu().numpy()
            ret_value = scores.tolist()

            return ret_value

    return []
