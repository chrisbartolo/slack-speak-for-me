import crypto from 'crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt } from './encryption.js';

describe('encryption utilities', () => {
  let testKey: Buffer;

  beforeAll(() => {
    // Generate a test 32-byte key
    testKey = crypto.randomBytes(32);
  });

  describe('encrypt and decrypt', () => {
    it('should round-trip a simple token', () => {
      const original = 'xoxb-test-token-123456';
      const encrypted = encrypt(original, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(original);
    });

    it('should round-trip a long string', () => {
      const original = 'a'.repeat(1000);
      const encrypted = encrypt(original, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(original);
    });

    it('should round-trip special characters', () => {
      const original = 'Special chars: !@#$%^&*()';
      const encrypted = encrypt(original, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(original);
    });

    it('should round-trip unicode characters', () => {
      const original = 'Unicode test';
      const encrypted = encrypt(original, testKey);
      const decrypted = decrypt(encrypted, testKey);
      expect(decrypted).toBe(original);
    });

    it('should produce encrypted string in correct format (iv:authTag:ciphertext)', () => {
      const original = 'test-string';
      const encrypted = encrypt(original, testKey);
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
    });
  });

  describe('security', () => {
    it('should reject decryption with wrong key', () => {
      const encrypted = encrypt('test', testKey);
      const wrongKey = crypto.randomBytes(32);
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('should produce different ciphertext for same input (random IV)', () => {
      const original = 'same-input';
      const encrypted1 = encrypt(original, testKey);
      const encrypted2 = encrypt(original, testKey);
      expect(encrypted1).not.toBe(encrypted2);
    });
  });
});
