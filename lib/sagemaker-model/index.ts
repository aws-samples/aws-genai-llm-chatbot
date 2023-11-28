export * from "./container-images";
export * from "./types";
import * as servicecatalog from "aws-cdk-lib/aws-servicecatalog";
import * as sagemaker from "aws-cdk-lib/aws-sagemaker";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { deployContainerModel } from "./deploy-container-model";
import { deployCustomScriptModel } from "./deploy-custom-script-model";
import { deployPackageModel } from "./deploy-package-model";
import { DeploymentType, SageMakerModelProps } from "./types";
import { CfnParameter } from "aws-cdk-lib";

export class SageMakerModelProduct extends servicecatalog.ProductStack {
  constructor(scope: Construct, id: string, props: SageMakerModelProps) {
    super(scope, id);
    const vpcId = new CfnParameter(this, "VpcId", {
      type: "AWS::EC2::VPC::Id",
    });
    const defaultSecurityGroupId = new CfnParameter(
      this,
      "DefaultSecurityGroupId",
      {
        type: "AWS::EC2::SecurityGroup::Id",
      }
    );
    const privateSubnets = new CfnParameter(this, "PrivateSubnets", {
      type: "List<AWS::EC2::Subnet::Id>",
    });
    const restApiIamRole = new CfnParameter(this, "RestApiIamRole", {
      type: "String"
    })
    const productOwner = new CfnParameter(this, "ProductOwner", {
      type:"String"
    })
    let modelProps = props;
    modelProps.privateSubnets = privateSubnets.valueAsList;
    modelProps.vpcId = vpcId.valueAsString;
    modelProps.securityGroupId = defaultSecurityGroupId.valueAsString;
    modelProps.restApiIamRole = restApiIamRole.valueAsString;
    modelProps.productOwner = productOwner!.valueAsString;
    new SageMakerModel(this, id , modelProps);
  }
}
export class SageMakerModel extends Construct {
  public readonly endpoint: sagemaker.CfnEndpoint;
  public readonly modelId: string | string[];

  constructor(scope: Construct, id: string, props: SageMakerModelProps) {
    super(scope, id);
    const modelParameterPath = "chatbot/models";
    const { model } = props;
    this.modelId = model.modelId;
    if (model.type == DeploymentType.Container) {
      const { endpoint } = deployContainerModel(this, props, model);
      this.endpoint = endpoint;
    } else if (model.type == DeploymentType.ModelPackage) {
      const { endpoint } = deployPackageModel(this, props, model);
      this.endpoint = endpoint;
    } else if (model.type == DeploymentType.CustomInferenceScript) {
      const { endpoint } = deployCustomScriptModel(this, props, model);
      this.endpoint = endpoint;
    }

    const parameterName = `/${props.productOwner!}/${modelParameterPath}/${id}`
    new ssm.StringParameter(this, "ModelsParameter", {
      parameterName: parameterName,
      simpleName: false,
      stringValue: JSON.stringify({
        name: id,
        endpoint: this.endpoint.ref,
        responseStreamingSupported: props.responseStreamingSupported,
        inputModalities: props.inputModalities,
        outputModalities: props.outputModalities,
        interface: props.interface,
        ragSupported: props.ragSupported,
      }),
    });


    if (props.restApiIamRole) {
      //Get the role from the ARN and attach the policy
      iam.Role.fromRoleArn(this, id, props.restApiIamRole)
        .attachInlinePolicy(new iam.Policy(this, "SageMakerInvoke", {
          document: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ["sagemaker:InvokeEndpoint"],
                resources: [this.endpoint.ref],
              })
            ]
          })
        }))
    }

  }
}
