import genai_core.clients

# from langchain.llms import Bedrock (pending https://github.com/langchain-ai/langchain/issues/13316)
from .base import Bedrock

from langchain.prompts.prompt import PromptTemplate


from ..shared.meta.llama3_instruct import (
    Llama3PromptTemplate,
    Llama3QAPromptTemplate,
    Llama3CondensedQAPromptTemplate,
)
from ..shared.meta.llama3_instruct import Llama3ConversationBufferMemory

from ..base import ModelAdapter
from genai_core.registry import registry


class BedrockMetaLLama3InstructAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_memory(self, output_key=None, return_messages=False):
        return Llama3ConversationBufferMemory(
            memory_key="chat_history",
            chat_memory=self.chat_history,
            return_messages=return_messages,
            output_key=output_key,
        )

    def get_llm(self, model_kwargs={}):
        bedrock = genai_core.clients.get_bedrock_client()

        params = {}
        if "temperature" in model_kwargs:
            params["temperature"] = model_kwargs["temperature"]
        if "topP" in model_kwargs:
            params["top_p"] = model_kwargs["topP"]
        if "maxTokens" in model_kwargs:
            params["max_gen_len"] = model_kwargs["maxTokens"]

        return Bedrock(
            client=bedrock,
            model_id=self.model_id,
            model_kwargs=params,
            streaming=model_kwargs.get("streaming", False),
            callbacks=[self.callback_handler],
        )

    def get_prompt(self):
        return Llama3PromptTemplate

    def get_qa_prompt(self):
        return Llama3QAPromptTemplate

    def get_condense_question_prompt(self):
        return Llama3CondensedQAPromptTemplate


# Register the adapter
registry.register(
    r"^bedrock.meta.llama3-.*-instruct.*",
    BedrockMetaLLama3InstructAdapter,
)
