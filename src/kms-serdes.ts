import type { Serdes } from '@aws/durable-execution-sdk-js';
import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({});
const KMS_KEY_ID = process.env.KMS_KEY_ID;

// SerdesContext interface from the SDK (not exported in v1.0.1)
interface SerdesContext {
  entityId: string;
  durableExecutionArn: string;
}

export class KmsSerDes<T> implements Serdes<T> {
  async serialize(
    value: T | undefined,
    context: SerdesContext,
  ): Promise<string | undefined> {
    if (value === undefined) {
      return undefined;
    }

    if (!KMS_KEY_ID) {
      throw new Error('KMS_KEY_ID environment variable is not set');
    }

    const plaintext = JSON.stringify(value);
    const encoder = new TextEncoder();
    const plaintextBytes = encoder.encode(plaintext);

    const command = new EncryptCommand({
      KeyId: KMS_KEY_ID,
      Plaintext: plaintextBytes,
      EncryptionContext: {
        entityId: context.entityId,
        durableExecutionArn: context.durableExecutionArn,
      },
    });

    const response = await kmsClient.send(command);

    if (!response.CiphertextBlob) {
      throw new Error('Encryption failed: no ciphertext returned');
    }

    // Convert to base64 for storage
    return Buffer.from(response.CiphertextBlob).toString('base64');
  }

  async deserialize(
    encryptedData: string | undefined,
    context: SerdesContext,
  ): Promise<T | undefined> {
    if (encryptedData === undefined) {
      return undefined;
    }

    // Convert from base64
    const ciphertextBlob = Buffer.from(encryptedData, 'base64');

    const command = new DecryptCommand({
      CiphertextBlob: ciphertextBlob,
      EncryptionContext: {
        entityId: context.entityId,
        durableExecutionArn: context.durableExecutionArn,
      },
    });

    const response = await kmsClient.send(command);

    if (!response.Plaintext) {
      throw new Error('Decryption failed: no plaintext returned');
    }

    const decoder = new TextDecoder();
    const plaintext = decoder.decode(response.Plaintext);

    return JSON.parse(plaintext) as T;
  }
}
