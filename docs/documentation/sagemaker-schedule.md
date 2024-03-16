# Sagemaker Schedule

This feature set during the installation setup allows the user to set a cron schedule to start and stop their sagemaker hosted models if they enabled any.

As specificed during setup the user has a choice between Simple and CRON Format.

Cron is more powerful in terms of its scheduling capability but Simple should suffice for most users.

The schedule if enabled and set during the setup utilises the Amazone EventBridge Scheduler to coordinate the starting and stopping of the models for the given schedule.

Amazon EventBridge Scheduler utilises a specific cron format and you can read about that in the [EventBridge docs](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-cron-expressions.html)

### Limitations

The sagemaker endpoint must be active when running further CDK deployments otherwise some dependencies will fail attempting to enumerate the sagemaker endpoint.

If this happens and you need to run a deployment simply use the AWS Console to re-create the sagemaker endpoint and then continue the CDK deployment.