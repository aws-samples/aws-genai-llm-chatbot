# Inference script

We are using an optional multi-model endpoint hosted on Sagemaker and provide an inference script to process requests and send responses back.

The inference script is currently hardcoded with the supported models (lib/rag-engines/sagemaker-rag-models/model/inference.py)

```py
embeddings_models = [
    "intfloat/multilingual-e5-large",
    "sentence-transformers/all-MiniLM-L6-v2",
]
cross_encoder_models = ["cross-encoder/ms-marco-MiniLM-L-12-v2"]
```

The API is JSON body based:

```json
{
  "type": "embeddings",
  "model": "intfloat/multilingual-e5-large",
  "input": "I love Berlin"
}
```

```json
{
  "type": "cross-encoder",
  "model": "cross-encoder/ms-marco-MiniLM-L-12-v2",
  "input": "I love Berlin",
  "passages": ["I love Paris", "I love London"]
}
```
