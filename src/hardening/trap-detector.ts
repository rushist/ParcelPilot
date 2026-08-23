import { SessionContext } from '../types';
import { isCustomerSession, isInternalSession } from '../access/sessions';

export type TrapType =
  | 'PROMPT_INJECTION'
  | 'CROSS_TENANT_LEAK'
  | 'AMBIGUOUS_QUERY'
  | 'HISTORICAL_ERROR'
  | 'DEPRECATED_POLICY'
  | 'DISPUTED_DELIVERY'
  | 'HIGH_VALUE_ACTION'
  | 'SECURITY_CREDENTIAL_EXPOSURE'
  | 'SOURCE_PRECEDENCE_CONFLICT';

export interface DetectedTrap {
  type: TrapType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  mitigation: string;
  metadata?: Record<string, any>;
}

export interface TrapScanResult {
  detected: boolean;
  shouldBlock: boolean;
  blockReason?: string;
  traps: DetectedTrap[];
  sanitizedInput?: string;
}

// Patterns commonly used in prompt injections and jailbreaks
const INJECTION_PATTERNS: { regex: RegExp; name: string; severity: 'HIGH' | 'CRITICAL' }[] = [
  { regex: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i, name: 'IGNORE_PREVIOUS_INSTRUCTIONS', severity: 'CRITICAL' },
  { regex: /disregard\s+(all\s+)?(previous|prior|system|policy)\s+(instructions|rules|guidelines)/i, name: 'DISREGARD_SYSTEM_RULES', severity: 'CRITICAL' },
  { regex: /system\s+override\s*:/i, name: 'SYSTEM_OVERRIDE_DIRECTIVE', severity: 'CRITICAL' },
  { regex: /(show|output|print|display|reveal)\s+(your\s+)?(system\s+prompt|developer\s+mode|instructions|hidden\s+prompt)/i, name: 'SYSTEM_PROMPT_EXTRACTION', severity: 'HIGH' },
  { regex: /you\s+are\s+now\s+in\s+(developer|unrestricted|god|dan|jailbroken)\s+mode/i, name: 'JAILBREAK_MODE_SWITCH', severity: 'CRITICAL' },
  { regex: /grant\s+(me\s+)?(a\s+)?(full\s+refund|unlimited\s+credit|admin\s+access)\s+(without|bypassing|ignoring)\s+(check|policy|approval)/i, name: 'POLICY_BYPASS_ATTEMPT', severity: 'CRITICAL' },
  { regex: /pretend\s+you\s+are\s+not\s+bound\s+by\s+(any\s+)?rules/i, name: 'ROLEPLAY_RULE_EVASION', severity: 'CRITICAL' },
];

// Patterns for detecting sensitive credentials or keys
const CREDENTIAL_PATTERNS: { regex: RegExp; type: string }[] = [
  { regex: /(sk_live_[0-9a-zA-Z]{24,})/i, type: 'STRIPE_LIVE_KEY' },
  { regex: /(AKIA[0-9A-Z]{16})/i, type: 'AWS_ACCESS_KEY' },
  { regex: /(ghp_[0-9a-zA-Z]{36})/i, type: 'GITHUB_PERSONAL_TOKEN' },
  { regex: /bearer\s+([a-zA-Z0-9_\-\.]{20,})/i, type: 'BEARER_TOKEN' },
  { regex: /(api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}['"]?)/i, type: 'GENERIC_API_KEY' },
  { regex: /(password\s*[:=]\s*['"]?[^\s'"]{6,}['"]?)/i, type: 'PLAINTEXT_PASSWORD' },
  { regex: /(postgres:\/\/[^\s]+)/i, type: 'DATABASE_CONNECTION_URI' },
];

/**
 * 1. Prompt Injection Scanner
 */
export function detectPromptInjection(text: string): { isInjection: boolean; pattern?: string; confidence: number } {
  for (const item of INJECTION_PATTERNS) {
    if (item.regex.test(text)) {
      return { isInjection: true, pattern: item.name, confidence: 0.95 };
    }
  }
  return { isInjection: false, confidence: 0.0 };
}

/**
 * 2. Multi-Tenant Leak Scanner
 */
export function detectCrossTenantAttempt(
  session: SessionContext,
  query: string
): { isCrossTenant: boolean; unauthorizedAccountId?: string; reason?: string } {
  if (!isCustomerSession(session)) {
    return { isCrossTenant: false };
  }

  const authenticatedAccountId = session.account_id;

  // Extract any account ID mentioned in the query
  const accountMatches = query.match(/ACCT-\d+/gi);
  if (accountMatches) {
    for (const match of accountMatches) {
      const normalized = match.toUpperCase();
      if (normalized !== authenticatedAccountId.toUpperCase()) {
        return {
          isCrossTenant: true,
          unauthorizedAccountId: normalized,
          reason: `Customer ${authenticatedAccountId} attempted to query foreign tenant ${normalized}.`,
        };
      }
    }
  }

  return { isCrossTenant: false };
}

/**
 * 3. Ambiguity & Missing Entity Scanner
 */
export function detectAmbiguousActionQuery(
  query: string
): { isAmbiguous: boolean; actionType?: string; missingEntity?: string; prompt?: string } {
  const lower = query.toLowerCase();

  const isActionIntent =
    lower.includes('cancel') ||
    lower.includes('credit') ||
    lower.includes('refund') ||
    lower.includes('escalate');

  const hasOrderId = /ORD-\d+/i.test(query);
  const hasTicketId = /TKT-\d+/i.test(query);

  if (isActionIntent && !hasOrderId && !hasTicketId) {
    if (lower.includes('cancel')) {
      return {
        isAmbiguous: true,
        actionType: 'cancellation',
        missingEntity: 'order_id',
        prompt: 'Please provide the specific Order ID (e.g., ORD-1001) you would like to cancel.',
      };
    }
    if (lower.includes('credit') || lower.includes('refund')) {
      return {
        isAmbiguous: true,
        actionType: 'service_credit',
        missingEntity: 'order_id',
        prompt: 'Please specify the Order ID (e.g., ORD-1001) associated with your service credit request.',
      };
    }
  }

  return { isAmbiguous: false };
}

/**
 * 4. Credential & Secret Exposure Scanner
 */
export function detectCredentialExposure(text: string): {
  hasCredentials: boolean;
  credentialTypes: string[];
  sanitizedText: string;
} {
  let sanitized = text;
  const detectedTypes: string[] = [];

  for (const item of CREDENTIAL_PATTERNS) {
    if (item.regex.test(sanitized)) {
      detectedTypes.push(item.type);
      sanitized = sanitized.replace(item.regex, '[REDACTED_SECRET]');
    }
  }

  return {
    hasCredentials: detectedTypes.length > 0,
    credentialTypes: detectedTypes,
    sanitizedText: sanitized,
  };
}

/**
 * 5. Pre-Response Secret Output Scrubber
 */
export function scrubOutputSecrets(text: string): string {
  let scrubbed = text;
  for (const item of CREDENTIAL_PATTERNS) {
    scrubbed = scrubbed.replace(item.regex, '[CONFIDENTIAL]');
  }
  // Strip any accidental system prompt tag leakage
  scrubbed = scrubbed.replace(/<system_prompt>[\s\S]*?<\/system_prompt>/gi, '');
  return scrubbed;
}

/**
 * 6. Document Authority Precedence Evaluator (Rule 9)
 */
export function enforceAuthorityPrecedence(retrievedDocs: any[]): {
  governingDoc: any | null;
  hasCustomOverride: boolean;
  conflictResolved: boolean;
} {
  if (!retrievedDocs || retrievedDocs.length === 0) {
    return { governingDoc: null, hasCustomOverride: false, conflictResolved: false };
  }

  // Sort by authority_rank ascending (Rank 1: Agreement > Rank 2: SOP/Policy > Rank 3: User Guide)
  const sorted = [...retrievedDocs].sort((a, b) => (a.authority_rank || 3) - (b.authority_rank || 3));
  const topDoc = sorted[0];

  const hasAgreement = sorted.some((d) => d.authority_rank === 1);
  const hasSop = sorted.some((d) => d.authority_rank === 2);

  return {
    governingDoc: topDoc,
    hasCustomOverride: hasAgreement,
    conflictResolved: hasAgreement && hasSop,
  };
}

/**
 * Unified Trap & Trust Scanner
 */
export function scanSessionAndInput(
  session: SessionContext,
  inputMessage: string
): TrapScanResult {
  const traps: DetectedTrap[] = [];
  let shouldBlock = false;
  let blockReason: string | undefined;

  // Check 1: Prompt Injection
  const injection = detectPromptInjection(inputMessage);
  if (injection.isInjection) {
    traps.push({
      type: 'PROMPT_INJECTION',
      severity: 'CRITICAL',
      description: `Detected prompt injection / instruction override pattern: ${injection.pattern}`,
      mitigation: 'Instruction override neutralized. Enforcing strict system policy.',
      metadata: { pattern: injection.pattern },
    });
    shouldBlock = true;
    blockReason = 'Input violated safety guardrails. System policies and tenant boundaries cannot be overridden.';
  }

  // Check 2: Cross-Tenant Multi-Tenant Isolation
  const crossTenant = detectCrossTenantAttempt(session, inputMessage);
  if (crossTenant.isCrossTenant) {
    traps.push({
      type: 'CROSS_TENANT_LEAK',
      severity: 'CRITICAL',
      description: crossTenant.reason || 'Attempted cross-tenant access.',
      mitigation: 'Strict single-tenant boundary enforced. Access to foreign account denied.',
      metadata: { target_account: crossTenant.unauthorizedAccountId },
    });
    shouldBlock = true;
    blockReason = `Unauthorized: You are only authorized to access data for your account (${(session as any).account_id}). Access to ${crossTenant.unauthorizedAccountId} is strictly prohibited.`;
  }

  // Check 3: Credential Exposure
  const creds = detectCredentialExposure(inputMessage);
  if (creds.hasCredentials) {
    traps.push({
      type: 'SECURITY_CREDENTIAL_EXPOSURE',
      severity: 'CRITICAL',
      description: `Detected plaintext secret exposure in input: ${creds.credentialTypes.join(', ')}`,
      mitigation: 'Redacting sensitive credentials and triaging ticket as P1 Critical under Rule 15.',
      metadata: { types: creds.credentialTypes },
    });
  }

  // Check 4: Ambiguous Action Query
  const ambiguity = detectAmbiguousActionQuery(inputMessage);
  if (ambiguity.isAmbiguous) {
    traps.push({
      type: 'AMBIGUOUS_QUERY',
      severity: 'LOW',
      description: `Action intent without specific target ID: ${ambiguity.actionType}`,
      mitigation: 'Asking user for clarifying entity identifier before proposing state mutation.',
      metadata: { missingEntity: ambiguity.missingEntity },
    });
  }

  return {
    detected: traps.length > 0,
    shouldBlock,
    blockReason,
    traps,
    sanitizedInput: creds.sanitizedText,
  };
}
