import { getDb } from "../lib/db";
import { ConnectorRegistry } from "../lib/connectors/registry";
import { IngestionPipeline } from "../lib/pipeline/orchestrator";
import { getGeocoder } from "../lib/pipeline/geocoder";
import { getAIProvider } from "../lib/ai";

async function main() {
  console.log("Starting Job Mapper ingestion pipeline...");
  const db = await getDb();
  const geocoder = getGeocoder();
  const ai = getAIProvider();

  const registry = new ConnectorRegistry(db);
  await registry.syncSourcesWithDatabase();

  const pipeline = new IngestionPipeline(db, geocoder, ai);
  const connectors = registry.getAllConnectors();

  console.log(`Found ${connectors.length} configured source connectors.`);

  for (const connector of connectors) {
    console.log(`\n======================================================`);
    console.log(`Running source connector: ${connector.name} (${connector.id})`);
    console.log(`Reliability: ${connector.reliabilityScore} | URL: ${connector.sourceUrl}`);
    console.log(`======================================================`);

    const report = await pipeline.runConnector(connector);
    console.log(`Report for ${connector.id}:`);
    console.log(`  Discovered: ${report.recordsFound}`);
    console.log(`  Accepted:   ${report.recordsAccepted}`);
    console.log(`  Duplicates: ${report.recordsDuplicate}`);
    console.log(`  Rejected:   ${report.recordsRejected}`);
    if (report.errors.length > 0) {
      console.log(`  Errors:     ${report.errors.length} error(s)`);
      report.errors.slice(0, 3).forEach(e => console.log(`    - ${e}`));
    }
  }

  const health = await db.getSystemHealth();
  console.log("\n======================================================");
  console.log("Ingestion completed! System Health Summary:");
  console.log(health);
  console.log("======================================================");

  await db.close();
  process.exit(0);
}

main().catch(err => {
  console.error("Ingestion pipeline failed:", err);
  process.exit(1);
});
