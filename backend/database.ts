import dns from 'node:dns';

// Force Node.js to use Google's Public DNS to bypass ISP blocks
dns.setServers(['8.8.8.8', '8.8.4.4']);

import 'dotenv/config';
import { MongoClient, Db, Collection } from 'mongodb';
import { Job, JobResult } from './models.ts';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. Please set it in your environment or .env file.');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.MONGODB_DB_NAME || 'instagram_transcripts');
  
  // Create indexes
  await db.collection('jobs').createIndex({ id: 1 }, { unique: true });
  await db.collection('results').createIndex({ job_id: 1 });
  await db.collection('results').createIndex({ transcript: 'text' });

  return db;
}

export async function getJobsCollection(): Promise<Collection<Job>> {
  const db = await getDb();
  return db.collection<Job>('jobs');
}

export async function getResultsCollection(): Promise<Collection<JobResult>> {
  const db = await getDb();
  return db.collection<JobResult>('results');
}
