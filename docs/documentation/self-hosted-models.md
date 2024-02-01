# SageMaker Model Constructs

This project provides multiple CDK constructs to help facilitate the deployment of models to Amazon SageMaker:
- [SageMaker Jumpstart](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/src/patterns/gen-ai/aws-model-deployment-sagemaker/README_jumpstart.md): Deploy a foundation model from Amazon SageMaker JumpStart to an Amazon SageMaker endpoint.
- [Hugging Face](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/src/patterns/gen-ai/aws-model-deployment-sagemaker/README_hugging_face.md): Deploy a foundation model from Hugging Face to an Amazon SageMaker endpoint (models supported by [HuggingFace LLM Inference container](https://huggingface.co/blog/sagemaker-huggingface-llm))
- [Custom model](https://github.com/awslabs/generative-ai-cdk-constructs/blob/main/src/patterns/gen-ai/aws-model-deployment-sagemaker/README_custom_sagemaker_endpoint.md): Deploy a foundation model from an S3 location to an Amazon SageMaker endpoint

These constructs can be consumed separately through the [Generative AI CDK Constructs](https://github.com/awslabs/generative-ai-cdk-constructs) library. 

You can see examples in the [lib/models/index.ts](https://github.com/aws-samples/aws-genai-llm-chatbot/blob/main/lib/models/index.ts) file demonstrating how to deploy several models like Llama2 13B chat, Mistral 8x7B or IDEFICS.

For additional samples demonstrating how to deploy models using these constructs, you can refer to the related [samples repository](https://github.com/aws-samples/generative-ai-cdk-constructs-samples). 

### Custom inference code

While the options above are preferred, for broader compatibility, the sample also showcases deployment of all other models from Hugging Face not supported by HuggingFace LLM Infernce container using custom inference code. This process is powered by AWS CodeBuild.

For this kind of deployment you need to choose the right container for your model from [this list of AWS Deep Learning Containers](https://github.com/aws/deep-learning-containers/blob/master/available_images.md). Based on PyTorch/Transformers versions, Python version etc. An example on how to use this construct is available [here](https://github.com/aws-samples/aws-genai-llm-chatbot/tree/main/lib/rag-engines/sagemaker-rag-models).

### Adapters

This samples provides [adapters](https://github.com/aws-samples/aws-genai-llm-chatbot/tree/main/lib/model-interfaces/langchain/functions/request-handler/adapters) for several models out of the box. The model you want to deploy might not have an existing adapter available, thus you will need to develop one. [This documentation](https://github.com/aws-samples/aws-genai-llm-chatbot/tree/main/lib/model-interfaces/langchain) provides steps to build you own adapter.

### Precautions

***Cost***: Be mindful of the costs associated with AWS resources, especially with SageMaker models which are billed by the hour. Leaving serverful resources running for extended periods or deploying numerous LLMs can quickly lead to increased costs.

***Licensing***: These constructs allow you to interact with models from third party providers. Your use of the third-party generative AI (GAI) models is governed by the terms provided to you by the third-party GAI model providers when you acquired your license to use them (for example, their terms of service, license agreement, acceptable use policy, and privacy policy).

You are responsible for ensuring that your use of the third-party GAI models comply with the terms governing them, and any laws, rules, regulations, policies, or standards that apply to you.

You are also responsible for making your own independent assessment of the third-party GAI models that you use, including their outputs and how third-party GAI model providers use any data that might be transmitted to them based on your deployment configuration. AWS does not make any representations, warranties, or guarantees regarding the third-party GAI models, which are “Third-Party Content” under your agreement with AWS. This construct is offered to you as “AWS Content” under your agreement with AWS.