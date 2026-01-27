# Lambda Durable Function Encryption

<a href="https://serverlessdna.com/strands/lambda/durable-function-encryption">
<img src="https://serverlessdna.com/_next/image?url=%2Fstrands%2Flambda%2Fdurable-function-encryption%2Fhero-image.webp&w=640&q=75" alt="Serverless DNA" width="350">
</a>

This repository contains example implementations of custom SerDes (Serializer/Deserializer) classes for encrypting checkpoint data in AWS Lambda Durable Functions.

📖 **Read the full article:** [Lambda Durable Functions - Keeping your Payloads Secure](https://serverlessdna.com/strands/lambda/durable-function-encryption)

## Overview

Lambda Durable Functions automatically checkpoint your workflow state, but that data may contain sensitive information like credit card numbers or SSNs. This repo demonstrates three encryption approaches:

- **KmsSerDes** - Full payload encryption using KMS directly
- **FieldLevelKmsSerDes** - Selective field encryption with KMS (encrypts only specified fields)
- **EnvelopeEncryptionSerDes** - Field-level encryption using AWS Encryption SDK with envelope encryption

## Deployment

```bash
npm install
npm run deploy
```

Deployment assumes you are already using AWS CDK for your account and you have the AWS Cli installed with working credentials.  If you have not used CDK before you will need to bootstrap your account.  CDK Docs for doing this can be found [here](https://docs.aws.amazon.com/cdk/v2/guide/bootstrapping.html).
