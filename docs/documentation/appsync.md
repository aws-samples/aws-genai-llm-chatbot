# Using AppSync

The project relies on [AWS AppSync](https://docs.aws.amazon.com/appsync/latest/devguide/what-is-appsync.html) which creates serverless GraphQL and Pub/Sub APIs that simplify application development through a single endpoint to securely query, update, or publish data. One of the key advantages is [GraphQL subscriptions](https://docs.aws.amazon.com/appsync/latest/devguide/aws-appsync-real-time-data.html) which is used to receive the chatbot responses in real time using streaming.

### Schema
The GraphQL Schema defining the possible operatiosn can be found in `lib/chatbot-api/schema/schema.graphql`. Once deployed, AWS AppSync provides a Querying tool on the [AWS Console](https://us-east-1.console.aws.amazon.com/appsync/home?region=us-east-1) which can be used to explore and test the APIs.

### Authentication
AWS AppSync supports built in authentication modes. This project relies on the [@aws_cognito_user_pools one](https://docs.aws.amazon.com/appsync/latest/devguide/security-authz.html#using-additional-authorization-modes) to authenticate Amazon Cognito users.
