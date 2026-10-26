#!/usr/bin/env node
/**
 * Spotifree E2E Test Suite Runner
 * Executes 4-tier opaque-box test suites:
 * - Tier 1: Feature Coverage (>=70 tests)
 * - Tier 2: Boundary & Corner Cases (>=70 tests)
 * - Tier 3: Cross-Feature Combinations (>=14 tests)
 * - Tier 4: Real-World Application Scenarios (>=7 tests)
 * Total: >=161 tests
 *
 * Usage:
 *   node tests/e2e/runner.js               # Run all tiers (default)
 *   node tests/e2e/runner.js --all         # Run all tiers explicitly
 *   node tests/e2e/runner.js --tier 1      # Run Tier 1 only
 *   node tests/e2e/runner.js --tier 2      # Run Tier 2 only
 *   node tests/e2e/runner.js --tier 3      # Run Tier 3 only
 *   node tests/e2e/runner.js --tier 4      # Run Tier 4 only
 *   node tests/e2e/runner.js --feature 1   # Run Feature 1 tests
 *   node tests/e2e/runner.js --verbose     # Print each individual test result
 */

import { tier1Suite } from './tier1_feature.test.js';
import { tier2Suite } from './tier2_boundary.test.js';
import { tier3Suite } from './tier3_pairwise.test.js';
import { tier4Suite } from './tier4_scenarios.test.js';

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options = {
    tier: null,
    feature: null,
    scenario: null,
    verbose: false,
    all: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--tier' && args[i + 1]) {
      options.tier = parseInt(args[++i], 10);
      options.all = false;
    } else if (arg === '--feature' && args[i + 1]) {
      options.feature = parseInt(args[++i], 10);
      options.all = false;
    } else if (arg === '--scenario' && args[i + 1]) {
      options.scenario = parseInt(args[++i], 10);
      options.all = false;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Spotifree E2E Test Suite Runner
Usage:
  node tests/e2e/runner.js [options]

Options:
  --all               Run all 4 tiers (default)
  --tier <1-4>        Run specific test tier
  --feature <1-14>    Run tests for specific feature
  --scenario <1-7>    Run specific scenario
  --verbose, -v       Show detailed output for each test
  --help, -h          Show this help message
      `);
      process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseCliArgs();
  const startTime = Date.now();

  console.log('='.repeat(72));
  console.log('   SPOTIFREE E2E TEST SUITE RUNNER (4-TIER METHODOLOGY)');
  console.log('='.repeat(72));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Target: http://127.0.0.1:5173`);
  console.log(`Mode: Opaque-Box System & State Verification`);
  console.log(`Filter: ${options.tier ? `Tier ${options.tier}` : options.feature ? `Feature ${options.feature}` : 'All Tiers'}`);
  console.log('-'.repeat(72));

  const suitesToRun = [];

  if (options.tier === 1 || options.all || options.feature) {
    suitesToRun.push({ tier: 1, suite: tier1Suite });
  }
  if (options.tier === 2 || options.all || options.feature) {
    suitesToRun.push({ tier: 2, suite: tier2Suite });
  }
  if (options.tier === 3 || options.all) {
    suitesToRun.push({ tier: 3, suite: tier3Suite });
  }
  if (options.tier === 4 || options.all) {
    suitesToRun.push({ tier: 4, suite: tier4Suite });
  }

  const overall = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tierResults: [],
    failedTests: [],
  };

  for (const { tier, suite } of suitesToRun) {
    const tierStart = Date.now();
    const result = await suite.run({
      tier: options.tier,
      feature: options.feature,
    });
    const tierDuration = Date.now() - tierStart;

    overall.total += result.total;
    overall.passed += result.passed;
    overall.failed += result.failed;
    overall.tierResults.push({
      tier,
      name: suite.name,
      total: result.total,
      passed: result.passed,
      failed: result.failed,
      durationMs: tierDuration,
    });

    for (const t of result.tests) {
      if (t.status === 'failed') {
        overall.failedTests.push({ tier, ...t });
      }
      if (options.verbose) {
        const mark = t.status === 'passed' ? '✔' : '✖';
        console.log(`  ${mark} [Tier ${tier}] ${t.title} (${t.durationMs}ms)`);
      }
    }

    const tierMark = result.failed === 0 ? '✔' : '✖';
    console.log(
      `${tierMark} ${suite.name.padEnd(40)} ${String(result.passed).padStart(3)}/${String(result.total).padEnd(3)} passed (${tierDuration}ms)`
    );
  }

  const totalDuration = Date.now() - startTime;
  console.log('-'.repeat(72));
  console.log('TIER BREAKDOWN SUMMARY:');
  console.log('-'.repeat(72));

  for (const tr of overall.tierResults) {
    const status = tr.failed === 0 ? 'PASS' : 'FAIL';
    console.log(
      `  Tier ${tr.tier}: ${tr.name.padEnd(38)} | ${String(tr.passed).padStart(3)} passed | ${String(tr.failed).padStart(2)} failed | [${status}]`
    );
  }

  console.log('='.repeat(72));
  console.log(`TOTAL SUITE RESULTS:`);
  console.log(`  Total Tests Run:  ${overall.total}`);
  console.log(`  Passed Tests:     ${overall.passed}`);
  console.log(`  Failed Tests:     ${overall.failed}`);
  console.log(`  Success Rate:     ${overall.total > 0 ? ((overall.passed / overall.total) * 100).toFixed(1) : 0}%`);
  console.log(`  Total Duration:   ${totalDuration}ms`);
  console.log('='.repeat(72));

  if (overall.failedTests.length > 0) {
    console.error('\nFAILED TESTS DIAGNOSTIC REPORT:');
    for (const f of overall.failedTests) {
      console.error(`\n✖ [Tier ${f.tier}] ${f.title}`);
      console.error(`  Error: ${f.error}`);
      if (f.stack) {
        console.error(`  Stack: ${f.stack.split('\n').slice(0, 4).join('\n')}`);
      }
    }
    console.error('\nE2E Test Run: FAILED');
    process.exitCode = 1;
    return;
  }

  console.log('\nE2E Test Run: SUCCESS (All tests passed cleanly)');
  process.exitCode = 0;
}

main().catch((err) => {
  console.error('Fatal Test Runner Exception:', err);
  process.exitCode = 1;
});
