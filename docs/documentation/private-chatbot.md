# Private Chatbot

Allows the deployment of a private chatbot via the 'npm run config' CLI setup.

- VPC only accessible website with an Application Load Balancer in front of an S3 hosted website.
- Private Appsync APIs and Web Sockets 
- VPC endpoints for AWS services
- Utilises a AWS Private CA certifice
- Utilises a Amazon Route 53 Private Hosted Zone and Domain


### Prerequisites: Private Chatbot Deployment  
1. [AWS Private CA issued ACM certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-private.html) for your chosen domain. (i.e. chatbot.example.org)
2. A Route 53 [Private Hosted Zone](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zones-private.html) (i.e. for example.org)

### During 'npm run config'
```shellsession
$ ✔ Do you want to deploy a private website? I.e only accessible in VPC (Y/n) · 
true
$ ✔ ACM certificate ARN · 
arn:aws:acm:us-east-1:1234567890:certificate/12345678-1234-1234-1234-12345678
$ ✔ Domain for private website · 
chatbot.example.org
```

### After Private Deployment: 
1. In Route 53 [link the created VPC to the Private Hosted Zone (PHZ)](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/hosted-zone-private-associate-vpcs.html)
2. In the PHZ, [add an "A Record"](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-elb-load-balancer.html) with your chosen subdomain (i.e. chatbot.example.org) that points to the website Application Load Balancer Alias.

### Limitations
Deploying a fully private chatbot requires extending the existing solution. Since the current setup uses **Cognito and AppSync**, both of which are publicly accessible, additional configuration is needed:  

- Authentication must be extended to integrate with your **private IdP**.  
- AppSync access must be configured using **AWS PrivateLink** for private connectivity.  

For more details, refer to these resources:  
- [AppSync Lambda Authorization](https://aws.amazon.com/blogs/mobile/appsync-lambda-auth/)  
- [Using Private APIs with AppSync](https://docs.aws.amazon.com/appsync/latest/devguide/using-private-apis.html)  
