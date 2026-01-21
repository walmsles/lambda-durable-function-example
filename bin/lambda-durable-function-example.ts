#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { LambdaDurableFunctionExampleStack } from '../lib/lambda-durable-function-example-stack';

const app = new cdk.App();
new LambdaDurableFunctionExampleStack(app, 'LambdaDurableFunctionExampleStack');
