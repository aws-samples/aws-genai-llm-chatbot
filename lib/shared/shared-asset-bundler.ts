import {
  AssetHashType,
  BundlingOutput,
  DockerImage,
  aws_s3_assets,
  BundlingOptions
} from "aws-cdk-lib";
import { Code, S3Code } from "aws-cdk-lib/aws-lambda";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { md5hash } from "aws-cdk-lib/core/lib/helpers-internal";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

function calculateHash(paths: string[]): string {
  return paths.reduce((mh, p) => {
    const dirs = fs.readdirSync(p);
    let hash = calculateHash(
      dirs
        .filter((d) => fs.statSync(path.join(p, d)).isDirectory())
        .map((v) => path.join(p, v))
    );
    return md5hash(
      mh +
        dirs
          .filter((d) => fs.statSync(path.join(p, d)).isFile())
          .reduce((h, f) => {
            return md5hash(h + fs.readFileSync(path.join(p, f)));
          }, hash)
    );
  }, "");
}

export class SharedAssetBundler extends Construct {
  private readonly sharedAssets: string[];
  private readonly WORKING_PATH = "/asset-input/";
  // see static init block below
  private static useLocalBundler: boolean = false;
  /** The container image we'll use if Local Bundling is not possible. */
  private static containerImage: DockerImage;

  /**
   * Check if possible to use local bundling instead of Docker. Sets `useLocalBundler` to 
   * true if local environment supports bundling. Referenced below in method bundleWithAsset(...).
   */
  static {
    const command = "zip -v";
    console.log(`Checking for zip: ${command}`);
    // check if zip is available locally
    try {
      // without stdio option command output does not appear in console
      execSync(command, { stdio: 'inherit' });
      // no exception means command executed successfully
      this.useLocalBundler = true;
    } catch {
      /* execSync throws Error in case return value of child process
      is non-zero. Actual output should be printed to the console. */
      console.warn("`zip` is required for local bundling; falling back to default method.");
    }

    try {
      /** Build Alpine image from local definition. */
      this.containerImage = DockerImage.fromBuild(path.posix.join(__dirname, "alpine-zip"));
    } catch (erx) {
      // this will result in an exception if  Docker is unavailable
      if (this.useLocalBundler) {
        /* we don't actually need the container if local bundling succeeds, but
        it is a required parameter in the method below. 
        https://hub.docker.com/_/scratch/ */
        this.containerImage = DockerImage.fromRegistry("scratch");
      } else { 
        // Build will fail anyway so no point suppressing the exception
        throw erx; 
      }
    }
  }  

  /**
   * Instantiate a new SharedAssetBundler. You then invoke `bundleWithAsset(pathToAsset)` to
   * bundle your asset code with the common code.
   *
   * For Lambda function handler assets, you can use `bundleWithLambdaAsset(pathToAsset)` as
   * a drop-in replacement for `lambda.Code.fromAsset()`
   *
   * @param scope
   * @param id
   * @param commonFolders : array of common folders to bundle with your asset code
   */
  constructor(scope: Construct, id: string, sharedAssets: string[]) {
    super(scope, id);
    this.sharedAssets = sharedAssets;
  }

  bundleWithAsset(assetPath: string): Asset {
    console.log(`Bundling asset ${assetPath}`);
    // necessary for access from anonymous class
    const thisAssets = this.sharedAssets;

    const asset = new aws_s3_assets.Asset(
      this,
      md5hash(assetPath).slice(0, 6),
      {
        path: assetPath,
        bundling: {
          local: {
            /* implements a local method of bundling that does not depend on Docker. Local
            bundling is preferred over DIND for performance and security reasons.
            see https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.ILocalBundling.html and 
            https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_s3_assets-readme.html#asset-bundling */
            tryBundle(outputDir: string, options: BundlingOptions) {
              if (SharedAssetBundler.useLocalBundler) {
                // base command to execute
                const command = `zip -r ${path.posix.join(outputDir, "asset.zip")} . `;              

                try {
                  console.debug(`Local bundling: ${assetPath}`);
                  // cd to dir of current asset and zip contents
                  execSync(`cd ${assetPath} && `.concat(command), {stdio: 'inherit'});                    
                  // do the same for each dir in shared assets array
                  thisAssets.forEach((a)=>{
                    /* Complete the command for this specific shared asset path; for example:
                    `cd ${assetPath}/.. && ${command} -i ${assetPath.basename}/*`   */
                    const cx = `cd ${path.posix.join(a, '..')} && `.concat(command).concat(`-i "${path.basename(a)}/*"`);
                    //execute the command in child process
                    execSync(cx, {stdio: 'inherit'});
                  });
                  // no exception means command executed successfully
                  return true;
                } catch (ex) {
                  // execSync throws Error in case return value of child process
                  // is non-zero. It'll be printed to the console because of the 
                  // stdio argument.                   
                  console.log(`local bundling attempt failed: ${ex}`)
                }
              }
              // if we get here then Docker will be used as configured below
              return false;
            }
          },
          image: SharedAssetBundler.containerImage,
          command: ["zip", "-r", path.posix.join("/asset-output", "asset.zip"), "."],
          volumes: this.sharedAssets.map((f) => ({
            containerPath: path.posix.join(this.WORKING_PATH, path.basename(f)),
            hostPath: f,
          })),
          workingDirectory: this.WORKING_PATH,
          outputType: BundlingOutput.ARCHIVED,
        },
        assetHash: calculateHash([assetPath, ...this.sharedAssets]),
        assetHashType: AssetHashType.CUSTOM,
      }
    );
    console.log(`Successfully bundled ${asset.toString()} shared assets for ${assetPath} as ${asset.s3ObjectKey}.`);
    return asset;
  }

  bundleWithLambdaAsset(assetPath: string): S3Code {
    const asset = this.bundleWithAsset(assetPath);
    return Code.fromBucket(asset.bucket, asset.s3ObjectKey);
  }
}
