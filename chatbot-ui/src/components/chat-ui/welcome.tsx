function Welcome() {
  return (
    <div className="flex h-screen w-full justify-center dark:text-white">
      <div className="w-full my-auto flex justify-center items-center pt-6 pb-52 md:pb-40">
        <div className="text-center w-10/12 lg:w-2/3 max-w-4xl">
          <h1 className="mb-2 text-3xl font-semibold ">AWS LLM CHATBOT SAMPLE</h1>
          <p className="mb-4 text-xl">
            A comprehensive sample demonstrating how to securely deploy Large Language Models
            <br />
            on AWS in CI/CD fashion via AWS CDK.
          </p>
          <h2 className="mb-2 text-xl font-semibold">DEPLOY FROM</h2>
          <div className="flex gap-x-5 gap-y-4 md:gap-y-0 justify-around mb-6 flex-col md:flex-row">
            <div className="md:w-1/3 bg-white dark:bg-gray-700 py-3 px-2 rounded-md shadow-md border border-gray-300 dark:border-gray-700">
              <h2 className="text-xl font-bold">Foundation Models</h2>
              <p className="text-md mb-4">Amazon SageMaker</p>
              <p className="text-md">
                Foundation models are pre-trained models available in the{' '}
                <a
                  className="font-bold text-sky-600 dark:text-sky-400"
                  href="https://console.aws.amazon.com/sagemaker/home?#/foundation-models"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  SageMaker console
                </a>
              </p>
              <p className="mt-2 italic">Needs preview access</p>
            </div>
            <div className="md:w-1/3 bg-white dark:bg-gray-700 py-3 px-2 rounded-md shadow-md border border-gray-300 dark:border-gray-700">
              <h2 className="text-xl font-semibold">HuggingFace</h2>
              <p className="text-md mb-4">LLM Inference Container</p>
              <p>
                Deploy open-source LLMs to Amazon SageMaker for inference using the new{' '}
                <a className="font-bold text-sky-600 dark:text-sky-400" href="https://huggingface.co/blog/sagemaker-huggingface-llm" rel="noopener noreferrer" target="_blank">
                  Hugging Face LLM Inference Container
                </a>
              </p>
            </div>
            <div className="md:w-1/3 bg-white dark:bg-gray-700 py-3 px-2 rounded-md shadow-md border border-gray-300 dark:border-gray-700">
              <h2 className="text-xl font-semibold">HuggingFace</h2>
              <p className="text-md mb-4">Custom Inference Script</p>
              <p>
                Deploy models from HuggingFace with custom inference code leveraging a complete automation built on{' '}
                <a className="font-bold text-sky-600 dark:text-sky-400" href="https://aws.amazon.com/codebuild/" rel="noopener noreferrer" target="_blank">
                  CodeBuild
                </a>
              </p>
            </div>
          </div>
          <h2 className="mb-2 text-xl font-semibold">CHAT MODES</h2>
          <div className="flex gap-x-5 gap-y-4 md:gap-y-0 justify-around mb-6 flex-col md:flex-row">
            <div className="md:w-2/4 bg-white dark:bg-gray-700 py-3 px-2 rounded-md shadow-md border border-gray-300 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Streaming Mode</h2>
              <p>
                SageMaker endpoint is queried for small batches of token predictions, enabling incremental response generation.
                <br />
              </p>
              <p className="mt-3">
                Built on top of{' '}
                <a
                  className="font-bold text-sky-600 dark:text-sky-400"
                  href="https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  AWS Lambda Response Streaming
                </a>
              </p>
            </div>
            <div className="md:w-2/4 bg-white dark:bg-gray-700 py-3 px-2 rounded-md shadow-md border border-gray-300 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Standard Mode</h2>
              <p>Standard mode initiates a one-time request to the LLM SageMaker endpoint, awaiting the entire response in a single instance.</p>
            </div>
          </div>
          <h2 className="mb-2 text-xl font-semibold">OPTIONAL STACKS</h2>
          <div className="flex justify-around gap-x-5 gap-y-4 md:gap-y-0 flex-col md:flex-row">
            <div className="md:w-2/4 bg-white dark:bg-gray-700 px-2 py-3  rounded-md shadow-md border border-gray-300 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Vector Database on RDS </h2>
              <p className="text-md mb-2">and integrated RAG w/ Similarity Search</p>
              <p>
                This optional stack is readily available for a seamless deployment of a Vector Database on top of{' '}
                <a
                  className="font-bold text-sky-600 dark:text-sky-400"
                  href="https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Amazon RDS for PostgreSQL
                </a>{' '}
                with{' '}
                <a
                  className="font-bold text-sky-600 dark:text-sky-400"
                  href="https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  pgvector
                </a>{' '}
                with automatic indexing for documents uploaded to a dedicated S3 Bucket.
              </p>
              <p className="text-sm italic mt-3">You can enable/disable this stack in CDK</p>
            </div>
            <div className="md:w-2/4 bg-white dark:bg-gray-700 px-2 py-3 rounded-md shadow-md border border-gray-300 dark:border-gray-700">
              <h2 className="text-xl font-semibold">Web App</h2>
              <p className="text-md mb-2">with Cognito authentication</p>
              <p>
                This optional stack deploys a React based webapp on Amazon S3 and Amazon CloudFront to help you interact and experiment with <b>multiple LLMs simultaneously</b>{' '}
                with conversational history support.
              </p>
              <p className="text-sm italic mt-3">You can enable/disable this stack in CDK</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Welcome;
