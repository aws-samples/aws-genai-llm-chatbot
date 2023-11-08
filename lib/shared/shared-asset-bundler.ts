import { BundlingOutput, DockerImage, IAsset, aws_s3_assets } from "aws-cdk-lib";
import { AssetApiDefinition } from "aws-cdk-lib/aws-apigateway";
import { Code, S3Code } from "aws-cdk-lib/aws-lambda";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { md5hash } from "aws-cdk-lib/core/lib/helpers-internal";
import { Construct } from "constructs";
import * as path from "path";

export class SharedAssetBundler extends Construct {
    private readonly sharedAssets: string[];
    private readonly WORKING_PATH = '/asset-input/'
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
        const asset = new aws_s3_assets.Asset(this, md5hash(assetPath).slice(0, 6), {
            path: assetPath,
            bundling: {
                image: DockerImage.fromBuild(path.join(__dirname, 'alpine-zip')),
                command: ["zip", "-r", path.join("/asset-output", "lambda.zip"), "."],
                volumes: this.sharedAssets.map(f => ({
                        containerPath: path.join(this.WORKING_PATH, path.basename(f)),
                        hostPath: f
                    })),
                workingDirectory: this.WORKING_PATH,
                outputType: BundlingOutput.ARCHIVED,
            }
        })
        return asset;
    }

    bundleWithLambdaAsset(assetPath: string): S3Code {
        const asset = this.bundleWithAsset(assetPath);
        return Code.fromBucket(asset.bucket, asset.s3ObjectKey);
    }
}
