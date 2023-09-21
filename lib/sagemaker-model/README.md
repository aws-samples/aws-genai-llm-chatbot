## SageMaker Model Construct

A prupose-built CDK Construct, [SageMakerModel](./index.ts), which helps facilitate the deployment of model to SageMaker, you can use this layer to deploy:
- Models from SageMaker Foundation Models
- Models from SageMaker Jumpstart.
- Model supported by [HuggingFace LLM Inference container](https://huggingface.co/blog/sagemaker-huggingface-llm).
- Models from HuggingFace with custom inference code.


# ⚠️ Precautions ⚠️

Before you begin using the sample, there are certain precautions you must take into account:

- **Cost Management with self hosted models**: Be mindful of the costs associated with AWS resources, especially with SageMaker models which are billed by the hour. While the sample is designed to be cost-effective, leaving serverful resources running for extended periods or deploying numerous LLMs can quickly lead to increased costs.

- **Licensing obligations**: If you choose to use any datasets or models alongside the provided samples, ensure you check LLM code and comply with all licensing obligations attached to them.

- **This is a sample**: the code provided as part of this repository shouldn't be used for production workloads without further reviews and adaptation.

# Preview Access and Service Quotas

- **Instance type quota increase**
You might consider requesting an increase in service quota for specific SageMaker instance types such as the `ml.g5` instance type. This will give access to latest generation of GPU/Multi-GPU instances types. You can do this from the AWS console.

- **Foundation Models Preview Access**
If you are looking to deploy models from SageMaker foundation models, you need to request preview access from the AWS console.
Futhermore, make sure which regions are currently supported for SageMaker foundation models.


#### Deploy from SageMaker Foundation/Jumpstart Models
The sample allows you to deploy models from [**Amazon SageMaker Foundation models**](https://docs.aws.amazon.com/sagemaker/latest/dg/jumpstart-foundation-models-choose.html) by specifying the model ARN. This simplifies the deployment process of these AI models on AWS.

```typescript
new SageMakerModel(this, 'FoundationModelId', {
  vpc,
  region: this.region,
  model: {
    type: DeploymentType.ModelPackage,
    modelId: 'modelId', // i.e. ai21/j2-grande-instruct-v1 - this is an arbitrary ID  
    instanceType: 'instanceType', // i.e. ml.g5.12xlarge
    packages: (scope) =>
      new cdk.CfnMapping(scope, 'ModelPackageMapping', {
        lazy: true,
        mapping: {
          'region': { arn: 'container-arn' },
        },
      }),
    },
});
```
The `container-arn` of interest can be found in different places:

- For SM Foundation Models, some model cards exposes the ARN, otherwise you need to deploy one manually from the console and copy the `ModelPackage` ARN from `SageMaker -> Models -> Deployed model` in the console

- For SM Jumpstart Models, at the moment, you need to deploy the model of insterest from SageMaker Studio and then from the console and copy the `ModelPackage` ARN from `SageMaker -> Models -> Deployed model` in the console.


#### Hugging Face LLM Inference Container
The solution provides support for all publicly accessible LLMs supported by [HuggingFace LLM Inference container](https://huggingface.co/blog/sagemaker-huggingface-llm), thereby expanding your model options and letting you leverage a wide variety of pre-trained models available on this platform.

```typescript
new SageMakerModel(this, 'HFModel', {
    vpc,
    region: this.region,
    model: {
      type: DeploymentType.Container,
      modelId: 'modelId', // i.e. tiiuae/falcon-40b-instruct - this must match HuggingFace Model ID
      container: ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_LATEST,
      instanceType: 'instanceType', // i.e. ml.g5.24xlarge
      env: {
        ...
      },
    },
  });
```

#### Models with custom inference
While the options above are preferred, for broader compatibility, the sample also showcases deployment of all other models from Hugging Face not supported by HuggingFace LLM Infernce container using custom inference code. This process is powered by **AWS CodeBuild**.

For this kind of deployment you need to choose the right container for your model from this list of [AWS Deep Learning Containers](https://github.com/aws/deep-learning-containers/blob/master/available_images.md). Based on PyTorch/Transformers versions, Python version etc.

```typescript
new SageMakerModel(this, 'ModelId', {
  vpc,
  region: this.region,
  model: {
    type: DeploymentType.CustomInference,
    modelId: 'modelId', // i.e. sentence-transformers/all-MiniLM-L6-v2 - this must match HuggingFace Model ID
    codeFolder: 'localFolder', // see for example ./lib/aurora-semantic-search/embeddings-model
    container: 'container-arn', // One from https://github.com/aws/deep-learning-containers/blob/master/available_images.md
    instanceType: 'instanceType', // i.e. g5.12xlarge
    codeBuildComputeType: codebuild.ComputeType.LARGE, // Size of CodeBuild instance. Must have enough storage to download the whole model repository from HuggingFace
  }
});
```

An example of how this deployment type is used in this repo can be found [here](../rag-sources/aurora-pgvector/index.ts#L120), where it's used to deploy an embedding model from HuggingFace.