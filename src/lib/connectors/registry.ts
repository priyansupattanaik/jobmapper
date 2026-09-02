import { BaseSourceConnector } from "./base";
import { GreenhouseConnector } from "./greenhouse";
import { LeverConnector } from "./lever";
import { ArbeitnowConnector } from "./arbeitnow";
import { RemotiveConnector } from "./remotive";
import { USAJobsGovConnector } from "./usajobs";
import { DatabaseProvider } from "../db/adapter";

export class ConnectorRegistry {
  private connectors: Map<string, BaseSourceConnector> = new Map();
  private db: DatabaseProvider;

  constructor(db: DatabaseProvider) {
    this.db = db;
    this.register(new GreenhouseConnector());
    this.register(new LeverConnector());
    this.register(new ArbeitnowConnector());
    this.register(new RemotiveConnector());
    this.register(new USAJobsGovConnector());
  }

  register(connector: BaseSourceConnector): void {
    this.connectors.set(connector.id, connector);
  }

  getConnector(id: string): BaseSourceConnector | undefined {
    return this.connectors.get(id);
  }

  getAllConnectors(): BaseSourceConnector[] {
    return Array.from(this.connectors.values());
  }

  async syncSourcesWithDatabase(): Promise<void> {
    for (const connector of this.connectors.values()) {
      const existing = await this.db.getSource(connector.id);
      if (!existing) {
        await this.db.upsertSource(connector.toSourceEntity());
      }
    }
  }
}
