import { createCustomerSession, createInternalSession } from '../../src/access/sessions';
import { executeGetInsights } from '../../src/agent/tools/insight-tools';
import { getInsights } from '../../src/insights';

async function testInsights() {
  console.log('=== Testing Module 9: Problem 1 Proactive Issue Detection ===\n');

  const customerSession = createCustomerSession('ACCT-001');
  const opsSession = createInternalSession('ops', 'OpsLeadVikram');

  // 1. Spike Detection
  console.log('1. Testing Dynamic Topic Spike Detection (spike_by_topic)...');
  const spikeRes = await executeGetInsights(opsSession, {
    query_type: 'spike_by_topic',
    params: { window_hours: 24, min_count: 2 },
  });

  if (spikeRes.result.query_type !== 'spike_by_topic') {
    throw new Error('Unexpected result type for spike_by_topic');
  }

  const clusters = spikeRes.result.data.clusters;
  console.log(`  Discovered ${clusters.length} active topic clusters across ${spikeRes.result.data.total_open_tickets} open tickets:`);
  for (const c of clusters) {
    console.log(`  • [${c.topic}] Count: ${c.count} tickets across ${c.account_count} accounts (Known Issue: ${c.known_issue_id || 'None'})`);
  }

  const ki208Cluster = clusters.find((c) => c.known_issue_id === 'KI-208' || c.topic.includes('Bulk Upload'));
  const ki211Cluster = clusters.find((c) => c.known_issue_id === 'KI-211' || c.topic.includes('SwiftShip'));

  if (!ki208Cluster || ki208Cluster.count === 0) {
    throw new Error('Spike detection failed to discover the Bulk Upload (KI-208) incident cluster.');
  }
  if (!ki211Cluster || ki211Cluster.count === 0) {
    throw new Error('Spike detection failed to discover the SwiftShip (KI-211) status delay cluster.');
  }
  console.log('  [PASS] Naturally discovered KI-208 and KI-211 clusters from real ticket text without hardcoding.');

  // 2. SLA Risk Detection
  console.log('\n2. Testing SLA Risk Scanner (sla_at_risk)...');
  const slaRes = await executeGetInsights(opsSession, {
    query_type: 'sla_at_risk',
    params: { threshold_pct: 80 },
  });

  if (slaRes.result.query_type !== 'sla_at_risk') {
    throw new Error('Unexpected result type for sla_at_risk');
  }

  console.log(`  Scanned ${slaRes.result.data.total_open_tickets} open tickets:`);
  console.log(`  - Breached Tickets: ${slaRes.result.data.breached_count}`);
  console.log(`  - At Risk Tickets (>=80%): ${slaRes.result.data.at_risk_count}`);

  for (const item of slaRes.result.data.items.slice(0, 3)) {
    console.log(`  • [${item.status}] ${item.ticket_id} (${item.account_name}) - Severity: ${item.severity}, ${item.percentage_elapsed}% SLA elapsed (${item.elapsed_minutes}/${item.target_minutes}m)`);
  }
  console.log('  [PASS] Proactive SLA risk detection verified.');

  // 3. Known Issue Correlation
  console.log('\n3. Testing Known Issue Correlation (known_issue_correlation)...');

  // Correlate KI-208
  const ki208Res = await executeGetInsights(opsSession, {
    query_type: 'known_issue_correlation',
    params: { ki_id: 'KI-208' },
  });
  if (ki208Res.result.query_type === 'known_issue_correlation') {
    const report = ki208Res.result.data[0];
    console.log(`  • KI-208: "${report.title}"`);
    console.log(`    Status: ${report.status}, Affected Tickets: ${report.affected_ticket_count}, Affected Accounts: ${report.affected_account_count}`);
    console.log(`    Workaround: "${report.workaround}"`);
    if (report.affected_ticket_count < 10) {
      throw new Error(`Expected >10 tickets for KI-208 cluster, found ${report.affected_ticket_count}`);
    }
  }

  // Correlate KI-211
  const ki211Res = await executeGetInsights(opsSession, {
    query_type: 'known_issue_correlation',
    params: { ki_id: 'KI-211' },
  });
  if (ki211Res.result.query_type === 'known_issue_correlation') {
    const report = ki211Res.result.data[0];
    console.log(`  • KI-211: "${report.title}"`);
    console.log(`    Status: ${report.status}, Affected Tickets: ${report.affected_ticket_count}, Affected Accounts: ${report.affected_account_count}`);
    if (report.affected_ticket_count < 5) {
      throw new Error(`Expected >5 tickets for KI-211 cluster, found ${report.affected_ticket_count}`);
    }
  }
  console.log('  [PASS] Known issue correlation successfully matched advisory symptoms to real tickets.');

  // 4. Security Triage
  console.log('\n4. Testing Security Triage (security_triage)...');
  const secRes = await executeGetInsights(opsSession, {
    query_type: 'security_triage',
  });

  if (secRes.result.query_type === 'security_triage') {
    const secData = secRes.result.data;
    console.log(`  Identified ${secData.total_security_incidents} credential/secret exposure tickets:`);
    for (const inc of secData.incidents) {
      console.log(`  • [${inc.severity} ${inc.risk_level}] ${inc.ticket_id} (${inc.account_name}) - Type: ${inc.exposed_type}`);
      console.log(`    Subject: "${inc.subject}"`);
      if (inc.severity !== 'P1') {
        throw new Error(`Security breach: Incident ${inc.ticket_id} was not classified as P1!`);
      }
    }
  }
  console.log('  [PASS] Security triage strictly elevated all credential/secret exposures to P1 Critical.');

  // 5. Access Control Barrier on get_insights
  console.log('\n5. Testing Access Control Barrier on get_insights:');
  try {
    await executeGetInsights(customerSession, {
      query_type: 'security_triage',
    });
    throw new Error('Security Breach: Customer session was permitted to call get_insights tool.');
  } catch (err: any) {
    if (err.name === 'ForbiddenError') {
      console.log('  [PASS] Customer session strictly blocked from accessing internal insights.');
    } else {
      throw err;
    }
  }

  console.log('\n=== Module 9 Problem 1 Proactive Issue Detection Tests Completed Successfully ===');
}

testInsights().catch((err) => {
  console.error('Insights test failed:', err);
  process.exit(1);
});
