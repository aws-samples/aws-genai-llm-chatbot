import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import { Construct } from "constructs";
import { Utils } from "../shared/utils";
import { SystemConfig } from "../shared/types";

export function createStartSchedule(
  scope: Construct,
  id: string,
  sagemakerEndpoint: sagemaker.CfnEndpoint,
  role: iam.Role,
  config: SystemConfig
) {
  const scheduleName = Utils.getName(
    config,
    `startSchedule-${sagemakerEndpoint.endpointName}`,
    64
  );
  const scheduleExpression =
    config.llms?.sagemakerSchedule?.sagemakerCronStartSchedule;
  const timeZone = config.llms?.sagemakerSchedule?.timezonePicker;
  const enableScheduleEndDate =
    config.llms?.sagemakerSchedule?.enableScheduleEndDate;
  const scheduleEndDate = config.llms?.sagemakerSchedule?.startScheduleEndDate;
  const startSchedule = new scheduler.CfnSchedule(scope, scheduleName, {
    name: scheduleName,
    description: `created to start model endpoint ${sagemakerEndpoint.endpointName} for ${scheduleName}`,
    flexibleTimeWindow: {
      maximumWindowInMinutes: 5,
      mode: "FLEXIBLE",
    },
    scheduleExpression: `cron(${scheduleExpression})`,
    scheduleExpressionTimezone: timeZone,
    state: "ENABLED",
    endDate: enableScheduleEndDate
      ? `${scheduleEndDate}T00:00:59.000Z`
      : undefined,
    target: {
      arn: "arn:aws:scheduler:::aws-sdk:sagemaker:createEndpoint",
      input: JSON.stringify({
        EndpointName: sagemakerEndpoint.endpointName,
        EndpointConfigName: sagemakerEndpoint.endpointConfigName,
      }),
      roleArn: role.roleArn,
    },
  });
  return startSchedule;
}

export function createStopSchedule(
  scope: Construct,
  id: string,
  sagemakerEndpoint: sagemaker.CfnEndpoint,
  role: iam.Role,
  config: SystemConfig
) {
  const scheduleName = Utils.getName(
    config,
    `stopSchedule-${sagemakerEndpoint.endpointName}`,
    64
  );
  const scheduleExpression =
    config.llms?.sagemakerSchedule?.sagemakerCronStopSchedule;
  const timeZone = config.llms?.sagemakerSchedule?.timezonePicker;
  const stopSchedule = new scheduler.CfnSchedule(scope, scheduleName, {
    name: scheduleName,
    description: `created to stop model endpoint ${sagemakerEndpoint.endpointName} for ${scheduleName}`,
    flexibleTimeWindow: {
      maximumWindowInMinutes: 5,
      mode: "FLEXIBLE",
    },
    scheduleExpression: `cron(${scheduleExpression})`,
    scheduleExpressionTimezone: timeZone,
    state: "ENABLED",
    target: {
      arn: "arn:aws:scheduler:::aws-sdk:sagemaker:deleteEndpoint",
      input: JSON.stringify({
        EndpointName: sagemakerEndpoint.endpointName,
      }),
      roleArn: role.roleArn,
    },
  });
  return stopSchedule;
}
