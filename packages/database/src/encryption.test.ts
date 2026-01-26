import crypto from 'crypto';
import { encrypt, decrypt } from './encryption.js';

// Generate a test 32-byte key
const testKey = crypto.randomBytes(32);

// Test data
const testStrings = [
  'xoxb-test-token-123456',
  'a'.repeat(1000), // Long string
  'Special chars: !@#$%^&*()',
  '🔐 Unicode test',
];

console.log('Testing encryption utilities...\n');

let allPassed = true;

for (const original of testStrings) {
  try {
    // Encrypt
    const encrypted = encrypt(original, testKey);

    // Verify format (iv:authTag:ciphertext)
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      console.error(`❌ Invalid format for: ${original.substring(0, 20)}...`);
      allPassed = false;
      continue;
    }

    // Decrypt
    const decrypted = decrypt(encrypted, testKey);

    // Verify
    if (decrypted === original) {
      console.log(`✓ Round-trip successful: ${original.substring(0, 30)}...`);
    } else {
      console.error(`❌ Round-trip failed for: ${original.substring(0, 20)}...`);
      console.error(`   Expected: ${original}`);
      console.error(`   Got: ${decrypted}`);
      allPassed = false;
    }
  } catch (error) {
    console.error(`❌ Error processing: ${original.substring(0, 20)}...`);
    console.error(`   ${error}`);
    allPassed = false;
  }
}

// Test with wrong key
console.log('\nTesting wrong key (should fail):');
try {
  const encrypted = encrypt('test', testKey);
  const wrongKey = crypto.randomBytes(32);
  decrypt(encrypted, wrongKey);
  console.error('❌ Should have thrown error with wrong key');
  allPassed = false;
} catch (error) {
  console.log('✓ Correctly rejected wrong key');
}

console.log('\n' + (allPassed ? '✅ All tests passed' : '❌ Some tests failed'));
process.exit(allPassed ? 0 : 1);
