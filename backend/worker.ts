import { getJobsCollection, getResultsCollection } from './database.ts';
import { JobStatus, JobResult, Job, ProcessRequest } from './models.ts';
import { downloadAudioAndMetadata, getProfileReels } from './downloader.ts';
import fs from 'fs';
import path from 'path';

export async function processProfileJob(jobId: string, profileUrl: string, options: ProcessRequest) {
  const jobsColl = await getJobsCollection();
  try {
    await jobsColl.updateOne({ id: jobId }, { $set: { status: JobStatus.PROCESSING, updated_at: new Date() } });
    
    // Fetch reels
    const reels = await getProfileReels(profileUrl, options.reel_count);
    
    if (!reels || reels.length === 0) {
       await jobsColl.updateOne({ id: jobId }, { $set: { status: JobStatus.FAILED, progress: 100, updated_at: new Date() } });
       return;
    }

    // Now process them as bulk
    await processJob(jobId, reels, options);
  } catch(err) {
    console.error(`Error in profile job ${jobId}:`, err);
    await jobsColl.updateOne({ id: jobId }, { $set: { status: JobStatus.FAILED, updated_at: new Date() } });
  }
}

export async function processJob(jobId: string, urls: string[], options: ProcessRequest) {
  const jobsColl = await getJobsCollection();
  const resultsColl = await getResultsCollection();

  try {
    await jobsColl.updateOne({ id: jobId }, { $set: { status: JobStatus.PROCESSING, updated_at: new Date() } });

    let completedCount = 0;
    const totalCount = urls.length;

    for (const url of urls) {
      try {
        // Update progress
        const progress = Math.round((completedCount / totalCount) * 100);
        await jobsColl.updateOne({ id: jobId }, { $set: { progress, updated_at: new Date() } });

        // 1. Download & Meta
        let meta: any = {};
        meta = await downloadAudioAndMetadata(url);

        // 2. Transcribe
        let transcription: any = null;
        let detectedLanguage = null;
        let transcriptionError: string | null = null;
        if (meta.audioPath) {
          try {
            const { transcribeAudio } = await import('./transcribe.ts');
            // update transcribe prompt to return detected_language as well
            transcription = await transcribeAudio(meta.audioPath, options.language);
            detectedLanguage = (transcription as any).detected_language || 'Auto';
          } catch (tErr) {
            console.error('Transcription failed:', tErr);
            transcriptionError = (tErr as Error).message;
            // We can still save result without transcript
          }
        }

        // 3. Store result - With transcript and segments completed
        const result: JobResult = {
          job_id: jobId,
          instagram_url: url,
          status: transcription ? JobStatus.DONE : (transcriptionError ? JobStatus.FAILED : (meta.audioPath ? JobStatus.DONE : JobStatus.FAILED)),
          audio_file: meta.audioPath ? path.basename(meta.audioPath) : undefined,
          owner_username: meta.uploader,
          owner_full_name: meta.uploader,
          caption: meta.description,
          hashtags: meta.hashtags && meta.hashtags.length > 0 ? meta.hashtags : [],
          mentions: meta.mentions,
          likes_count: meta.like_count,
          comments_count: meta.comment_count,
          video_view_count: meta.view_count,
          video_duration: meta.duration,
          thumbnail_url: meta.thumbnail,
          video_url: meta.video_url,
          channel_url: meta.channel_url,
          channel_thumbnail: meta.channel_thumbnail,
          posted_at: meta.timestamp ? new Date(meta.timestamp * 1000).toISOString() : undefined,
          processing_time: 0,
          transcript: transcription?.transcript,
          segments: transcription?.segments,
          transcript_confidence: transcription?.confidence,
          detected_language: detectedLanguage,
          summary: transcription?.summary,
          sentiment: transcription?.sentiment,
          keywords: transcription?.keywords,
          error: transcriptionError || undefined, // Set the error message if transcription failed
        };

        // Fallback hashtag extraction from caption
        if ((!result.hashtags || result.hashtags.length === 0) && meta.description) {
          const foundTags = meta.description.match(/#[a-zA-Z0-9_]+/g);
          if (foundTags) {
            result.hashtags = foundTags.map(t => t.replace('#', ''));
          }
        }

        await resultsColl.insertOne(result);

        // Cleanup moved to results update
        // if (meta.audioPath) fs.unlinkSync(meta.audioPath);

      } catch (err) {
        console.error(`Error processing URL ${url}:`, err);
        const result: JobResult = {
          job_id: jobId,
          instagram_url: url,
          status: JobStatus.FAILED,
          error: (err as Error).message,
        };
        await resultsColl.insertOne(result);
      }
      completedCount++;
    }

    const finalStatus = completedCount === totalCount ? JobStatus.DONE : JobStatus.PARTIAL;
    await jobsColl.updateOne({ id: jobId }, { 
      $set: { 
        status: finalStatus, 
        progress: 100, 
        updated_at: new Date() 
      } 
    });

    if (options.webhook_url) {
       try {
         const importAxios = await import('axios');
         await importAxios.default.post(options.webhook_url, {
           job_id: jobId,
           status: finalStatus,
           completed: completedCount,
           total: totalCount
         });
       } catch (webhookErr) {
         console.error('Failed to call webhook:', webhookErr);
       }
    }

  } catch (err) {
    console.error(`Fatal error in job ${jobId}:`, err);
    await jobsColl.updateOne({ id: jobId }, { $set: { status: JobStatus.FAILED, updated_at: new Date() } });
  }
}
