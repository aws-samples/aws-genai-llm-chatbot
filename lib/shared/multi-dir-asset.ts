import { BundlingOutput, CfnResource, DockerImage, IAsset, aws_s3_assets } from "aws-cdk-lib";
import { IGrantable } from "aws-cdk-lib/aws-iam";
import { IBucket } from "aws-cdk-lib/aws-s3";
import { Asset } from "aws-cdk-lib/aws-s3-assets";
import { Construct } from "constructs";
import * as path from "path";

interface MultiDirAssetProps {
    additionalFolders: string[];
    path: string;
}

const WORKING_PATH = '/asset-input/'

export class MultiDirAsset extends Construct implements IAsset {
    public readonly s3BucketName: string;
    public readonly s3ObjectKey: string;
    public readonly httpUrl: string;
    public readonly s3ObjectUrl: string;
    public readonly bucket: IBucket;
    public readonly isFile: boolean = false;
    public readonly isZipArchive: boolean = true;
    public readonly assetHash: string;
    public readonly assetPath: string;
    private readonly asset: Asset;

    constructor(scope: Construct, id: string, props: MultiDirAssetProps) {
        super(scope, id);

        this.asset = new aws_s3_assets.Asset(this, "asset", {
            path: props.path,
            bundling: {
                image: DockerImage.fromBuild(path.join(__dirname, 'alpine-zip')),
                command: ["zip", "-r", path.join("/asset-output", "lambda.zip"), "."],
                volumes: props.additionalFolders.map(f => ({
                        containerPath: path.join(WORKING_PATH, path.basename(f)),
                        hostPath: f
                    })),
                workingDirectory: WORKING_PATH,
                outputType: BundlingOutput.ARCHIVED,
            }
        })

        this.assetHash = this.asset.assetHash
        this.assetPath = this.asset.assetPath
        this.s3BucketName = this.asset.s3BucketName
        this.s3ObjectKey = this.asset.s3ObjectKey
        this.s3ObjectUrl = this.asset.s3ObjectUrl
        this.bucket = this.asset.bucket
        this.httpUrl = this.asset.httpUrl
    }

    grantRead(grantee: IGrantable): void {
        this.asset.grantRead(grantee)
    }

    addResourceMetadata(resource: CfnResource, resourceProperty: string): void {
        this.asset.addResourceMetadata(resource, resourceProperty)
    }
}
