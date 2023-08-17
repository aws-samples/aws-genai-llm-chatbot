import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, Pipeline


class SimpleLLMPipeline(Pipeline):
    def _sanitize_parameters(self, **generate_kwargs):
        preprocess_params = {}
        forward_params = generate_kwargs
        if "max_new_tokens" not in forward_params:
            forward_params["max_new_tokens"] = 50
        if "do_sample" not in forward_params:
            forward_params["do_sample"] = True
        if "temperature" not in forward_params:
            forward_params["temperature"] = 0.1
        if "top_p" not in forward_params:
            forward_params["top_p"] = 0.7
        if "top_k" not in forward_params:
            forward_params["top_k"] = 50
        if "pad_token_id" not in forward_params:
            forward_params["pad_token_id"] = self.tokenizer.eos_token_id

        postprocess_params = {}

        return preprocess_params, forward_params, postprocess_params

    def preprocess(self, inputs, **kwargs):
        inputs = self.tokenizer(inputs, return_tensors="pt")

        return inputs

    def _forward(self, model_inputs, **kwargs):
        input_ids = model_inputs["input_ids"]
        attention_mask = model_inputs["attention_mask"]

        with torch.no_grad():
            outputs = self.model.generate(
                input_ids=input_ids.to(self.model.device),
                attention_mask=attention_mask.to(self.model.device),
                return_dict_in_generate=True,
                **kwargs
            )

        return {"input_ids": input_ids, "outputs": outputs}

    def postprocess(self, model_outputs, **kwargs):
        input_ids = model_outputs["input_ids"]
        input_length = input_ids.shape[1]
        outputs = model_outputs["outputs"]
        new_tokens = outputs.sequences[0][input_length:]

        stop = False
        stop_token_id = self.tokenizer.eos_token_id
        if stop_token_id in new_tokens:
            stop = True

        decoded = self.tokenizer.decode(new_tokens)
        ret_value = {"generated_text": decoded, "stop": stop}

        return ret_value


def model_fn(model_dir):
    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForCausalLM.from_pretrained(
        model_dir, device_map="auto", torch_dtype=torch.float16, load_in_8bit=True
    )

    pipeline = SimpleLLMPipeline(model=model, tokenizer=tokenizer)

    return pipeline
