// https://github.com/aws/deep-learning-containers/blob/master/available_images.md
export class ContainerImages {
  /*
  HF_PYTORCH_INFERENCE
  https://github.com/aws/sagemaker-python-sdk/blob/master/src/sagemaker/image_uri_config/huggingface.json
  */
  static readonly HF_PYTORCH_INFERENCE_4_26_0 =
    "huggingface-pytorch-inference:1.13.1-transformers4.26.0-gpu-py39-cu117-ubuntu20.04";
  static readonly HF_PYTORCH_INFERENCE_4_28_1 =
    "huggingface-pytorch-inference:2.0.0-transformers4.28.1-gpu-py310-cu118-ubuntu20.04";
  static readonly HF_PYTORCH_INFERENCE_LATEST =
    ContainerImages.HF_PYTORCH_INFERENCE_4_28_1;
  /*
  HF_PYTORCH_LLM_TGI_INFERENCE
  https://github.com/aws/sagemaker-python-sdk/blob/master/src/sagemaker/image_uri_config/huggingface-llm.json
  */
  static readonly HF_PYTORCH_LLM_TGI_INFERENCE_0_6_0 =
    "huggingface-pytorch-tgi-inference:2.0.0-tgi0.6.0-gpu-py39-cu118-ubuntu20.04";
  static readonly HF_PYTORCH_LLM_TGI_INFERENCE_0_8_2 =
    "huggingface-pytorch-tgi-inference:2.0.0-tgi0.8.2-gpu-py39-cu118-ubuntu20.04";
  static readonly HF_PYTORCH_LLM_TGI_INFERENCE_0_9_3 =
    "huggingface-pytorch-tgi-inference:2.0.1-tgi0.9.3-gpu-py39-cu118-ubuntu20.04";
  static readonly HF_PYTORCH_LLM_TGI_INFERENCE_1_0_3 =
    "huggingface-pytorch-tgi-inference:2.0.1-tgi1.0.3-gpu-py39-cu118-ubuntu20.04";
  static readonly HF_PYTORCH_LLM_TGI_INFERENCE_1_1_0 =
    "huggingface-pytorch-tgi-inference:2.0.1-tgi1.1.0-gpu-py39-cu118-ubuntu20.04";
  static readonly HF_PYTORCH_LLM_TGI_INFERENCE_1_3_3 =
    "huggingface-pytorch-tgi-inference:2.1.1-tgi1.3.3-gpu-py310-cu121-ubuntu20.04";
  static readonly HF_PYTORCH_LLM_TGI_INFERENCE_LATEST =
    ContainerImages.HF_PYTORCH_LLM_TGI_INFERENCE_1_1_0;
  /*
  DJL_INFERENCE_DEEPSPEED
  https://github.com/aws/sagemaker-python-sdk/blob/master/src/sagemaker/image_uri_config/djl-deepspeed.json
  */
  static readonly DJL_INFERENCE_DEEPSPEED_0_8_3 =
    "djl-inference:0.22.1-deepspeed0.8.3-cu118";
  static readonly DJL_INFERENCE_DEEPSPEED_0_9_2 =
    "djl-inference:0.22.1-deepspeed0.9.2-cu118";
  static readonly DJL_INFERENCE_DEEPSPEED_LATEST =
    ContainerImages.DJL_INFERENCE_DEEPSPEED_0_9_2;
}
