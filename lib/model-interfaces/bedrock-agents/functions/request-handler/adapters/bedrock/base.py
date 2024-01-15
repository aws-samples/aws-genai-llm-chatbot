from abc import ABC
from typing import Any, Dict, Iterator, List, Optional
from pydantic import BaseModel, root_validator, Extra
from ..base import AgentAdapter


class AgentInputOutputAdapter:
    """Adapter class to prepare the inputs from Langchain to a format
    that LLM model expects.

    It also provides helper function to extract
    the generated text from the model response."""

    @classmethod
    def prepare_output_stream(
        cls, response: Any, stop: Optional[List[str]] = None
    ) -> Iterator[str]:
        stream = response.get("completion")

        if not stream:
            return

        for event in stream:
            chunk = event.get("chunk")
            # chunk obj format varies with provider
            yield chunk["bytes"].decode("utf8")


class BedrockAgent(AgentAdapter, ABC):
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
    
    @property
    def _llm_type(self) -> str:
        """Return type of llm."""
        return "amazon_bedrock"

    class Config:
        """Configuration for this pydantic object."""

        extra = Extra.forbid

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

    def _invoke_agent(
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
