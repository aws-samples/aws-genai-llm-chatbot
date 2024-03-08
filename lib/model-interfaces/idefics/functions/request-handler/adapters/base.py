from abc import abstractmethod


class MultiModalModelBase:
    @abstractmethod
    def handle_run(self, prompt: str, model_kwargs: dict) -> str: ...

    @abstractmethod
    def format_prompt(self, prompt: str, messages: list, files: list) -> str: ...

    def clean_prompt(self, prompt: str) -> str:
        return prompt
