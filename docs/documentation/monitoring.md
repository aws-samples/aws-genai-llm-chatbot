# Monitoring
By default, the project will create a [Amazon CloudWatch Dashboard](https://console.aws.amazon.com/cloudwatch). This Dashboard is created using the library [cdk-monitoring-constructs](https://github.com/cdklabs/cdk-monitoring-constructs) and it is recommended to update the metrics you tracks based on your project needs.

The dashboard is created in `lib/monitoring/index.ts`

During the configuration set, the advanced settings allows you to enable advance monitoring which will do the following:
* [Enable AWS X-Ray](https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html) which will collect traces availbale by opening the [Trace Map](https://docs.aws.amazon.com/xray/latest/devguide/xray-console-servicemap.html) from the CloudWatch console.
* Generate a custom metric per LLM model used using Amazon Bedrock allowing you to track token usage. This metrics are available in the dashboard. These metrics are created using [Cloudwatch filters](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/MonitoringLogData.html).
* Create sample CloudWatch Alarms. 

***Cost***: Be mindful of the costs associated with AWS resources, enabling advance motoring is [adding custom metrics, alarms](https://aws.amazon.com/cloudwatch/pricing/) and [AWS X-Ray traces](https://aws.amazon.com/xray/pricing/).

## Recommended changes (Advanced monitoring)

### Recevie alerts
The default setup is monitoring key resources such as the error rates of the APIs or the dead letter queues (if not empty, the processing of LLM requests failed). All these alarms can be viewed from the Amazon CloudWatch console.

The alarms state is monitoring by a [composite alarm](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/Create_Composite_Alarm.html) which will send an event to an SNS Topic if any alarm is active.

To receive notifications, add a [subscription](https://docs.aws.amazon.com/sns/latest/dg/sns-create-subscribe-endpoint-to-topic.html) (manually or in `lib/monitoring/index.ts`) to the topic listed in the Cloudformation output `CompositeAlarmTopicOutput`.

### Update alarms and their thresholds
The alarms listed in `lib/monitoring/index.ts` are example and they should be updated to match your project needs. Please refer to the following [project describing](https://github.com/cdklabs/cdk-monitoring-constructs) how to add/update the alarms.

### Review AWS X-Ray sampling
Consider updating the default [AWS X-Ray sampling rules](https://docs.aws.amazon.com/xray/latest/devguide/xray-console-sampling.html) to define the amount of data recorded

