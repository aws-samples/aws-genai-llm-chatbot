import os
import shutil

# Needed since it is a build script
# that runs during deployment.
import subprocess  # nosec B404
from pathlib import Path

import boto3
from huggingface_hub import snapshot_download

s3_client = boto3.client("s3")

local_model_folder = os.getenv("LOCAL_MODEL_FOLDER", "./model")
bucket = os.getenv("BUILD_BUCKET", "")
model_ids = os.getenv("MODEL_ID", "")
models_list = list(map(lambda val: val.strip(), model_ids.split(",")))
models_num = len(models_list)

print(f"Model ID: {model_ids}", flush=True)
print(f"Bucket: {bucket}", flush=True)

out_folder = Path("out")
if out_folder.exists():
    shutil.rmtree(str(out_folder))
out_folder.mkdir(exist_ok=True)

print(f"Creating new code folder: {out_folder}/code", flush=True)
model_code_folder = Path(os.path.join(out_folder, "code"))
model_code_folder.mkdir(exist_ok=True)

print(f"Copying contents from {local_model_folder} to {model_code_folder}", flush=True)
shutil.copytree(local_model_folder, str(model_code_folder), dirs_exist_ok=True)

for model_id in models_list:
    if models_num == 1:
        model_folder = out_folder
    else:
        model_folder = Path(out_folder, model_id.split("/")[-1])
        if model_folder.exists():
            shutil.rmtree(str(model_folder))
        model_folder.mkdir(exist_ok=True)

    print(f"Model folder: {model_folder}", flush=True)
    print(
        f"Downloading model snapshot for: {model_id} into {model_folder}",
        flush=True,
    )

    snapshot_download(
        model_id, local_dir=str(model_folder), local_dir_use_symlinks=False
    )

    print(f"Model snapshot downloaded to: {model_folder}", flush=True)


print(f"Compressing the out folder: {out_folder}", flush=True)

current_folder = os.getcwd()
print(f"Current folder: {current_folder}")
os.chdir(str(out_folder))

print(f"Compressing the model folder: {out_folder}")
command = "tar -cf model.tar.gz --use-compress-program=pigz *"
print(f"Running command: {command}")
subprocess.run(
    command, shell=True, check=True
)  # nosec B602 Command is not user provided
print(f"Model folder compressed: {out_folder}")
print(f"Moving back to: {current_folder}")
os.chdir(current_folder)

print(f"Uploading the model to S3 bucket: {bucket}")
s3_client.upload_file(out_folder.joinpath("model.tar.gz"), bucket, "out/model.tar.gz")
model_data = f"s3://{bucket}/out/model.tar.gz"

print(f"Model archive uploaded to: {model_data}")
