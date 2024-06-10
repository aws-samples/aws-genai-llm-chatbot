# Support additional models

You can find examples of model adapters in [functions/request-handler/adapters/](./functions/request-handler/adapters/)

1. Create your own adapter under [functions/request-handler/adapters/](./functions/request-handler/adapters/).

```python
import os

from langchain_community.chat_models import ChatOpenAI

from ..base import ModelAdapter
from ..registry import registry

# 1. Write your own adapter for your model
class GPTAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    # 2. Define your langchain LLM based on the target model.
    def get_llm(self, model_kwargs={}):
        if not os.environ.get("OPENAI_API_KEY"):
            raise Exception("OPENAI_API_KEY must be set in the environment")

        return ChatOpenAI(model_name=self.model_id, temperature=0, **model_kwargs)

    # (OPTIONAL) 3.If you need to override the default prompt, override the get_prompt and get_qa_prompt methods.
    # The get_qa_prompt is only used when RAG is enabled.
    # If not you can remove this and leverage the get_prompt and get_qa_prompts from the base adapter.
    # must return a PromptTemplate
    def get_prompt(self):
        template = """The following is a friendly conversation between a human and an AI. If the AI does not know the answer to a question, it truthfully says it does not know.

        Current conversation:
        {chat_history}

        Question: {input}"""
        input_variables = ["input", "chat_history"]
        prompt_template_args = {
            "chat_history": "{chat_history}",
            "input_variables": input_variables,
            "template": template,
        }
        prompt_template = PromptTemplate(**prompt_template_args)

        return prompt_template

    def get_qa_prompt(self):
        template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.

        {context}

        Question: {question}
        Helpful Answer:"""
        qa_prompt_template = PromptTemplate(
            template=template, input_variables=["context", "question"]
        )

        return qa_prompt_template
    ...

# 4. Finally, Register the adapter to match the model id coming from the select UI
# RegEx expression will allow you to use the same adapter for a different models matching your regex.
# For example `^openai*` will match all model IDs starting with `openai` such `openai.gpt-4`
registry.register(r"^openai*", GPTAdapter)
```

2. Make sure the `__init__.py` files are updated so that your adapter is correctly imported.
   - Example model adapter [**init**.py](./functions/request-handler/adapters/openai/gpt.py)
   - Adapters [**init**.py](./functions/request-handler/adapters/__init__.py)

Ensure the registry regex

```
registry.register(r"^openai*", GPTAdapter)
```

is correct so that [your adapter is picked up](./functions/request-handler/index.py#L74) correctly from the model ID sent from the UI
