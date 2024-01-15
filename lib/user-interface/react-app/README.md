# User Interface

## Running locally

You can run this vite react app locally following these steps.

### Deploy infrastructure to AWS

Follow instructions on the root folder README to deploy the cdk app.

You will need the CloudFormation Output values displayed after completion in the following step.

### Obtain environment configuration

Grab the `aws-exports.json` from the CloudFront distribution endpoint you obtained from the CDK Output, and save it into `./lib/user-interface/react-app/public/` folder.

The URL is something like:

https://dxxxxxxxxxxxx.cloudfront.net/aws-exports.json

### Build and run local dev server

```
npm run build:dev
npm run dev
```
