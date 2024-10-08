import {
  AssetHashType,
  BundlingOutput,
  DockerImage,
  aws_s3_assets,
} from "aws-cdk-lib";
import { Code, S3Code } from "aws-cdk-lib/aws-lambda";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { md5hash } from "aws-cdk-lib/core/lib/helpers-internal";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";

function calculateHash(paths: string[]): string {
  return paths.reduce((mh, p) => {
    const dirs = fs.readdirSync(p);
    const hash = calculateHash(
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
    console.log(assetPath, calculateHash([assetPath, ...this.sharedAssets]));
    const asset = new aws_s3_assets.Asset(
      this,
      md5hash(assetPath).slice(0, 6),
      {
        path: assetPath,
        bundling: {
          image:
            process.env.NODE_ENV === "test"
              ? DockerImage.fromRegistry("dummy-skip-build-in-test")
              : DockerImage.fromBuild(path.posix.join(__dirname, "alpine-zip")),
          command: [
            "zip",
            "-r",
            "-9",
            path.posix.join("/asset-output", "asset.zip"),
            ".",
          ],
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
    return asset;
  }

  bundleWithLambdaAsset(assetPath: string): S3Code {
    const asset = this.bundleWithAsset(assetPath);
    return Code.fromBucket(asset.bucket, asset.s3ObjectKey);
  }
}
