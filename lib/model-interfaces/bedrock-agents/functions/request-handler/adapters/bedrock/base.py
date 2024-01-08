from abc import ABC
from typing import Any, Dict, Iterator, List, Optional
from pydantic import BaseModel, root_validator, Extra


class AgentInputOutputAdapter:
    """Adapter class to prepare the inputs from Langchain to a format
    that LLM model expects.

    It also provides helper function to extract
    the generated text from the model response."""

    @classmethod
    def prepare_output_stream(
        cls, provider: str, response: Any, stop: Optional[List[str]] = None
    ) -> Iterator[str]:
        stream = response.get("body")

        if not stream:
            return

        if provider not in cls.provider_to_output_key_map:
            raise ValueError(
                f"Unknown streaming response output key for provider: {provider}"
            )

        for event in stream:
            chunk = event.get("chunk")
            # chunk obj format varies with provider
            yield chunk["bytes"].decode("utf8")


class BedrockAgentBase(, ABC):
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

    agent_id: str
    """Id of the agent to call"""

    agent_alias_id: str = "TSTALIASID"
    """The alias id for the agent. Defaults to the draft version."""

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

            values["client"] = session.client("bedrock-agent-runtime", **client_params)

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

    def _invoke_stream(
        self,
        prompt: str,
        session_id: str = None,
    ) -> Iterator[str]:
        try:
            response = self.client.invoke_agent(
                inputText=prompt,
                agentId=self.agent_id,
                agentAliasId=self.agent_alias_id,
                sessionId=session_id,
            )
        except Exception as e:
            raise ValueError(f"Error raised by bedrock service: {e}")

        for chunk in self.prepare_output_stream(response):
            yield chunk


class BedrockAgent(BedrockAgentBase):
    """Bedrock models.

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

    def _invoke(
        self,
        prompt: str,
        session_id: str = None,
    ) -> Iterator[str]:
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
        return self._invoke_stream(
            prompt=prompt,
            session_id=session_id,
        )

    def _call(
        self,
        prompt: str,
        session_id: str = None,
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
                prompt=prompt,
                session_id=session_id,
            ):
                completion += chunk.text
            return completion
