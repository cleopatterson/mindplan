/**
 * Batch quality test — uploads every file in client_files/ to the parse API
 * and validates the response structure and data quality.
 *
 * Usage: npx tsx test/batch-test.ts
 * Requires the server to be running on localhost:3001
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_FILES_DIR = path.join(__dirname, '../client_files');
const API_URL = 'http://localhost:3001/api/parse';
const RESULTS_FILE = path.join(__dirname, 'batch-results.json');

// How many concurrent requests (avoid hammering the API key rate limits)
const CONCURRENCY = 1;

interface TestResult {
  file: string;
  success: boolean;
  error?: string;
  durationMs: number;
  extractedTextLength?: number;
  // Quality metrics
  metrics?: {
    clientCount: number;
    entityCount: number;
    personalAssetCount: number;
    personalLiabilityCount: number;
    entityAssetCount: number;
    entityLiabilityCount: number;
    totalAssetValue: number | null;
    totalLiabilityValue: number | null;
    estateItemCount: number;
    familyMemberCount: number;
    grandchildCount: number;
    goalCount: number;
    relationshipCount: number;
    gapCount: number;
    objectiveCount: number;
    // Warnings
    warnings: string[];
    // ID validation
    duplicateIds: string[];
    emptyNames: string[];
    // Schema completeness
    clientsWithAge: number;
    clientsWithIncome: number;
    clientsWithSuper: number;
    clientsWithOccupation: number;
    clientsWithRiskProfile: number;
    assetsWithValue: number;
    assetsWithoutValue: number;
    liabilitiesWithAmount: number;
    liabilitiesWithoutAmount: number;
    estateWithStatus: number;
    estateWithIssues: number;
    familyWithAge: number;
    familyDependants: number;
  };
  // Raw data for deeper inspection
  data?: unknown;
}

async function uploadFile(filePath: string): Promise<TestResult> {
  const fileName = path.basename(filePath);
  const t0 = performance.now();

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    formData.append('file', blob, fileName);

    const response = await fetch(API_URL, {
      method: 'POST',
      body: formData,
    });

    const durationMs = Math.round(performance.now() - t0);
    const json = await response.json();

    if (!json.success) {
      return { file: fileName, success: false, error: json.error, durationMs };
    }

    const data = json.data;
    const warnings: string[] = [];
    const allIds: string[] = [];
    const emptyNames: string[] = [];

    // Collect all IDs
    for (const c of data.clients) {
      allIds.push(c.id);
      if (!c.name || c.name.trim() === '') emptyNames.push(`client ${c.id}`);
    }
    for (const e of data.entities) {
      allIds.push(e.id);
      if (!e.name || e.name.trim() === '') emptyNames.push(`entity ${e.id}`);
      for (const a of e.assets) {
        allIds.push(a.id);
        if (!a.name || a.name.trim() === '') emptyNames.push(`asset ${a.id}`);
      }
      for (const l of e.liabilities) {
        allIds.push(l.id);
        if (!l.name || l.name.trim() === '') emptyNames.push(`liability ${l.id}`);
      }
    }
    for (const a of data.personalAssets) {
      allIds.push(a.id);
      if (!a.name || a.name.trim() === '') emptyNames.push(`asset ${a.id}`);
    }
    for (const l of data.personalLiabilities) {
      allIds.push(l.id);
      if (!l.name || l.name.trim() === '') emptyNames.push(`liability ${l.id}`);
    }
    for (const ep of data.estatePlanning ?? []) allIds.push(ep.id);
    for (const m of data.familyMembers ?? []) {
      allIds.push(m.id);
      if (!m.name || m.name.trim() === '') emptyNames.push(`familyMember ${m.id}`);
      for (const gc of m.children ?? []) {
        allIds.push(gc.id);
        if (!gc.name || gc.name.trim() === '') emptyNames.push(`grandchild ${gc.id}`);
      }
    }
    for (const g of data.goals ?? []) allIds.push(g.id);
    for (const r of data.relationships ?? []) allIds.push(r.id);

    // Find duplicates
    const idCounts = new Map<string, number>();
    for (const id of allIds) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
    const duplicateIds = [...idCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id);

    if (duplicateIds.length > 0) warnings.push(`Duplicate IDs: ${duplicateIds.join(', ')}`);
    if (emptyNames.length > 0) warnings.push(`Empty names: ${emptyNames.join(', ')}`);

    // Validate linkedClientIds reference real client IDs
    const clientIds = new Set(data.clients.map((c: any) => c.id));
    for (const entity of data.entities) {
      for (const linkedId of entity.linkedClientIds) {
        if (!clientIds.has(linkedId)) {
          warnings.push(`Entity "${entity.name}" references non-existent client ID: ${linkedId}`);
        }
      }
    }

    // Validate estate clientIds
    for (const ep of data.estatePlanning ?? []) {
      if (!clientIds.has(ep.clientId)) {
        warnings.push(`Estate item "${ep.type}" references non-existent client ID: ${ep.clientId}`);
      }
    }

    // Validate ownerIds on assets/liabilities
    const allNodeIds = new Set(allIds);
    for (const a of data.personalAssets) {
      for (const ownerId of a.ownerIds) {
        if (!clientIds.has(ownerId)) {
          warnings.push(`Personal asset "${a.name}" has invalid ownerIds: ${ownerId}`);
        }
      }
    }
    for (const l of data.personalLiabilities) {
      for (const ownerId of l.ownerIds) {
        if (!clientIds.has(ownerId)) {
          warnings.push(`Personal liability "${l.name}" has invalid ownerIds: ${ownerId}`);
        }
      }
    }

    // Validate relationship clientIds
    for (const r of data.relationships ?? []) {
      for (const cid of r.clientIds) {
        if (!clientIds.has(cid)) {
          warnings.push(`Relationship "${r.firmName ?? r.type}" references non-existent client ID: ${cid}`);
        }
      }
    }

    // Check for zero clients (should never happen)
    if (data.clients.length === 0) warnings.push('No clients parsed — this is a critical failure');

    // Check for suspiciously high values (potential parsing errors)
    const checkValue = (label: string, val: number | null) => {
      if (val !== null && val > 100_000_000) {
        warnings.push(`Suspiciously high value: ${label} = $${val.toLocaleString()}`);
      }
    };
    for (const a of [...data.personalAssets, ...data.entities.flatMap((e: any) => e.assets)]) {
      checkValue(`Asset "${a.name}"`, a.value);
    }
    for (const l of [...data.personalLiabilities, ...data.entities.flatMap((e: any) => e.liabilities)]) {
      checkValue(`Liability "${l.name}"`, l.amount);
    }
    for (const c of data.clients) {
      checkValue(`Income for "${c.name}"`, c.income);
      checkValue(`Super for "${c.name}"`, c.superBalance);
    }

    // Check for negative values (shouldn't happen for assets/income)
    for (const a of [...data.personalAssets, ...data.entities.flatMap((e: any) => e.assets)]) {
      if (a.value !== null && a.value < 0) warnings.push(`Negative asset value: "${a.name}" = $${a.value}`);
    }

    // Compute totals
    const allAssets = [...data.personalAssets, ...data.entities.flatMap((e: any) => e.assets)];
    const allLiabilities = [...data.personalLiabilities, ...data.entities.flatMap((e: any) => e.liabilities)];

    const totalAssetValue = allAssets.every((a: any) => a.value === null)
      ? null
      : allAssets.reduce((sum: number, a: any) => sum + (a.value ?? 0), 0);
    const totalLiabilityValue = allLiabilities.every((l: any) => l.amount === null)
      ? null
      : allLiabilities.reduce((sum: number, l: any) => sum + (l.amount ?? 0), 0);

    const grandchildCount = (data.familyMembers ?? []).reduce(
      (sum: number, m: any) => sum + (m.children?.length ?? 0), 0,
    );

    return {
      file: fileName,
      success: true,
      durationMs,
      extractedTextLength: json.extractedTextLength,
      metrics: {
        clientCount: data.clients.length,
        entityCount: data.entities.length,
        personalAssetCount: data.personalAssets.length,
        personalLiabilityCount: data.personalLiabilities.length,
        entityAssetCount: data.entities.reduce((s: number, e: any) => s + e.assets.length, 0),
        entityLiabilityCount: data.entities.reduce((s: number, e: any) => s + e.liabilities.length, 0),
        totalAssetValue,
        totalLiabilityValue,
        estateItemCount: (data.estatePlanning ?? []).length,
        familyMemberCount: (data.familyMembers ?? []).length,
        grandchildCount,
        goalCount: (data.goals ?? []).length,
        relationshipCount: (data.relationships ?? []).length,
        gapCount: data.dataGaps.length,
        objectiveCount: data.objectives.length,
        warnings,
        duplicateIds,
        emptyNames,
        clientsWithAge: data.clients.filter((c: any) => c.age !== null).length,
        clientsWithIncome: data.clients.filter((c: any) => c.income !== null).length,
        clientsWithSuper: data.clients.filter((c: any) => c.superBalance !== null).length,
        clientsWithOccupation: data.clients.filter((c: any) => c.occupation !== null).length,
        clientsWithRiskProfile: data.clients.filter((c: any) => c.riskProfile !== null).length,
        assetsWithValue: allAssets.filter((a: any) => a.value !== null).length,
        assetsWithoutValue: allAssets.filter((a: any) => a.value === null).length,
        liabilitiesWithAmount: allLiabilities.filter((l: any) => l.amount !== null).length,
        liabilitiesWithoutAmount: allLiabilities.filter((l: any) => l.amount === null).length,
        estateWithStatus: (data.estatePlanning ?? []).filter((e: any) => e.status !== null).length,
        estateWithIssues: (data.estatePlanning ?? []).filter((e: any) => e.hasIssue).length,
        familyWithAge: (data.familyMembers ?? []).filter((m: any) => m.age !== null).length,
        familyDependants: (data.familyMembers ?? []).filter((m: any) => m.isDependant).length,
      },
      data,
    };
  } catch (err) {
    return {
      file: fileName,
      success: false,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Math.round(performance.now() - t0),
    };
  }
}

async function main() {
  // Check server is running
  try {
    const health = await fetch('http://localhost:3001/api/health');
    if (!health.ok) throw new Error('Health check failed');
    console.log('✅ Server is healthy\n');
  } catch {
    console.error('❌ Server is not running on localhost:3001. Start it with: npm run dev');
    process.exit(1);
  }

  const files = fs.readdirSync(CLIENT_FILES_DIR)
    .filter((f) => f.endsWith('.docx') || f.endsWith('.pdf') || f.endsWith('.txt'))
    .sort((a, b) => {
      // Sort numerically by the number in parentheses
      const numA = parseInt(a.match(/\((\d+)\)/)?.[1] ?? '0');
      const numB = parseInt(b.match(/\((\d+)\)/)?.[1] ?? '0');
      return numA - numB;
    });

  console.log(`Found ${files.length} files to test\n`);

  const results: TestResult[] = [];
  let successCount = 0;
  let failCount = 0;
  let warningCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(CLIENT_FILES_DIR, file);
    const progress = `[${i + 1}/${files.length}]`;

    process.stdout.write(`${progress} ${file} ... `);
    const result = await uploadFile(filePath);
    results.push(result);

    if (result.success) {
      successCount++;
      const m = result.metrics!;
      const warnStr = m.warnings.length > 0 ? ` ⚠ ${m.warnings.length} warnings` : '';
      console.log(
        `✅ ${(result.durationMs / 1000).toFixed(1)}s | ` +
        `${m.clientCount}C ${m.entityCount}E ${m.personalAssetCount + m.entityAssetCount}A ${m.personalLiabilityCount + m.entityLiabilityCount}L | ` +
        `${m.estateItemCount}est ${m.familyMemberCount}fam ${m.goalCount}goal ${m.relationshipCount}rel | ` +
        `${m.gapCount} gaps${warnStr}`,
      );
      if (m.warnings.length > 0) {
        warningCount += m.warnings.length;
        for (const w of m.warnings) {
          console.log(`   ⚠ ${w}`);
        }
      }
    } else {
      failCount++;
      console.log(`❌ ${(result.durationMs / 1000).toFixed(1)}s | ${result.error}`);
    }
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(80));
  console.log('BATCH TEST SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total files:  ${files.length}`);
  console.log(`Succeeded:    ${successCount}`);
  console.log(`Failed:       ${failCount}`);
  console.log(`Warnings:     ${warningCount}`);
  console.log();

  const successful = results.filter((r) => r.success && r.metrics);
  if (successful.length > 0) {
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const durations = successful.map((r) => r.durationMs);
    const clientCounts = successful.map((r) => r.metrics!.clientCount);
    const assetCounts = successful.map((r) => r.metrics!.personalAssetCount + r.metrics!.entityAssetCount);
    const liabCounts = successful.map((r) => r.metrics!.personalLiabilityCount + r.metrics!.entityLiabilityCount);
    const entityCounts = successful.map((r) => r.metrics!.entityCount);
    const estateCounts = successful.map((r) => r.metrics!.estateItemCount);
    const familyCounts = successful.map((r) => r.metrics!.familyMemberCount);
    const goalCounts = successful.map((r) => r.metrics!.goalCount);
    const relCounts = successful.map((r) => r.metrics!.relationshipCount);
    const gapCounts = successful.map((r) => r.metrics!.gapCount);

    console.log('AVERAGES:');
    console.log(`  Duration:      ${(avg(durations) / 1000).toFixed(1)}s (min ${(Math.min(...durations) / 1000).toFixed(1)}s, max ${(Math.max(...durations) / 1000).toFixed(1)}s)`);
    console.log(`  Clients:       ${avg(clientCounts).toFixed(1)} (range ${Math.min(...clientCounts)}-${Math.max(...clientCounts)})`);
    console.log(`  Entities:      ${avg(entityCounts).toFixed(1)} (range ${Math.min(...entityCounts)}-${Math.max(...entityCounts)})`);
    console.log(`  Assets:        ${avg(assetCounts).toFixed(1)} (range ${Math.min(...assetCounts)}-${Math.max(...assetCounts)})`);
    console.log(`  Liabilities:   ${avg(liabCounts).toFixed(1)} (range ${Math.min(...liabCounts)}-${Math.max(...liabCounts)})`);
    console.log(`  Estate items:  ${avg(estateCounts).toFixed(1)} (range ${Math.min(...estateCounts)}-${Math.max(...estateCounts)})`);
    console.log(`  Family:        ${avg(familyCounts).toFixed(1)} (range ${Math.min(...familyCounts)}-${Math.max(...familyCounts)})`);
    console.log(`  Goals:         ${avg(goalCounts).toFixed(1)} (range ${Math.min(...goalCounts)}-${Math.max(...goalCounts)})`);
    console.log(`  Relationships: ${avg(relCounts).toFixed(1)} (range ${Math.min(...relCounts)}-${Math.max(...relCounts)})`);
    console.log(`  Data gaps:     ${avg(gapCounts).toFixed(1)} (range ${Math.min(...gapCounts)}-${Math.max(...gapCounts)})`);
    console.log();

    // Completeness rates
    const totalClients = successful.reduce((s, r) => s + r.metrics!.clientCount, 0);
    const withAge = successful.reduce((s, r) => s + r.metrics!.clientsWithAge, 0);
    const withIncome = successful.reduce((s, r) => s + r.metrics!.clientsWithIncome, 0);
    const withSuper = successful.reduce((s, r) => s + r.metrics!.clientsWithSuper, 0);
    const withOccupation = successful.reduce((s, r) => s + r.metrics!.clientsWithOccupation, 0);
    const withRiskProfile = successful.reduce((s, r) => s + r.metrics!.clientsWithRiskProfile, 0);
    const totalAssets = successful.reduce((s, r) => s + r.metrics!.personalAssetCount + r.metrics!.entityAssetCount, 0);
    const assetsValued = successful.reduce((s, r) => s + r.metrics!.assetsWithValue, 0);
    const totalLiabs = successful.reduce((s, r) => s + r.metrics!.personalLiabilityCount + r.metrics!.entityLiabilityCount, 0);
    const liabsValued = successful.reduce((s, r) => s + r.metrics!.liabilitiesWithAmount, 0);

    console.log('COMPLETENESS RATES:');
    console.log(`  Client age:         ${withAge}/${totalClients} (${(withAge / totalClients * 100).toFixed(0)}%)`);
    console.log(`  Client occupation:  ${withOccupation}/${totalClients} (${(withOccupation / totalClients * 100).toFixed(0)}%)`);
    console.log(`  Client income:      ${withIncome}/${totalClients} (${(withIncome / totalClients * 100).toFixed(0)}%)`);
    console.log(`  Client super:       ${withSuper}/${totalClients} (${(withSuper / totalClients * 100).toFixed(0)}%)`);
    console.log(`  Client risk profile:${withRiskProfile}/${totalClients} (${(withRiskProfile / totalClients * 100).toFixed(0)}%)`);
    console.log(`  Asset values:       ${assetsValued}/${totalAssets} (${(assetsValued / totalAssets * 100).toFixed(0)}%)`);
    console.log(`  Liability amounts:  ${liabsValued}/${totalLiabs} (${totalLiabs > 0 ? (liabsValued / totalLiabs * 100).toFixed(0) : 'N/A'}%)`);
    console.log();

    // Files with most warnings
    const filesWithWarnings = successful
      .filter((r) => r.metrics!.warnings.length > 0)
      .sort((a, b) => b.metrics!.warnings.length - a.metrics!.warnings.length);

    if (filesWithWarnings.length > 0) {
      console.log(`FILES WITH WARNINGS (${filesWithWarnings.length} files):`);
      for (const r of filesWithWarnings) {
        console.log(`  ${r.file} — ${r.metrics!.warnings.length} warnings:`);
        for (const w of r.metrics!.warnings) {
          console.log(`    ⚠ ${w}`);
        }
      }
      console.log();
    }

    // Files with zero entities (might indicate poor parsing)
    const noEntities = successful.filter((r) => r.metrics!.entityCount === 0);
    if (noEntities.length > 0) {
      console.log(`FILES WITH NO ENTITIES (${noEntities.length}):`);
      for (const r of noEntities) {
        console.log(`  ${r.file}`);
      }
      console.log();
    }

    // Files with zero estate planning
    const noEstate = successful.filter((r) => r.metrics!.estateItemCount === 0);
    console.log(`FILES WITH NO ESTATE PLANNING: ${noEstate.length}/${successful.length}`);

    // Files with zero family members
    const noFamily = successful.filter((r) => r.metrics!.familyMemberCount === 0);
    console.log(`FILES WITH NO FAMILY MEMBERS:  ${noFamily.length}/${successful.length}`);

    // Files with zero goals
    const noGoals = successful.filter((r) => r.metrics!.goalCount === 0);
    console.log(`FILES WITH NO GOALS:           ${noGoals.length}/${successful.length}`);

    // Files with zero relationships
    const noRels = successful.filter((r) => r.metrics!.relationshipCount === 0);
    console.log(`FILES WITH NO RELATIONSHIPS:   ${noRels.length}/${successful.length}`);
  }

  // Save full results (without raw data to keep file size manageable)
  const savedResults = results.map(({ data, ...rest }) => rest);
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(savedResults, null, 2));
  console.log(`\nFull results saved to: ${RESULTS_FILE}`);

  // Also save a separate file with the raw data for inspection
  const dataFile = path.join(__dirname, 'batch-data.json');
  fs.writeFileSync(dataFile, JSON.stringify(
    results.filter(r => r.success).map(r => ({ file: r.file, data: r.data })),
    null, 2,
  ));
  console.log(`Raw parsed data saved to: ${dataFile}`);
}

main().catch(console.error);
