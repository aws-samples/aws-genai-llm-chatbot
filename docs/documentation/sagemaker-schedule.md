# Sagemaker Schedule

This feature set during the installation setup allows the user to set a CRON schedule to start and stop their Sagemaker hosted models if they enabled.

As specified during setup, the user has a choice between Simple and CRON Format.

Cron is more powerful in terms of its scheduling capability but Simple should suffice for most users.

The schedule if enabled and set during the setup utilizes the Amazone EventBridge Scheduler to coordinate the starting and stopping of the models for the given schedule.

Amazon EventBridge Scheduler utilizes a specific CRON format that can read about in the [EventBridge docs](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html)

### Limitations

The Sagemaker endpoint must be active when running further CDK deployments otherwise some dependencies will fail attempting to enumerate the Sagemaker endpoint.

If this happens and you need to run a deployment, simply use the AWS Console to re-create the Sagemaker endpoint and then continue the CDK deployment.