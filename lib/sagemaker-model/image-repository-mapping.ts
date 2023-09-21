import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

export interface ImageRepositoryMappingProps {
  region: string;
}

export class ImageRepositoryMapping extends Construct {
  public readonly mapping: cdk.CfnMapping;
  public readonly account: string;

  constructor(
    scope: Construct,
    id: string,
    props: ImageRepositoryMappingProps
  ) {
    super(scope, id);

    const { region } = props;

    const mapping = new cdk.CfnMapping(scope, "ImageRepositoryCfnMapping", {
      lazy: true,
      mapping: {
        "af-south-1": { account: "626614931356" },
        "ap-east-1": { account: "871362719292" },
        "ap-northeast-1": { account: "763104351884" },
        "ap-northeast-2": { account: "763104351884" },
        "ap-northeast-3": { account: "364406365360" },
        "ap-south-1": { account: "763104351884" },
        "ap-south-2": { account: "772153158452" },
        "ap-southeast-1": { account: "763104351884" },
        "ap-southeast-2": { account: "763104351884" },
        "ap-southeast-3": { account: "907027046896" },
        "ap-southeast-4": { account: "457447274322" },
        "ca-central-1": { account: "763104351884" },
        "cn-north-1": { account: "727897471807" },
        "cn-northwest-1": { account: "727897471807" },
        "eu-central-1": { account: "763104351884" },
        "eu-central-2": { account: "380420809688" },
        "eu-north-1": { account: "763104351884" },
        "eu-west-1": { account: "763104351884" },
        "eu-west-2": { account: "763104351884" },
        "eu-west-3": { account: "763104351884" },
        "eu-south-1": { account: "692866216735" },
        "eu-south-2": { account: "503227376785" },
        "me-south-1": { account: "217643126080" },
        "me-central-1": { account: "914824155844" },
        "sa-east-1": { account: "763104351884" },
        "us-east-1": { account: "763104351884" },
        "us-east-2": { account: "763104351884" },
        "us-gov-east-1": { account: "446045086412" },
        "us-gov-west-1": { account: "442386744353" },
        "us-iso-east-1": { account: "886529160074" },
        "us-isob-east-1": { account: "094389454867" },
        "us-west-1": { account: "763104351884" },
        "us-west-2": { account: "763104351884" },
      },
    });

    const account = mapping.findInMap(region, "account");

    this.mapping = mapping;
    this.account = account;
  }
}
