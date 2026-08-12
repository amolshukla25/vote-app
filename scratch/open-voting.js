const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function main() {
  const env = loadEnv(path.join(__dirname, '..', '.env.local'));
  const uri = env.MONGODB_URI;
  const dbName = env.MONGODB_DB || 'art-showdown';
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const col = client.db(dbName).collection('config');

  const before = await col.findOne({ _id: 'app' });
  console.log('Before:', JSON.stringify(
    { votingOpen: before?.votingOpen, votesPerVoter: before?.votesPerVoter }, null, 2));

  const res = await col.updateOne({ _id: 'app' }, { $set: { votingOpen: true } }, { upsert: true });
  console.log('Updated documents:', res.modifiedCount ?? res.upsertedCount);

  const after = await col.findOne({ _id: 'app' });
  console.log('After :', JSON.stringify(
    { votingOpen: after?.votingOpen, votesPerVoter: after?.votesPerVoter }, null, 2));

  await client.close();
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
