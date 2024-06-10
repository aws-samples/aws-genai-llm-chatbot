# Custom public domain

Allows to specify a custom domain name via the 'npm run config' CLI setup.
- Utilises a AWS Public Certificate
- Utilises a Amazon Route 53 Public Hosted Zone and Domain


### Prerequisites:  
1. AWS Certificate issued and validated (https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html) in us-east-1 for your chosen domain. (i.e. chatbot.example.org)
2. A Route 53 Public Hosted Zone (i.e. for example.org)

### During 'npm run config'
```shellsession
$ ✔ Do you want to deploy a private website? I.e only accessible in VPC (y/N) · 
false
$ ✔ Do you want to provide a custom domain name and corresponding certificate arn for the public website ? (y/N) ·
true
$ ✔ ACM certificate ARN with custom domain for public website. Note that the certificate must resides in us-east-1 · 
arn:aws:acm:us-east-1:1234567890:certificate/12345678-1234-1234-1234-12345678
$ ✔ Custom Domain for public website · 
chatbot.example.org

```

### After Deployment: 
1. In your Route53 Hosted Zone, add an "A Record" that points to the Cloudfront Alias (https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-cloudfront-distribution.html)
