import json
import warnings
from abc import ABC
from typing import Any, Dict, Iterator, List, Mapping, Optional

from langchain.callbacks.manager import CallbackManagerForLLMRun
from langchain.llms.base import LLM
from langchain.llms.utils import enforce_stop_tokens
from langchain.pydantic_v1 import BaseModel, Extra, root_validator
from langchain.schema.output import GenerationChunk
from langchain.utilities.anthropic import (
    get_num_tokens_anthropic,
    get_token_ids_anthropic,
)


class LLMInputOutputAdapter:
    """Adapter class to prepare the inputs from Langchain to a format
    that LLM model expects.

    It also provides helper function to extract
    the generated text from the model response."""

    @classmethod
    def prepare_input(
        cls, provider: str, prompt: str, model_kwargs: Dict[str, Any]
    ) -> Dict[str, Any]:
        input_body = {**model_kwargs}
        if provider == "anthropic":
            input_body["messages"] = [{"role": "user", "content": prompt}]
        elif provider == "meta":
            input_body["prompt"] = prompt
        elif provider == "mistral":
            input_body["prompt"] = prompt

        if provider == "anthropic" and "max_tokens" not in input_body:
            input_body["max_tokens"] = 256

        return input_body

    @classmethod
    def prepare_output(cls, provider: str, response: Any) -> str:
        response_body = json.loads(response.get("body").read())
        if provider == "anthropic":
            return response_body.get("content")[0]["text"]
        elif provider == "meta":
            return response_body.get("generation")
        elif provider == "mistral":
            return response_body.get("outputs")[0]["text"]
        else:
            raise Exception(f"provider {provider} not supported")

    @classmethod
    def prepare_output_stream(
        cls, provider: str, response: Any, stop: Optional[List[str]] = None
    ) -> Iterator[GenerationChunk]:
        stream = response.get("body")

        if not stream:
            return

        if provider not in ["anthropic", "meta", "mistral"]:
            raise ValueError(
                f"Unknown streaming response output key for provider: {provider}"
            )

        for event in stream:
            chunk = event.get("chunk")
            if chunk:
                chunk_obj = json.loads(chunk.get("bytes").decode())

                if provider == "anthropic":
                    if chunk_obj.get("type") == "content_block_delta":
                        yield GenerationChunk(
                            text=chunk_obj.get("delta", {}).get("text", "")
                        )
                elif provider == "mistral":
                    yield GenerationChunk(
                        text=chunk_obj.get("outputs", [{}])[0].get("text", "")
                    )
                elif provider == "meta":
                    yield GenerationChunk(text=chunk_obj["generation"])

                else:
                    raise ValueError(
                        f"Unknown streaming response output key for provider: {provider}"
                    )


class BedrockBase(BaseModel, ABC):
    """Base class for Bedrock models."""

    client: Any  #: :meta private:

    region_name: Optional[str] = None
    """The aws region e.g., `us-west-2`. Fallsback to AWS_DEFAULT_REGION env variable
    or region specified in ~/.aws/config in case it is not provided here.
    """

    credentials_profile_name: Optional[str] = None
    """The name of the profile in the ~/.aws/credentials or ~/.aws/config files, which
    has either access keys or role information specified.
    If not specified, the default credential profile or, if on an EC2 instance,
    credentials from IMDS will be used.
    See: https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html
    """

    model_id: str
    """Id of the model to call, e.g., amazon.titan-text-express-v1, this is
    equivalent to the modelId property in the list-foundation-models api"""

    model_kwargs: Optional[Dict] = None
    """Keyword arguments to pass to the model."""

    endpoint_url: Optional[str] = None
    """Needed if you don't want to default to us-east-1 endpoint"""

    streaming: bool = False
    """Whether to stream the results."""

    provider_stop_sequence_key_name_map: Mapping[str, str] = {
        "anthropic": "stop_sequences",
    }

    @root_validator()
    def validate_environment(cls, values: Dict) -> Dict:
        """Validate that AWS credentials to and python package exists in environment."""

        # Skip creating new client if passed in constructor
        if values["client"] is not None:
            return values

        try:
            import boto3

            if values["credentials_profile_name"] is not None:
                session = boto3.Session(profile_name=values["credentials_profile_name"])
            else:
                # use default credentials
                session = boto3.Session()

            client_params = {}
            if values["region_name"]:
                client_params["region_name"] = values["region_name"]
            if values["endpoint_url"]:
                client_params["endpoint_url"] = values["endpoint_url"]

            values["client"] = session.client("bedrock-runtime", **client_params)

        except ImportError:
            raise ModuleNotFoundError(
                "Could not import boto3 python package. "
                "Please install it with `pip install boto3`."
            )
        except Exception as e:
            raise ValueError(
                "Could not load credentials to authenticate with AWS client. "
                "Please check that credentials in the specified "
                "profile name are valid."
            ) from e

        return values

    @property
    def _identifying_params(self) -> Mapping[str, Any]:
        """Get the identifying parameters."""
        _model_kwargs = self.model_kwargs or {}
        return {
            **{"model_kwargs": _model_kwargs},
        }

    def _get_provider(self) -> str:
        return self.model_id.split(".")[0]

    @property
    def _model_is_anthropic(self) -> bool:
        return self._get_provider() == "anthropic"

    def _prepare_input_and_invoke(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        _model_kwargs = self.model_kwargs or {}

        provider = self._get_provider()
        params = {**_model_kwargs, **kwargs}
        input_body = LLMInputOutputAdapter.prepare_input(provider, prompt, params)
        body = json.dumps(input_body)
        accept = "application/json"
        contentType = "application/json"
        try:
            response = self.client.invoke_model(
                body=body, modelId=self.model_id, accept=accept, contentType=contentType
            )
            text = LLMInputOutputAdapter.prepare_output(provider, response)

        except Exception as e:
            raise ValueError(f"Error raised by bedrock service: {e}")

        if stop is not None:
            text = enforce_stop_tokens(text, stop)

        return text

    def _prepare_input_and_invoke_stream(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[GenerationChunk]:
        _model_kwargs = self.model_kwargs or {}
        provider = self._get_provider()

        if stop:
            if provider not in self.provider_stop_sequence_key_name_map:
                raise ValueError(
                    f"Stop sequence key name for {provider} is not supported."
                )

            # stop sequence from _generate() overrides
            # stop sequences in the class attribute
            _model_kwargs[self.provider_stop_sequence_key_name_map.get(provider)] = stop

        if provider == "cohere":
            _model_kwargs["stream"] = True

        params = {**_model_kwargs, **kwargs}
        input_body = LLMInputOutputAdapter.prepare_input(provider, prompt, params)
        body = json.dumps(input_body)
        try:
            response = self.client.invoke_model_with_response_stream(
                body=body,
                modelId=self.model_id,
                accept="application/json",
                contentType="application/json",
            )
        except Exception as e:
            raise ValueError(f"Error raised by bedrock service: {e}")

        for chunk in LLMInputOutputAdapter.prepare_output_stream(
            provider, response, stop
        ):
            yield chunk
            if run_manager is not None:
                run_manager.on_llm_new_token(chunk.text, chunk=chunk)


class Bedrock(LLM, BedrockBase):
    """Bedrock LLM for implementing features not yet supported by Langchain Bedrock LLM.

    To authenticate, the AWS client uses the following methods to
    automatically load credentials:
    https://boto3.amazonaws.com/v1/documentation/api/latest/guide/credentials.html

    If a specific credential profile should be used, you must pass
    the name of the profile from the ~/.aws/credentials file that is to be used.

    Make sure the credentials / roles used have the required policies to
    access the Bedrock service.
    """

    """
    Example:
        .. code-block:: python

            from bedrock_langchain.bedrock_llm import BedrockLLM

            llm = BedrockLLM(
                credentials_profile_name="default",
                model_id="amazon.titan-text-express-v1",
                streaming=True
            )

    """

    @property
    def _llm_type(self) -> str:
        """Return type of llm."""
        return "amazon_bedrock"

    class Config:
        """Configuration for this pydantic object."""

        extra = Extra.forbid

    def _stream(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> Iterator[GenerationChunk]:
        """Call out to Bedrock service with streaming.

        Args:
            prompt (str): The prompt to pass into the model
            stop (Optional[List[str]], optional): Stop sequences. These will
                override any stop sequences in the `model_kwargs` attribute.
                Defaults to None.
            run_manager (Optional[CallbackManagerForLLMRun], optional): Callback
                run managers used to process the output. Defaults to None.

        Returns:
            Iterator[GenerationChunk]: Generator that yields the streamed responses.

        Yields:
            Iterator[GenerationChunk]: Responses from the model.
        """
        return self._prepare_input_and_invoke_stream(
            prompt=prompt, stop=stop, run_manager=run_manager, **kwargs
        )

    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """Call out to Bedrock service model.

        Args:
            prompt: The prompt to pass into the model.
            stop: Optional list of stop words to use when generating.

        Returns:
            The string generated by the model.

        Example:
            .. code-block:: python

                response = llm("Tell me a joke.")
        """

        if self.streaming:
            completion = ""
            for chunk in self._stream(
                prompt=prompt, stop=stop, run_manager=run_manager, **kwargs
            ):
                completion += chunk.text
            return completion

        return self._prepare_input_and_invoke(prompt=prompt, stop=stop, **kwargs)

    def get_num_tokens(self, text: str) -> int:
        if self._model_is_anthropic:
            return get_num_tokens_anthropic(text)
        else:
            return super().get_num_tokens(text)

    def get_token_ids(self, text: str) -> List[int]:
        if self._model_is_anthropic:
            return get_token_ids_anthropic(text)
        else:
            return super().get_token_ids(text)
