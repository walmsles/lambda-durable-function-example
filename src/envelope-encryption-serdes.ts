import type { Serdes } from '@aws/durable-execution-sdk-js';
import {
  buildClient,
  CommitmentPolicy,
  KmsKeyringNode,
} from '@aws-crypto/client-node';

const KMS_KEY_ARN = process.env.KMS_KEY_ARN;

// SerdesContext interface from the SDK (not exported in v1.0.1)
interface SerdesContext {
  entityId: string;
  durableExecutionArn: string;
}

interface EncryptedPayload<T> {
  data: T;
  __encrypted_pii?: string;
}

/**
 * Field-level encryption SerDes using AWS Encryption SDK with envelope encryption
 * This provides better performance for large payloads by using data keys
 */
export class EnvelopeEncryptionSerDes<T> implements Serdes<T> {
  private fieldPaths: string[];
  private encryptionContext: Record<string, string>;
  private client: ReturnType<typeof buildClient>;
  private keyring: KmsKeyringNode | null = null;

  /**
   * @param fieldPaths - Array of dot-notation paths to fields that should be encrypted
   *                     e.g., ['customer.ssn', 'payment.creditCard']
   * @param encryptionContext - Additional encryption context
   */
  constructor(
    fieldPaths: string[],
    encryptionContext: Record<string, string> = {},
  ) {
    this.fieldPaths = fieldPaths;
    this.encryptionContext = encryptionContext;

    // Build the encryption client with commitment policy
    this.client = buildClient(CommitmentPolicy.REQUIRE_ENCRYPT_REQUIRE_DECRYPT);
  }

  private getKeyring(): KmsKeyringNode {
    if (!this.keyring) {
      if (!KMS_KEY_ARN) {
        throw new Error('KMS_KEY_ARN environment variable is not set');
      }

      // Create KMS keyring for envelope encryption
      this.keyring = new KmsKeyringNode({
        generatorKeyId: KMS_KEY_ARN,
      });
    }
    return this.keyring;
  }

  async serialize(
    value: T | undefined,
    context: SerdesContext,
  ): Promise<string | undefined> {
    if (value === undefined) {
      return undefined;
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

      // Build encryption context
      const fullContext = {
        entityId: context.entityId,
        durableExecutionArn: context.durableExecutionArn,
        ...this.encryptionContext,
      };

      // Encrypt using AWS Encryption SDK (envelope encryption)
      const { result } = await this.client.encrypt(
        this.getKeyring(),
        plaintext,
        {
          encryptionContext: fullContext,
        },
      );

      // Convert to base64 for storage
      encryptedPii = Buffer.from(result).toString('base64');
    }

    // Build the final payload
    const payload: EncryptedPayload<unknown> = {
      ...clonedValue,
    };

    if (encryptedPii) {
      payload.__encrypted_pii = encryptedPii;
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
      const ciphertext = Buffer.from(payload.__encrypted_pii, 'base64');

      // Decrypt using AWS Encryption SDK
      const { plaintext, messageHeader } = await this.client.decrypt(
        this.getKeyring(),
        ciphertext,
      );

      // Verify encryption context matches
      const expectedContext = {
        entityId: context.entityId,
        durableExecutionArn: context.durableExecutionArn,
        ...this.encryptionContext,
      };

      for (const [key, value] of Object.entries(expectedContext)) {
        if (messageHeader.encryptionContext[key] !== value) {
          throw new Error(
            `Encryption context mismatch for key ${key}: expected ${value}, got ${messageHeader.encryptionContext[key]}`,
          );
        }
      }

      const plaintextString = plaintext.toString('utf8');
      const sensitiveData: Record<string, unknown> =
        JSON.parse(plaintextString);

      // Restore the sensitive fields
      for (const [path, value] of Object.entries(sensitiveData)) {
        this.setNestedValue(payload, path, value);
      }

      // Remove the encryption metadata
      delete payload.__encrypted_pii;
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
