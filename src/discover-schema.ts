import fs from "fs";
import path from "path";
import { BigQueryClient } from "./bigquery-client.js";

async function main() {
  console.log("Descobrindo schema do BigQuery...\n");
  const bq = new BigQueryClient();
  const schema = await bq.getFullSchema();
  const outputPath = path.resolve("config/schema.txt");
  fs.writeFileSync(outputPath, schema);
  console.log(schema);
  console.log(`\nSchema salvo em ${outputPath}`);
}

main().catch(console.error);
