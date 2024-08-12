import boto3
import string
import random


from pydantic import BaseModel


class Credentials(BaseModel):
    id_token: str
    email: str
    password: str


class CognitoClient:
    def __init__(self, region: str, user_pool_id: str, client_id: str) -> None:
        self.user_pool_id = user_pool_id
        self.client_id = client_id
        self.cognito_idp_client = boto3.client("cognito-idp", region_name=region)

    def get_credentials(self, email: str) -> Credentials:
        try:
            self.cognito_idp_client.admin_get_user(
                UserPoolId=self.user_pool_id,
                Username=email,
            )
        except self.cognito_idp_client.exceptions.UserNotFoundException:
            self.cognito_idp_client.admin_create_user(
                UserPoolId=self.user_pool_id,
                Username=email,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "True"},
                ],
                MessageAction="SUPPRESS",
            )

        password = self.get_password()
        self.cognito_idp_client.admin_set_user_password(
            UserPoolId=self.user_pool_id,
            Username=email,
            Password=password,
            Permanent=True,
        )

        response = self.cognito_idp_client.admin_initiate_auth(
            UserPoolId=self.user_pool_id,
            ClientId=self.client_id,
            AuthFlow="ADMIN_NO_SRP_AUTH",
            AuthParameters={"USERNAME": email, "PASSWORD": password},
        )

        return Credentials(
            **{
                "id_token": response["AuthenticationResult"]["IdToken"],
                "email": email,
                "password": password,
            }
        )

    def get_password(self):
        return "".join(
            random.choices(string.ascii_uppercase, k=10)
            + random.choices(string.ascii_lowercase, k=10)
            + random.choices(string.digits, k=5)
            + random.choices(string.punctuation, k=3)
        )
