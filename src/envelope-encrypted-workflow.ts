import {
  type DurableContext,
  withDurableExecution,
} from '@aws/durable-execution-sdk-js';
import { EnvelopeEncryptionSerDes } from './envelope-encryption-serdes';
import type { Order, OrderInput } from './types';

// Create dedicated SerDes using AWS Encryption SDK with envelope encryption
const orderSerDes = new EnvelopeEncryptionSerDes<Order>(
  ['customer.ssn', 'payment.creditCard'],
  {
    service: 'order-processing',
    environment: 'production',
  },
);

// biome-ignore lint/suspicious/noExplicitAny: Generic serdes needs to work with any type
const emailSerDes = new EnvelopeEncryptionSerDes<any>([], {
  service: 'email-notification',
  environment: 'production',
});

async function randomPause(maxSeconds: number) {
  const sleepTime = Math.floor(Math.random() * maxSeconds * 1000);
  await new Promise((resolve) => setTimeout(resolve, sleepTime));
  return sleepTime;
}

// Mock createOrder function for workflow experiment
async function createOrder(orderInput: OrderInput): Promise<Order> {
  const sleepTime = await randomPause(2); // 0-2 seconds

  const orderId = `order-${Date.now()}`;
  console.log(`Order created: ${orderId} after ${sleepTime}ms`);

  return {
    id: orderId,
    customerId: orderInput.customer.customer_id,
    customer: orderInput.customer,
    payment: orderInput.payment,
    items: orderInput.items,
    createdAt: new Date().toISOString(),
  };
}

// Mock sendEmail function
async function sendEmail(customerId: string, orderId: string) {
  const sleepTime = await randomPause(3); // 0-3 seconds

  console.log(
    `Email sent to ${customerId} for order ${orderId} after ${sleepTime}ms`,
  );

  return {
    emailId: `email-${Date.now()}`,
    recipient: customerId,
    subject: `Order Confirmation: ${orderId}`,
    sentAt: new Date().toISOString(),
  };
}

export const handler = withDurableExecution(
  async (event: OrderInput, context: DurableContext) => {
    // Use envelope encryption (AWS Encryption SDK) for the order step
    // Only customer.ssn and payment.creditCard will be encrypted
    const order = await context.step<Order>(
      'create-order',
      async () => {
        return createOrder(event);
      },
      {
        serdes: orderSerDes,
      },
    );

    await context.wait({ seconds: 300 });
    console.log("order", {order});


    // Use envelope encryption for the email step
    await context.step(
      'send-notification',
      async () => {
        return sendEmail(order.customerId, order.id);
      },
      {
        serdes: emailSerDes,
      },
    );

    return { orderId: order.id, status: 'completed' };
  },
);
