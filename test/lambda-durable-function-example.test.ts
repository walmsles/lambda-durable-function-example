import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from 'aws-cdk-lib/core';
import * as LambdaDurableFunctionExample from '../lib/lambda-durable-function-example-stack';

test('SQS Queue and SNS Topic Created', () => {
  const app = new cdk.App();
  // WHEN
  const stack =
    new LambdaDurableFunctionExample.LambdaDurableFunctionExampleStack(
      app,
      'MyTestStack',
    );
  // THEN

  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::SQS::Queue', {
    VisibilityTimeout: 300,
  });
  template.resourceCountIs('AWS::SNS::Topic', 1);
});
