import {
  type DurableContext,
  withDurableExecution,
} from '@aws/durable-execution-sdk-js';
import { KmsSerDes } from './kms-serdes';
import type { Order, OrderInput } from './types';

// Initialize a single KMS SerDer for all encryption
// biome-ignore lint/suspicious/noExplicitAny: Generic serdes needs to work with any type
const kmsSerDes = new KmsSerDes<any>();

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
    // Use KMS encryption for the order step
    const order = await context.step<Order>(
      'create-order',
      async () => {
        return createOrder(event);
      },
      {
        serdes: kmsSerDes,
      },
    );

    await context.wait({ seconds: 300 });    
    console.log("order", {order});

    // Use KMS encryption for the email step
    await context.step(
      'send-notification',
      async () => {
        return sendEmail(order.customerId, order.id);
      },
      {
        serdes: kmsSerDes,
      },
    );

    return { orderId: order.id, status: 'completed' };
  },
);
