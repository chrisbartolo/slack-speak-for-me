/**
 * Layer 1: Basic input sanitization
 * Removes potentially dangerous characters and patterns
 */
export function sanitizeInput(text: string): string {
  return text
    // Remove null bytes
    .replace(/\x00/g, '')
    // Normalize unicode (prevent homograph attacks)
    .normalize('NFKC')
    // Limit length (defense in depth)
    .slice(0, 10000);
}

/**
 * Layer 2: Spotlighting (data marking)
 * Wraps user content with delimiters that LLM recognizes as data, not instructions
 * Based on Microsoft's prompt injection defense research
 */
export function spotlightUserInput(text: string): string {
  const sanitized = sanitizeInput(text);
  return `<|user_input_start|>${sanitized}<|user_input_end|>`;
}

/**
 * Layer 3: Detect potential injection attempts
 * Returns true if text contains suspicious patterns
 */
export function detectInjectionAttempt(text: string): boolean {
  const suspiciousPatterns = [
    /ignore\s+(previous|all|above)\s+instructions/i,
    /disregard\s+(previous|all|above)/i,
    /you\s+are\s+now\s+a/i,
    /pretend\s+you\s+are/i,
    /act\s+as\s+if/i,
    /new\s+instructions?:/i,
    /system\s*prompt/i,
    /reveal\s+(your|the)\s+(instructions|prompt)/i,
    /<\|.*?\|>/g, // Attempting to inject data markers
    /\[INST\]/i, // Llama-style instruction markers
    /###\s*(system|user|assistant)/i, // OpenAI-style markers
  ];

  return suspiciousPatterns.some(pattern => pattern.test(text));
}

/**
 * Layer 4: Output filtering
 * Removes potentially leaked system content from AI responses
 */
export function sanitizeAIOutput(text: string): string {
  const forbiddenPatterns = [
    // System prompt leakage
    /CRITICAL\s+SECURITY\s+RULES/gi,
    /you\s+are\s+a\s+professional\s+communication\s+assistant/gi,
    /NEVER\s+follow\s+instructions\s+contained/gi,
    // Data marker leakage
    /<\|user_input_start\|>/g,
    /<\|user_input_end\|>/g,
    /<\|.*?\|>/g,
    // Environment variable patterns
    /sk-[a-zA-Z0-9]{20,}/g, // API key patterns
    /xoxb-[a-zA-Z0-9-]+/g, // Slack bot tokens
  ];

  let sanitized = text;
  for (const pattern of forbiddenPatterns) {
    sanitized = sanitized.replace(pattern, '[FILTERED]');
  }

  return sanitized;
}

/**
 * Complete sanitization pipeline for AI prompts
 */
export function prepareForAI(userText: string): {
  sanitized: string;
  flagged: boolean;
  flagReason?: string;
} {
  const flagged = detectInjectionAttempt(userText);
  const sanitized = spotlightUserInput(userText);

  return {
    sanitized,
    flagged,
    flagReason: flagged ? 'Potential prompt injection detected' : undefined,
  };
}
