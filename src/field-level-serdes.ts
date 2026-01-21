import type { Serdes } from '@aws/durable-execution-sdk-js';
import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';

const kmsClient = new KMSClient({});
const KMS_KEY_ID = process.env.KMS_KEY_ID;

// SerdesContext interface from the SDK (not exported in v1.0.1)
interface SerdesContext {
  entityId: string;
  durableExecutionArn: string;
}

interface EncryptedPayload<T> {
  data: T;
  __encrypted_pii?: string;
  __encryption_context?: Record<string, string>;
}

/**
 * Field-level encryption SerDes that encrypts only specified fields
 * and leaves the rest of the data in plaintext for easier debugging
 */
export class FieldLevelKmsSerDes<T> implements Serdes<T> {
  private fieldPaths: string[];
  private encryptionContext: Record<string, string>;

  /**
   * @param fieldPaths - Array of dot-notation paths to fields that should be encrypted
   *                     e.g., ['customer.ssn', 'payment.creditCard']
   * @param encryptionContext - Additional KMS encryption context
   */
  constructor(
    fieldPaths: string[],
    encryptionContext: Record<string, string> = {},
  ) {
    this.fieldPaths = fieldPaths;
    this.encryptionContext = encryptionContext;
  }

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

    // Clone the object to avoid mutating the original
    const clonedValue = JSON.parse(JSON.stringify(value));

    // Extract sensitive fields
    const sensitiveData: Record<string, unknown> = {};
    for (const path of this.fieldPaths) {
      const fieldValue = this.getNestedValue(clonedValue, path);
      if (fieldValue !== undefined) {
        sensitiveData[path] = fieldValue;
        // Replace with marker
        this.setNestedValue(clonedValue, path, { __encrypted: path });
      }
    }

    // Encrypt the sensitive data if any fields were found
    let encryptedPii: string | undefined;
    if (Object.keys(sensitiveData).length > 0) {
      const plaintext = JSON.stringify(sensitiveData);
      const encoder = new TextEncoder();
      const plaintextBytes = encoder.encode(plaintext);

      const command = new EncryptCommand({
        KeyId: KMS_KEY_ID,
        Plaintext: plaintextBytes,
        EncryptionContext: {
          entityId: context.entityId,
          durableExecutionArn: context.durableExecutionArn,
          ...this.encryptionContext,
        },
      });

      const response = await kmsClient.send(command);

      if (!response.CiphertextBlob) {
        throw new Error('Encryption failed: no ciphertext returned');
      }

      encryptedPii = Buffer.from(response.CiphertextBlob).toString('base64');
    }

    // Build the final payload
    const payload: EncryptedPayload<unknown> = {
      ...clonedValue,
    };

    if (encryptedPii) {
      payload.__encrypted_pii = encryptedPii;
      payload.__encryption_context = {
        entityId: context.entityId,
        ...this.encryptionContext,
      };
    }

    return JSON.stringify(payload);
  }

  async deserialize(
    encryptedData: string | undefined,
    context: SerdesContext,
  ): Promise<T | undefined> {
    if (encryptedData === undefined) {
      return undefined;
    }

    const payload: EncryptedPayload<unknown> = JSON.parse(encryptedData);

    // If there's encrypted PII, decrypt it
    if (payload.__encrypted_pii) {
      const ciphertextBlob = Buffer.from(payload.__encrypted_pii, 'base64');

      const command = new DecryptCommand({
        CiphertextBlob: ciphertextBlob,
        EncryptionContext: {
          entityId: context.entityId,
          durableExecutionArn: context.durableExecutionArn,
          ...this.encryptionContext,
        },
      });

      const response = await kmsClient.send(command);

      if (!response.Plaintext) {
        throw new Error('Decryption failed: no plaintext returned');
      }

      const decoder = new TextDecoder();
      const plaintext = decoder.decode(response.Plaintext);
      const sensitiveData: Record<string, unknown> = JSON.parse(plaintext);

      // Restore the sensitive fields
      for (const [path, value] of Object.entries(sensitiveData)) {
        this.setNestedValue(payload, path, value);
      }

      // Remove the encryption metadata
      delete payload.__encrypted_pii;
      delete payload.__encryption_context;
    }

    return payload as T;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private setNestedValue(obj: unknown, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
}
