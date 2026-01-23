# Lambda Durable Function Encryption

<a href="https://serverlessdna.com/strands/lambda/durable-function-encryption">
<img src="https://serverlessdna.com/strands/lambda/durable-function-encryption/hero-image.png" alt="Serverless DNA" width="350">
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
cdk deploy
```

## Environment Variables

- `KMS_KEY_ID` - KMS Key ID for direct KMS encryption
- `KMS_KEY_ARN` - KMS Key ARN for envelope encryption
