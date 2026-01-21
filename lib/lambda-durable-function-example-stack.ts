import * as path from 'node:path';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import { Duration, Stack, type StackProps } from 'aws-cdk-lib/core';
import type { Construct } from 'constructs';

export class LambdaDurableFunctionExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create KMS key for encryption
    const encryptionKey = new kms.Key(this, 'WorkflowEncryptionKey', {
      description: 'KMS key for durable function workflow encryption',
      enableKeyRotation: true,
    });

    // No encryption workflow (default JSON serialization)
    const noEncryptionFunction = new nodejs.NodejsFunction(
      this,
      'NoEncryptionFunction',
      {
        entry: path.join(__dirname, '../src/no-encryption-workflow.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: Duration.minutes(15),
        memorySize: 1024,
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          KMS_KEY_ID: encryptionKey.keyId,
          KMS_KEY_ARN: encryptionKey.keyArn,
        },
        durableConfig: {
          executionTimeout: Duration.minutes(15),
          retentionPeriod: Duration.days(1),
        },
      },
    );

    // Full object encryption workflow (KMS)
    const fullEncryptionFunction = new nodejs.NodejsFunction(
      this,
      'FullEncryptionFunction',
      {
        entry: path.join(__dirname, '../src/full-encryption-workflow.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: Duration.minutes(15),
        memorySize: 1024,
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          KMS_KEY_ID: encryptionKey.keyId,
          KMS_KEY_ARN: encryptionKey.keyArn,
        },
        durableConfig: {
          executionTimeout: Duration.minutes(15),
          retentionPeriod: Duration.days(1),
        },
      },
    );

    // Field-level encryption workflow (direct KMS)
    const encryptedWorkflowFunction = new nodejs.NodejsFunction(
      this,
      'EncryptedWorkflowFunction',
      {
        entry: path.join(__dirname, '../src/encrypted-workflow.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: Duration.minutes(15),
        memorySize: 1024,
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          KMS_KEY_ID: encryptionKey.keyId,
          KMS_KEY_ARN: encryptionKey.keyArn,
        },
        durableConfig: {
          executionTimeout: Duration.minutes(15),
          retentionPeriod: Duration.days(1),
        },
      },
    );

    // Envelope encryption workflow (AWS Encryption SDK)
    const envelopeWorkflowFunction = new nodejs.NodejsFunction(
      this,
      'EnvelopeWorkflowFunction',
      {
        entry: path.join(__dirname, '../src/envelope-encrypted-workflow.ts'),
        handler: 'handler',
        runtime: lambda.Runtime.NODEJS_22_X,
        timeout: Duration.minutes(15),
        memorySize: 1024,
        environment: {
          NODE_OPTIONS: '--enable-source-maps',
          KMS_KEY_ID: encryptionKey.keyId,
          KMS_KEY_ARN: encryptionKey.keyArn,
        },
        durableConfig: {
          executionTimeout: Duration.minutes(15),
          retentionPeriod: Duration.days(1),
        },
      },
    );

    // Grant the Lambda functions encrypt and decrypt permissions
    encryptionKey.grantEncryptDecrypt(fullEncryptionFunction);
    encryptionKey.grantEncryptDecrypt(encryptedWorkflowFunction);
    encryptionKey.grantEncryptDecrypt(envelopeWorkflowFunction);
  }
}
