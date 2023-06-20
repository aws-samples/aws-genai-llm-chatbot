import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

import { ChatBotBackendStack } from './chatbot-backend/chatbot-backend-stack';
import {
  LargeLanguageModel,
  ModelKind,
  ContainerImages,
} from './large-language-model';

export interface ChatBotStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  semanticSearchApi: lambda.Function | null;
  maxParallelLLMQueries: number;
}

export class ChatBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ChatBotStackProps) {
    super(scope, id, {
      description: 'AWS LLM CHATBOT (uksb-1tupboc16)',
      ...props,
    });

    const { vpc, semanticSearchApi, maxParallelLLMQueries } = props;

    const largeLanguageModels = this.createLLMs({ vpc });
    new ChatBotBackendStack(this, 'ChatBotBackendStack', {
      vpc: vpc,
      semanticSearchApi,
      largeLanguageModels,
      maxParallelLLMQueries,
    });
  }

  createLLMs({ vpc }: { vpc: ec2.Vpc }) {
    const falcon40bInstruct = new LargeLanguageModel(
      this,
      'tiiuae-falcon40b-instruct',
      {
        vpc,
        region: this.region,
        model: {
          kind: ModelKind.Container,
          modelId: 'tiiuae/falcon-40b-instruct',
          container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_LATEST,
          instanceType: 'ml.g4dn.12xlarge', // use g5.24xlarge to increase speed
          env: {
            HF_MODEL_QUANTIZE: 'bitsandbytes', // comment with g5.24xlarge
            SM_NUM_GPUS: '4',
          },
        },
      }
    );

    /*

      Examples of other models you can use below

    */

    // const lightGPT = new LargeLanguageModel(this, 'AmazonLightGPT', {
    //   vpc,
    //   region: this.region,
    //   model: {
    //     kind: ModelKind.Container,
    //     modelId: 'amazon/LightGPT',
    //     container: ContainerImages.DJL_INFERENCE_DEEPSPEED_LATEST,
    //     instanceType: 'ml.g4dn.2xlarge',
    //   },
    // });

    /*
    const redPajama7b = new LargeLanguageModel(this, 'RedPajama-INCITE-7B-Chat', {
      vpc,
      region: this.region,
      model: {
        kind: ModelKind.Container,
        modelId: 'togethercomputer/RedPajama-INCITE-7B-Chat',
        container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_LATEST,
        instanceType: 'ml.g4dn.2xlarge',
        env: {
          HF_MODEL_QUANTIZE: 'bitsandbytes',
        },
      },
    });
    */

    /*
    const redPajama3b = new LargeLanguageModel(this, 'RedPajama-INCITE-Chat-3B-v1', {
      vpc,
      region: this.region,
      model: {
        kind: ModelKind.Container,
        modelId: 'togethercomputer/RedPajama-INCITE-Chat-3B-v1',
        container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_LATEST,
        instanceType: 'ml.g4dn.xlarge',
        env: {
          //HF_MODEL_QUANTIZE: 'bitsandbytes',
        },
      },
    });
    */

    /*
    const pythia12b = new LargeLanguageModel(this, 'OpenAssistant-pythia12b', {
      vpc,
      region: this.region,
      model: {
        kind: ModelKind.Container,
        modelId: 'OpenAssistant/pythia-12b-sft-v8-7k-steps',
        container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_LATEST,
        instanceType: 'ml.g5.12xlarge',
        env: {
          HF_MODEL_QUANTIZE: 'bitsandbytes',
          SM_NUM_GPUS: '4',
        },
      },
    });
    */

    /*     
    const ai21j2grandev1 = new LargeLanguageModel(this, 'ai21j2grandev1', {
      vpc,
      region: this.region,
      model: {
        kind: ModelKind.Package,
        modelId: 'ai21/j2-grande-instruct-v1',
        instanceType: 'ml.g5.12xlarge',
        packages: (scope) =>
          new cdk.CfnMapping(scope, 'AI21GrandeInstructModelPackageMapping', {
            lazy: true,
            mapping: {
              'us-east-1': { arn: 'arn:aws:sagemaker:us-east-1:865070037744:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'us-east-2': { arn: 'arn:aws:sagemaker:us-east-2:057799348421:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'us-west-1': { arn: 'arn:aws:sagemaker:us-west-1:382657785993:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'us-west-2': { arn: 'arn:aws:sagemaker:us-west-2:594846645681:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'ca-central-1': { arn: 'arn:aws:sagemaker:ca-central-1:470592106596:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'eu-central-1': { arn: 'arn:aws:sagemaker:eu-central-1:446921602837:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'eu-west-1': { arn: 'arn:aws:sagemaker:eu-west-1:985815980388:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'eu-west-2': { arn: 'arn:aws:sagemaker:eu-west-2:856760150666:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'eu-west-3': { arn: 'arn:aws:sagemaker:eu-west-3:843114510376:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'eu-north-1': { arn: 'arn:aws:sagemaker:eu-north-1:136758871317:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'ap-southeast-1': { arn: 'arn:aws:sagemaker:ap-southeast-1:192199979996:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'ap-southeast-2': { arn: 'arn:aws:sagemaker:ap-southeast-2:666831318237:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'ap-northeast-2': { arn: 'arn:aws:sagemaker:ap-northeast-2:745090734665:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'ap-northeast-1': { arn: 'arn:aws:sagemaker:ap-northeast-1:977537786026:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'ap-south-1': { arn: 'arn:aws:sagemaker:ap-south-1:077584701553:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
              'sa-east-1': { arn: 'arn:aws:sagemaker:sa-east-1:270155090741:model-package/j2-grande-instruct-v1-1-43-b1704f916990312a8e21b249a0bd479c' },
            },
          }),
      },
    });
    */

    return [falcon40bInstruct];
  }
}
