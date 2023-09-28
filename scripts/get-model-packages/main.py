import sys
import json
from boto3.session import Session
from sagemaker.jumpstart.model import JumpStartModel

# pip install --upgrade --quiet sagemaker


def get_model_packages(model_id):
    session = Session()
    sagemaker_regions = session.get_available_regions("sagemaker")
    ret_value = {}

    for region in sagemaker_regions:
        try:
            model = JumpStartModel(model_id=model_id, region=region)

            ret_value[region] = {"arn": model.model_package_arn}
        except:
            print(f"Model not found in {region}")

    return ret_value


def main() -> int:
    """
    https://sagemaker.readthedocs.io/en/stable/doc_utils/pretrainedmodels.html
    """
    # model_id = "meta-textgeneration-llama-2-13b" # Base Model
    model_id = "meta-textgeneration-llama-2-13b-f"  # Chat Model
    packages = get_model_packages(model_id)
    print(json.dumps(packages))

    return 0


if __name__ == "__main__":
    sys.exit(main())
