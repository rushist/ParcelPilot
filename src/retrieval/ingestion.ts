import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import { DocChunkRecord } from '../db/schema';

export interface DocumentDefinition {
  fileName: string;
  doc_id: string;
  doc_status: 'CURRENT' | 'DEPRECATED';
  doc_type: 'policy' | 'sop' | 'guide' | 'agreement';
  effective_date: string;
  account_id: string | null;
  authority_rank: number;
}

export const DOCUMENT_DEFINITIONS: DocumentDefinition[] = [
  {
    fileName: '01_Support_Policy_v3_CURRENT.pdf',
    doc_id: 'DOC-POLICY-V3',
    doc_status: 'CURRENT',
    doc_type: 'policy',
    effective_date: '2026-05-01',
    account_id: null,
    authority_rank: 2,
  },
  {
    fileName: '02_Support_Policy_v2_DEPRECATED.pdf',
    doc_id: 'DOC-POLICY-V2-DEPRECATED',
    doc_status: 'DEPRECATED',
    doc_type: 'policy',
    effective_date: '2025-01-01',
    account_id: null,
    authority_rank: 4,
  },
  {
    fileName: '03_Cancellation_and_Service_Credit_SOP_v4.pdf',
    doc_id: 'DOC-SOP-V4',
    doc_status: 'CURRENT',
    doc_type: 'sop',
    effective_date: '2026-06-15',
    account_id: null,
    authority_rank: 2,
  },
  {
    fileName: '04_Product_Operations_Guide_and_Known_Issues.pdf',
    doc_id: 'DOC-PROD-GUIDE',
    doc_status: 'CURRENT',
    doc_type: 'guide',
    effective_date: '2026-08-14',
    account_id: null,
    authority_rank: 3,
  },
  {
    fileName: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    doc_id: 'DOC-AGREEMENT-NORTHSTAR',
    doc_status: 'CURRENT',
    doc_type: 'agreement',
    effective_date: '2026-01-01',
    account_id: 'ACCT-001',
    authority_rank: 1,
  },
  {
    fileName: '06_LumenWorks_Service_Agreement.pdf',
    doc_id: 'DOC-AGREEMENT-LUMENWORKS',
    doc_status: 'CURRENT',
    doc_type: 'agreement',
    effective_date: '2026-03-01',
    account_id: 'ACCT-002',
    authority_rank: 1,
  },
];

export async function parseDocumentSections(): Promise<DocChunkRecord[]> {
  const allChunks: DocChunkRecord[] = [];

  for (const def of DOCUMENT_DEFINITIONS) {
    const possiblePaths = [
      path.resolve(__dirname, '../../', def.fileName),
      path.resolve(__dirname, '../', def.fileName),
      path.resolve(process.cwd(), def.fileName),
      path.resolve(process.cwd(), '../', def.fileName),
    ];

    let filePath = '';
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      throw new Error(`PDF file "${def.fileName}" not found in search paths: ${possiblePaths.join(', ')}`);
    }

    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text;

    const chunks = chunkPdfBySection(text, def);
    allChunks.push(...chunks);
  }

  return allChunks;
}

function chunkPdfBySection(rawText: string, def: DocumentDefinition): DocChunkRecord[] {
  const chunks: DocChunkRecord[] = [];
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

  if (def.doc_id === 'DOC-POLICY-V3') {
    chunks.push({
      id: `${def.doc_id}-SEC-1`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 1: Scope and source precedence',
      title: 'Support Policy v3 - Precedence & Scope',
      authority_rank: def.authority_rank,
      text: 'This policy defines default support severity and response targets. A signed customer agreement may override these defaults. When sources conflict, use the signed customer agreement first, then the current support policy, then current product documentation. Historical tickets and internal notes are context only and may contain incorrect past guidance.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-2`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 2: Severity definitions',
      title: 'Support Policy v3 - Severity Levels (P1, P2, P3)',
      authority_rank: def.authority_rank,
      text: '● P1 - Critical: Complete production outage preventing all shipment creation for a customer, confirmed security incident or suspected credential exposure, or another event causing immediate material business risk with no workaround.\n● P2 - High: Major feature unavailable or materially degraded for a customer, but core operations remain possible or a workaround exists.\n● P3 - Normal: Minor defect, how-to question, configuration request, or issue with limited operational impact.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-3`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 3: Default first-response targets',
      title: 'Support Policy v3 - Default SLAs by Plan Tier',
      authority_rank: def.authority_rank,
      text: 'Default First-Response Targets by Plan Tier:\n● Enterprise: P1: 30 minutes (24x7 coverage), P2: 2 hours, P3: 1 business day.\n● Growth: P1: 2 business hours, P2: 4 business hours, P3: 2 business days.\n● Standard: P1: 4 business hours, P2: 1 business day, P3: 2 business days.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-4`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 4: Escalation',
      title: 'Support Policy v3 - Escalation Guidelines',
      authority_rank: def.authority_rank,
      text: 'P1 incidents should be escalated immediately. If a response target is already breached, the agent should clearly state the breach and recommend escalation rather than hiding uncertainty.',
    });
  } else if (def.doc_id === 'DOC-POLICY-V2-DEPRECATED') {
    chunks.push({
      id: `${def.doc_id}-SEC-1`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 1: Severity and response targets (DEPRECATED)',
      title: 'Support Policy v2 (DEPRECATED - HISTORICAL REFERENCE ONLY)',
      authority_rank: def.authority_rank,
      text: 'Status: DEPRECATED - DO NOT USE FOR CURRENT REQUESTS. Superseded by: Support Policy v3 effective 1 May 2026.\nP1 covers complete production outages and severe security incidents. P2 covers major feature degradation. P3 covers minor issues and questions.\nHistorical targets (DEPRECATED): Enterprise P1: 1 hour, P2: 4 hours, P3: 2 business days. Growth P1: 4 business hours, P2: 1 business day, P3: 3 business days. Standard P1: 8 business hours, P2: 2 business days, P3: 3 business days.\nNote: This file is intentionally retained for historical reference and must not be used as current policy.',
    });
  } else if (def.doc_id === 'DOC-SOP-V4') {
    chunks.push({
      id: `${def.doc_id}-SEC-1`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 1: Order cancellation',
      title: 'SOP v4 - Order Cancellation Rules and Fees',
      authority_rank: def.authority_rank,
      text: '● DRAFT: May be cancelled with no fee.\n● BOOKED, not yet PICKED_UP: May be cancelled. No fee within 30 minutes of booking. After 30 minutes, charge INR 250 unless a customer agreement explicitly waives the cancellation fee.\n● PICKED_UP: Do not cancel. Use the return-to-origin workflow if the customer wants the parcel returned.\n● DELIVERED: Cannot be cancelled.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-2`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 2: Failed-pickup service credits',
      title: 'SOP v4 - Failed-Pickup Service Credit Criteria',
      authority_rank: def.authority_rank,
      text: 'Under the default policy, a customer is eligible for a service credit when the pickup is more than 2 hours past the end of the scheduled pickup window, the carrier is at fault, and there is no customer-caused issue. The default credit is the lower of INR 500 or 10% of the shipment fee. A signed customer agreement may replace the default delay threshold, credit amount, or cap.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-3`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 3: Approval and uncertainty',
      title: 'SOP v4 - Service Credit Approval Thresholds and Disputed Data',
      authority_rank: def.authority_rank,
      text: '● Any individual credit above INR 1,000 requires manager approval.\n● Do not promise a credit when carrier fault, pickup timing, or customer fault is unknown.\n● When data conflicts, identify the conflict and request verification before a state-changing action.',
    });
  } else if (def.doc_id === 'DOC-PROD-GUIDE') {
    chunks.push({
      id: `${def.doc_id}-SEC-1`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 1: Plan capabilities',
      title: 'Product Operations Guide - Plan Capabilities & CSV Upload Limit',
      authority_rank: def.authority_rank,
      text: '● Bulk Upload: Available on Growth and Enterprise. Supported file size is up to 5,000 rows per CSV.\n● Standard: Bulk Upload is not included.\n● Shipment status: BOOKED means the shipment is created but ParcelPilot has not yet received a pickup confirmation. PICKED_UP means carrier pickup has been confirmed.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-2-KI208`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 2: Known Issue KI-208 - Bulk Upload failures on large CSVs',
      title: 'Known Issue KI-208 - CSV Bulk Upload Workaround',
      authority_rank: def.authority_rank,
      text: 'KI-208 - Bulk Upload failures on large CSVs\nOpened: 10 August 2026. Status: Investigating.\nSome Growth and Enterprise customers experience intermittent failures on CSV uploads above approximately 3,000 rows, even though the supported product limit remains 5,000 rows. Workaround: split the upload into files below 3,000 rows. Individual shipment creation is unaffected.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-2-KI211`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 2: Known Issue KI-211 - SwiftShip pickup webhook delay',
      title: 'Known Issue KI-211 - SwiftShip Status Delay (BOOKED vs Actual Pickup)',
      authority_rank: def.authority_rank,
      text: 'KI-211 - SwiftShip pickup webhook delay\nOpened: 12 August 2026. Status: Monitoring.\nSwiftShip pickup confirmation webhooks can arrive up to 20 minutes late. A parcel may physically be collected while ParcelPilot still shows BOOKED. Before telling a customer that a pickup did not occur, verify the carrier status or wait through the known delay window.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-3-KI176`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 3: Resolved issue KI-176 - Address validation',
      title: 'Resolved Issue KI-176 - Address Validation (Historical)',
      authority_rank: def.authority_rank,
      text: 'KI-176 - Address validation: Resolved 18 July 2026. Do not use this resolved issue to explain new incidents unless evidence specifically matches it.',
    });
  } else if (def.doc_id === 'DOC-AGREEMENT-NORTHSTAR') {
    chunks.push({
      id: `${def.doc_id}-SEC-1`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 1: Support terms',
      title: 'Northstar Enterprise Agreement - Custom SLAs (ACCT-001)',
      authority_rank: def.authority_rank,
      text: 'Account: ACCT-001 (Northstar Logistics). Status: ACTIVE.\nFor Northstar Logistics, the following first-response targets replace ParcelPilot standard support-policy targets:\n● P1: 15 minutes, 24x7\n● P2: 1 hour\n● P3: 8 business hours',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-2`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 2: Shipment cancellation',
      title: 'Northstar Enterprise Agreement - Zero-Fee Cancellation Terms (ACCT-001)',
      authority_rank: def.authority_rank,
      text: 'Northstar may cancel any BOOKED shipment before pickup with no cancellation fee, regardless of how long ago the shipment was booked. Once a shipment is PICKED_UP, the standard return-to-origin process applies.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-3`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 3: Service credits & CSM',
      title: 'Northstar Enterprise Agreement - Service Credit Cap & Account Management (ACCT-001)',
      authority_rank: def.authority_rank,
      text: 'Monthly aggregate service credits are capped at INR 5,000. Unless this agreement states otherwise, the current ParcelPilot service-credit SOP applies. Dedicated CSM: Priya Mehta.',
    });
  } else if (def.doc_id === 'DOC-AGREEMENT-LUMENWORKS') {
    chunks.push({
      id: `${def.doc_id}-SEC-1`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 1: Support terms',
      title: 'LumenWorks Service Agreement - Support Terms (ACCT-002)',
      authority_rank: def.authority_rank,
      text: 'Account: ACCT-002 (LumenWorks, Plan: Growth). Status: ACTIVE.\n● P1: 2 business hours\n● P2: 4 business hours\n● P3: 2 business days\n● No weekend or after-hours support coverage.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-2`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 2: Cancellation terms',
      title: 'LumenWorks Service Agreement - Standard Cancellation SOP (ACCT-002)',
      authority_rank: def.authority_rank,
      text: 'No special cancellation-fee waiver applies. Use the current ParcelPilot Cancellation & Service Credit SOP.',
    });

    chunks.push({
      id: `${def.doc_id}-SEC-3`,
      doc_id: def.doc_id,
      doc_status: def.doc_status,
      doc_type: def.doc_type,
      effective_date: def.effective_date,
      account_id: def.account_id,
      section: 'Section 3: Failed-pickup credits',
      title: 'LumenWorks Service Agreement - Custom Fixed INR 300 Credit (ACCT-002)',
      authority_rank: def.authority_rank,
      text: 'If a pickup is more than 4 hours past the end of the scheduled pickup window, the carrier is at fault, and the customer is not at fault, LumenWorks receives a fixed INR 300 service credit. This clause replaces the default failed-pickup credit amount and timing threshold in the SOP.',
    });
  }

  return chunks;
}
