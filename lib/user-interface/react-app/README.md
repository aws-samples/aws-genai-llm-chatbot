# User Interface

## Running locally

You can run this vite react app locally following these steps.

### Deploy infrastructure to AWS

Follow instructions on the root folder README to deploy the cdk app.

You will need the CloudFormation Output values displayed after completion in the following step.

### Option 1: Obtain environment configuration

Grab the `aws-exports.json` from the CloudFront distribution endpoint you obtained from the CDK Output, and save it into `./lib/user-interface/react-app/public/` folder. Then run `npm run dev`.

For example:

```bash
cd lib/user-interface/react-app/public
curl -O https://dxxxxxxxxxxxx.cloudfront.net/aws-exports.json
cd ..
npm run dev
```

### Option 2: Set configuration as env variable

```bash
export AWS_PROJECT_REGION="..."
export AWS_COGNITO_REGION="..."
export AWS_USER_POOLS_ID="..."
export AWS_USER_POOLS_WEB_CLIENT_ID="..."
export API_DISTRIBUTION_DOMAIN_NAME="..."
export RAG_ENABLED=1|0
export DEFAULT_EMBEDDINGS_MODEL="..."
export DEFAULT_CROSS_ENCODER_MODEL="..."
npm run build:dev
npm run dev
```
