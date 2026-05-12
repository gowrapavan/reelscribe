import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import { getJobsCollection, getResultsCollection } from './database.ts';
import { Job, JobStatus, ProcessRequestSchema } from './models.ts';
import { processJob, processProfileJob } from './worker.ts';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});

const authenticateApi = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Simple API key authentication
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const envKey = process.env.VITE_REELS_API_KEY; // Example custom env variable
  
  // Only restrict if the server env specifically demands an API key string
  if (envKey && apiKey !== envKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Serve audio files from /tmp
  app.use('/audio', express.static('/tmp'));

  // Define routers for rate-limited and authenticated API paths
  app.use('/api/', apiLimiter);
  app.use('/api/', authenticateApi);

  // API Routes
  app.get('/api/test-gemini-key', (req, res) => {
    res.json({ keyStr: process.env.GEMINI_API_KEY });
  });

  app.post('/api/process/single', async (req, res) => {
    try {
      const data = ProcessRequestSchema.parse(req.body);
      if (!data.url) return res.status(400).json({ error: 'URL is required' });

      const jobId = uuidv4();
      const job: Job = {
        id: jobId,
        type: 'single',
        status: JobStatus.PENDING,
        progress: 0,
        results: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      const jobsColl = await getJobsCollection();
      await jobsColl.insertOne(job);

      // Start processing in background
      processJob(jobId, [data.url], data).catch(console.error);

      res.status(202).json({ job_id: jobId });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/process/bulk', async (req, res) => {
    try {
      const data = ProcessRequestSchema.parse(req.body);
      if (!data.urls || data.urls.length === 0) {
        return res.status(400).json({ error: 'URLs are required' });
      }

      const jobId = uuidv4();
      const job: Job = {
        id: jobId,
        type: 'bulk',
        status: JobStatus.PENDING,
        progress: 0,
        results: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      const jobsColl = await getJobsCollection();
      await jobsColl.insertOne(job);

      processJob(jobId, data.urls, data).catch(console.error);

      res.status(202).json({ job_id: jobId });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post('/api/process/profile', async (req, res) => {
    try {
      const data = ProcessRequestSchema.parse(req.body);
      if (!data.profile) {
        return res.status(400).json({ error: 'Profile is required' });
      }

      // Convert username, @username or URL to full profile URL
      let profileUrl = data.profile.trim();
      if (!profileUrl.startsWith('http')) {
        if (profileUrl.startsWith('@')) {
          profileUrl = profileUrl.substring(1);
        }
        profileUrl = `https://www.instagram.com/${profileUrl}/reels/`;
      }

      const jobId = uuidv4();
      const job: Job = {
        id: jobId,
        type: 'profile',
        status: JobStatus.PENDING,
        progress: 0,
        results: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      const jobsColl = await getJobsCollection();
      await jobsColl.insertOne(job);

      // Start processing in background, passing profileUrl as the 'urls' but signal profile mode
      processProfileJob(jobId, profileUrl, data).catch(console.error);

      res.status(202).json({ job_id: jobId });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.get('/api/results/:jobId', async (req, res) => {
    try {
      const jobsColl = await getJobsCollection();
      const job = await jobsColl.findOne({ id: req.params.jobId });
      
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const resultsColl = await getResultsCollection();
      const results = await resultsColl.find({ job_id: req.params.jobId }).toArray();

      res.json({ ...job, results });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/results/update', async (req, res) => {
    const { jobId, url, transcript, segments, confidence, detectedLanguage } = req.body;
    try {
      const resultsColl = await getResultsCollection();
      
      await resultsColl.updateOne(
        { job_id: jobId, instagram_url: url },
        { 
          $set: { 
            transcript, 
            segments, 
            transcript_confidence: confidence, 
            detected_language: detectedLanguage,
            status: JobStatus.DONE,
            updated_at: new Date()
          } 
        }
      );

      /* 
      // Cleanup audio file - Disabled cleanup to allow user to listen to the reel audio
      if (result?.audio_file) {
        const audioPath = path.join('/tmp', result.audio_file);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      }
      */

      res.json({ status: 'ok' });
    } catch (err) {
      console.error('Update result error:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/test-insert', async (req, res) => {
    try {
      const jobId = 'test-job-' + Date.now();
      const jobsColl = await getJobsCollection();
      await jobsColl.insertOne({
        id: jobId,
        type: 'single',
        status: JobStatus.DONE,
        progress: 100,
        results: [],
        created_at: new Date(),
        updated_at: new Date(),
        target: 'hello'
      });
      const resultsColl = await getResultsCollection();
      await resultsColl.insertOne({
        job_id: jobId,
        instagram_url: 'http://test',
        status: JobStatus.DONE,
        transcript: 'test transcript',
        owner_username: 'test'
      });
      res.json({ ok: true, jobId });
    } catch(err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/jobs', async (req, res) => {
    try {
      const jobsColl = await getJobsCollection();
      const jobs = await jobsColl.find({}).sort({ _id: -1 }).limit(50).toArray();
      res.json(jobs);
    } catch (err) {
      console.error('Error fetching jobs:', err);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/search', async (req, res) => {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    try {
      const resultsColl = await getResultsCollection();
      const results = await resultsColl.find({ $text: { $search: query } }).limit(20).toArray();
      res.json(results);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  console.log('MongoDB URI in server:', process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0,25) + '...' : 'undefined');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
