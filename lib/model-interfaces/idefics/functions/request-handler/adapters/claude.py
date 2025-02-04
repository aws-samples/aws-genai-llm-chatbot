from typing import Optional

from aws_lambda_powertools import Logger
from genai_core.registry import registry

from .base import MultiModalModelBase

logger = Logger()


class Claude3(MultiModalModelBase):
    def handle_run(self, input: dict, model_kwargs: dict, files: Optional[list] = None):
        return self.converse(input, model_kwargs)


registry.register(r"^bedrock.anthropic.claude-3.*", Claude3)
registry.register(r"^bedrock.*.anthropic.claude-3.*", Claude3)
