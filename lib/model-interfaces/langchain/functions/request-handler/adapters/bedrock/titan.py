import os

import boto3
from langchain.agents import ZeroShotAgent
from langchain.llms import Bedrock
from langchain.prompts.prompt import PromptTemplate

from ..base import ModelAdapter
from ..registry import registry


class BedrockTitanAdapter(ModelAdapter):
    def __init__(self, model_id, *args, **kwargs):
        self.model_id = model_id

        super().__init__(*args, **kwargs)

    def get_llm(self, model_kwargs={}):
        region_name = os.environ["BEDROCK_REGION"]
        endpoint_url = os.environ["BEDROCK_ENDPOINT_URL"]
        client = boto3.client(
            "bedrock",
            region_name=region_name,
            endpoint_url=endpoint_url,
        )

        parameters = {"temperature": 0.6}

        return Bedrock(
            client=client,
            model_id=self.model_id,
            model_kwargs=parameters,
        )

    def get_prompt(self):
        template = """Human: The following is a friendly conversation between a human and an AI. The AI is talkative and provides lots of specific details from its context. If the AI does not know the answer to a question, it truthfully says it does not know.

        Current conversation:
        {chat_history}

        Question: {input}
        
        Assistant:"""

        input_variables = ["input", "chat_history"]
        prompt_template_args = {
            "chat_history": "{chat_history}",
            "input_variables": input_variables,
            "template": template,
        }
        prompt_template = PromptTemplate(**prompt_template_args)

        return prompt_template


# Register the adapter
registry.register(r"^bedrock.amazon.titan-tg*", BedrockTitanAdapter)
