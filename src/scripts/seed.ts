import { getDb } from "../lib/db";
import { ConnectorRegistry } from "../lib/connectors/registry";
import { IngestionPipeline } from "../lib/pipeline/orchestrator";
import { getGeocoder } from "../lib/pipeline/geocoder";
import { getAIProvider } from "../lib/ai";

async function main() {
  console.log("Seeding Job Mapper with authentic verified sources...");
  const db = await getDb();
  const geocoder = getGeocoder();
  const ai = getAIProvider();

  const registry = new ConnectorRegistry(db);
  await registry.syncSourcesWithDatabase();

  const pipeline = new IngestionPipeline(db, geocoder, ai);
  const connectors = registry.getAllConnectors();

  for (const connector of connectors) {
    console.log(`Ingesting from ${connector.name}...`);
    await pipeline.runConnector(connector);
  }

  const health = await db.getSystemHealth();
  console.log("Seeding complete:", health);
  await db.close();
  process.exit(0);
}

main().catch(err => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
