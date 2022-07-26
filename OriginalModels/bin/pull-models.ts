import { SchemasClient, ListSchemasCommand, ListSchemasCommandOutput, SchemaSummary, DescribeSchemaCommand, DescribeSchemaCommandOutput } from "@aws-sdk/client-schemas";
import { fromIni } from "@aws-sdk/credential-providers";
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

interface Manifest {
  schemas: ManifestItem[],
}

interface ManifestItem {
  schemaService: string,
  schemaEventName: string,
  schemaRelativeLocation: string,
}

const client = new SchemasClient({ region: "us-east-1", credentials: fromIni({ profile: '714313996820_AdministratorAccess'}) });


async function run() {
  const schemas: SchemaSummary[] = [];
  const manifest: Manifest = {
    schemas: [],
  };
  var nextToken: string | undefined  = undefined;
  do {
    const listResult: ListSchemasCommandOutput = await client.send(new ListSchemasCommand({
      RegistryName: 'aws.events',
      NextToken: nextToken
    }));
    nextToken = listResult.NextToken;
    if (listResult.Schemas) {
      schemas.push(...listResult.Schemas);
    }
  } while (nextToken != undefined);
  console.log(`Retrieved ${schemas.length} schemas`);

  for(let schema of schemas) {
    manifest.schemas.push(await saveSchema(schema));
  }

  saveManifest(manifest);
}

async function saveSchema(schema: SchemaSummary): Promise<ManifestItem> {
  const describeResult: DescribeSchemaCommandOutput = await client.send(new DescribeSchemaCommand({
    RegistryName: 'aws.events',
    SchemaName: schema.SchemaName,
    SchemaVersion: `${schema.VersionCount}`,
  }));
  var prettyContent = JSON.stringify(JSON.parse(describeResult.Content!),null,2);
  const schemaPath = `${getServiceName(schema)}/${getEventName(schema)}.json`
  const relativePath = `../schemas/${schemaPath}`
  const absolutePath = join(__dirname, relativePath);
  ensureDirectoryExistence(absolutePath);
  writeFileSync(absolutePath, prettyContent, {
    flag: 'w',
  });

  return {
    schemaService: getServiceName(schema),
    schemaEventName: getEventName(schema),
    schemaRelativeLocation: schemaPath,
  }
}

function saveManifest(manifest: Manifest) {
  var prettyContent = JSON.stringify(manifest,null,2);
  const relativePath = '../schemas/manifest.json'
  const absolutePath = join(__dirname, relativePath);
  writeFileSync(absolutePath, prettyContent, {
    flag: 'w',
  });
}

function getServiceName(schema: SchemaSummary): string {
  return schema.SchemaName!.split('.')[1].split('@')[0]
}

function getEventName(schema: SchemaSummary): string {
  return schema.SchemaName!.split('.')[1].split('@')[1]
}

function ensureDirectoryExistence(filePath: string) {
  var directoryName: string = dirname(filePath);
  if (existsSync(directoryName)) {
    return true;
  }
  ensureDirectoryExistence(directoryName);
  mkdirSync(directoryName);
}



run().then(() => {
  console.log("Saved all schemas");
}).catch(error => {
  console.log(error)
});