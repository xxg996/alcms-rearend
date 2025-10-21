const axios = require('axios');
const AlistIngestUpload = require('../models/AlistIngestUpload');
const { alistClient } = require('../utils/alistClient');
const { minioClient } = require('../config/minio');
const { logger } = require('../utils/logger');

const MIN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes
const DEFAULT_BATCH_SIZE = Number(process.env.ALIST_UPLOAD_BATCH_SIZE) || 20;
const DEFAULT_CONCURRENCY = Number(process.env.ALIST_UPLOAD_CONCURRENCY) || 4;

async function refreshUploadCredentials(task) {
  const uploadUrl = await minioClient.presignedPutObject(task.bucket, task.object_name, 60 * 60);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await AlistIngestUpload.refreshUploadCredentials(task.id, {
    upload_url: uploadUrl,
    expires_at: expiresAt,
    upload_headers: null
  });

  return {
    upload_url: uploadUrl,
    expires_at: expiresAt
  };
}

async function performUpload(task) {
  const fileBuffer = await alistClient.getFileContent(task.alist_file_path, null);

  const headers = {
    'Content-Type': task.content_type || 'application/octet-stream'
  };

  await axios.put(task.upload_url, fileBuffer, {
    headers,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 120000
  });
}

class AlistIngestUploadWorker {
  static async processTask(task) {
    let currentTask = task;

    try {
      const lockedTask = await AlistIngestUpload.markProcessing(task.id);
      if (!lockedTask) {
        return;
      }

      currentTask = {
        ...currentTask,
        ...lockedTask
      };

      const expiresAt = currentTask.expires_at ? new Date(currentTask.expires_at) : null;
      if (!currentTask.upload_url || !expiresAt || expiresAt.getTime() - Date.now() < MIN_EXPIRY_BUFFER) {
        const refreshed = await refreshUploadCredentials(currentTask);
        currentTask = {
          ...currentTask,
          upload_url: refreshed.upload_url,
          expires_at: refreshed.expires_at
        };
      }

      await performUpload(currentTask);

      await AlistIngestUpload.markCompleted(task.id);

      logger.info('Alist图片异步上传完成', {
        taskId: task.id,
        resourceId: task.resource_id,
        file: task.file_name
      });
    } catch (error) {
      await AlistIngestUpload.markFailed(task.id, error.message);
      logger.error('Alist图片异步上传失败', {
        taskId: task.id,
        resourceId: task.resource_id,
        file: task.file_name,
        error: error.message
      });
    }
  }

  static resolveOptions(options) {
    if (typeof options === 'number') {
      return {
        batchSize: Math.max(1, options),
        concurrency: Math.max(1, Math.min(options, DEFAULT_CONCURRENCY))
      };
    }

    const batchSize = Math.max(1, options?.batchSize || DEFAULT_BATCH_SIZE);
    const concurrency = Math.max(1, Math.min(batchSize, options?.concurrency || DEFAULT_CONCURRENCY));

    return { batchSize, concurrency };
  }

  static async processPending(options = {}) {
    const { batchSize, concurrency } = this.resolveOptions(options);

    while (true) {
      const tasks = await AlistIngestUpload.findPending(batchSize);

      if (!tasks || tasks.length === 0) {
        break;
      }

      for (let i = 0; i < tasks.length; i += concurrency) {
        const slice = tasks.slice(i, i + concurrency);
        await Promise.allSettled(slice.map((task) => this.processTask(task)));
      }
    }
  }
}

module.exports = AlistIngestUploadWorker;
