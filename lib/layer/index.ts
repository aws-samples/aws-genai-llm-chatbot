import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3assets from "aws-cdk-lib/aws-s3-assets";
import * as lpath from "path";
import { execSync } from "child_process";
import { Construct } from "constructs";

interface LayerProps {
  runtime: lambda.Runtime;
  architecture: lambda.Architecture;
  path: string;
  autoUpgrade?: boolean;
}

export class Layer extends Construct {
  public layer: lambda.LayerVersion;

  constructor(scope: Construct, id: string, props: LayerProps) {
    super(scope, id);

    const { runtime, architecture, path, autoUpgrade } = props;

    const args = ["-t /asset-output/python"];
    if (autoUpgrade) {
      args.push("--upgrade");
    }

    const layerAsset = new s3assets.Asset(this, "LayerAsset", {
      path,
      bundling: {
        local: {
          /* implements a local method of bundling that does not depend on Docker. Local
          bundling is preferred over DIND for performance and security reasons.
          see https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.ILocalBundling.html and 
          https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3_assets-readme.html#asset-bundling */    
          tryBundle(outputDir: string, options: cdk.BundlingOptions) {
            let canRunLocal = false;
            let python = props.runtime.name;

            /* check if local machine architecture matches lambda runtime architecture. annoyingly,
            Node refers to x86_64 CPUs as x64 instead of using the POSIX standard name. 
            https://nodejs.org/docs/latest-v18.x/api/process.html#processarch
            https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda.Architecture.html */
            if (!((process.arch == 'x64' && architecture.name == 'x86_64') || (process.arch == architecture.name))) {
              console.log(`Can't do local bundling because local arch != target arch (${process.arch} != ${architecture.name})`);
              // Local bundling is pointless if architectures don't match
              return false;
            }

            try {
              // check if pip is available locally
              const testCommand = `${python} -m pip -V`
              console.log(`Checking for pip: ${testCommand}`)
              // without the stdio arg no output is printed to console
              execSync(testCommand, { stdio: 'inherit' });
              // no exception means command executed successfully
              canRunLocal = true;
            } catch {
              // execSync throws Error in case return value of child process is non-zero.
              // Actual output should be printed to the console.
              console.warn(`Unable to do local bundling! ${python} with pip must be on path.`);
            }

            if (canRunLocal) {
              const command = `${python} -m pip install -r ${lpath.posix.join(path, "requirements.txt")} -t ${outputDir} ${autoUpgrade ? '-U' : ''}`;
              try {
                console.debug(`Local bundling: ${command}`);
                // this is where the work gets done
                execSync(command, { stdio: 'inherit' });
                return true;
              } catch (ex) {
                // execSync throws Error in case return value of child process
                // is non-zero. It'll be printed to the console because of the 
                // stdio argument.                             
                console.log(`Local bundling attempt failed: ${ex}`)
              }
            }
            // if we get here then Docker will be used as configured below
            return false;
          }
        },
        image: runtime.bundlingImage,
        platform: architecture.dockerPlatform,
        command: [
          "bash",
          "-c",
          `pip install -r requirements.txt ${args.join(" ")}`,
        ],
        outputType: cdk.BundlingOutput.AUTO_DISCOVER,
        securityOpt: "no-new-privileges:true",
        network: "host",
      },
    });

    const layer = new lambda.LayerVersion(this, "Layer", {
      code: lambda.Code.fromBucket(layerAsset.bucket, layerAsset.s3ObjectKey),
      compatibleRuntimes: [runtime],
      compatibleArchitectures: [architecture],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.layer = layer;
  }
}
