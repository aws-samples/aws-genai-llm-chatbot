# Restricting access to CloudFront with GEO restrictions

Reducing your attack surface whenever possible is important. 

If all of your users for this solution are going to be within 1 or a handful of countries then this is a good option to add an additional layer of security to your deployment.

This solution uses cloudfront to host the main website (when not set to private. Cloudfront gives you the ability to set a country allow list, by enabling this feature during the installer you will be presented a list of Country codes from the [ISO 3166-1-alpha-2](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_cloudfront.CfnDistribution.GeoRestrictionProperty.html#locations) set.

Once you have enabled this feature and selected the desired countries to be enabled CloudFront will restrict viewer access to that specified list.

## Limitations

- This solution relies on GEO IP databases provided by CloudFront, in rare circumstantces these can be incorrect. The [docs](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/georestrictions.html) indicate this is accurate 99.8% of the time.
- Despite this restriction being applied to CloudFront, an attacker could by pass CloudFront and still hit AppSync directly which this setting does not apply to.