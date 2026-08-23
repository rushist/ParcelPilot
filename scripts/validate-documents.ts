import fs from 'fs';
import path from 'path';
import { ChunkWithEmbedding } from './ingest-documents';

export interface DocValidationReport {
  isValid: boolean;
  errors: string[];
  docCount: number;
  chunkCount: number;
  deprecatedChunks: number;
  currentChunks: number;
  accountScopedChunks: number;
  documents: {
    doc_id: string;
    doc_status: string;
    account_id: string | null;
    sections: string[];
  }[];
}

export function validateDocuments(): DocValidationReport {
  const errors: string[] = [];
  const jsonPath = path.join(__dirname, '../src/data/doc-chunks.json');

  if (!fs.existsSync(jsonPath)) {
    return {
      isValid: false,
      errors: ['doc-chunks.json does not exist. Run npm run ingest:docs first.'],
      docCount: 0,
      chunkCount: 0,
      deprecatedChunks: 0,
      currentChunks: 0,
      accountScopedChunks: 0,
      documents: [],
    };
  }

  const chunks: ChunkWithEmbedding[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const expectedDocs = [
    'DOC-POLICY-V3',
    'DOC-POLICY-V2-DEPRECATED',
    'DOC-SOP-V4',
    'DOC-PROD-GUIDE',
    'DOC-AGREEMENT-NORTHSTAR',
    'DOC-AGREEMENT-LUMENWORKS',
  ];

  const docMap = new Map<string, { doc_status: string; account_id: string | null; sections: string[] }>();

  for (const chunk of chunks) {
    if (!chunk.id) errors.push(`Chunk missing id`);
    if (!chunk.text || chunk.text.length < 20) errors.push(`Chunk ${chunk.id} has invalid or short text`);
    if (!chunk.embedding || chunk.embedding.length !== 1536) {
      errors.push(`Chunk ${chunk.id} has invalid embedding dimensions: ${chunk.embedding?.length}`);
    }

    if (!docMap.has(chunk.doc_id)) {
      docMap.set(chunk.doc_id, {
        doc_status: chunk.doc_status,
        account_id: chunk.account_id,
        sections: [],
      });
    }
    docMap.get(chunk.doc_id)!.sections.push(chunk.section);

    // Verify Deprecated document status
    if (chunk.doc_id === 'DOC-POLICY-V2-DEPRECATED' && chunk.doc_status !== 'DEPRECATED') {
      errors.push(`DOC-POLICY-V2-DEPRECATED must be marked DEPRECATED, got ${chunk.doc_status}`);
    }

    // Verify Current document status
    if (chunk.doc_id !== 'DOC-POLICY-V2-DEPRECATED' && chunk.doc_status !== 'CURRENT') {
      errors.push(`${chunk.doc_id} must be marked CURRENT, got ${chunk.doc_status}`);
    }

    // Verify Agreement account scoping
    if (chunk.doc_id === 'DOC-AGREEMENT-NORTHSTAR' && chunk.account_id !== 'ACCT-001') {
      errors.push(`Northstar agreement must be scoped to ACCT-001, got ${chunk.account_id}`);
    }
    if (chunk.doc_id === 'DOC-AGREEMENT-LUMENWORKS' && chunk.account_id !== 'ACCT-002') {
      errors.push(`LumenWorks agreement must be scoped to ACCT-002, got ${chunk.account_id}`);
    }
    if (
      ['DOC-POLICY-V3', 'DOC-POLICY-V2-DEPRECATED', 'DOC-SOP-V4', 'DOC-PROD-GUIDE'].includes(chunk.doc_id) &&
      chunk.account_id !== null
    ) {
      errors.push(`General document ${chunk.doc_id} must have null account_id, got ${chunk.account_id}`);
    }
  }

  for (const expected of expectedDocs) {
    if (!docMap.has(expected)) {
      errors.push(`Expected document ${expected} was not ingested.`);
    }
  }

  const docList = Array.from(docMap.entries()).map(([doc_id, info]) => ({
    doc_id,
    ...info,
  }));

  const deprecatedChunks = chunks.filter((c) => c.doc_status === 'DEPRECATED').length;
  const currentChunks = chunks.filter((c) => c.doc_status === 'CURRENT').length;
  const accountScopedChunks = chunks.filter((c) => c.account_id !== null).length;

  return {
    isValid: errors.length === 0,
    errors,
    docCount: docMap.size,
    chunkCount: chunks.length,
    deprecatedChunks,
    currentChunks,
    accountScopedChunks,
    documents: docList,
  };
}

export function runDocValidation() {
  console.log('=== Running Document Ingestion Validation ===\n');
  const report = validateDocuments();

  console.log(`- Total Documents Ingested: ${report.docCount} / 6`);
  console.log(`- Total Section Chunks:     ${report.chunkCount}`);
  console.log(`  - Current Chunks:         ${report.currentChunks}`);
  console.log(`  - Deprecated Chunks:      ${report.deprecatedChunks}`);
  console.log(`  - Account Scoped Chunks:  ${report.accountScopedChunks}`);

  console.log('\nIngested Documents & Sections:');
  for (const doc of report.documents) {
    console.log(`• [${doc.doc_status}] ${doc.doc_id} (Scope: ${doc.account_id || 'General'})`);
    for (const sec of doc.sections) {
      console.log(`    └─ ${sec}`);
    }
  }

  if (report.isValid) {
    console.log('\n✔ All 6 documents validated with correct statuses, account scopes, and section embeddings.');
  } else {
    console.error(`\n❌ Document Validation Failed with ${report.errors.length} errors:`);
    for (const err of report.errors) {
      console.error(`  - ${err}`);
    }
  }

  return report;
}

if (require.main === module) {
  const report = runDocValidation();
  if (!report.isValid) {
    process.exit(1);
  }
}
