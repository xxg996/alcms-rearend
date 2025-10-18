const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class AlistIngestUpload {
  static async findByAlistPath(settingId, alistFilePath) {
    const result = await query(
      `SELECT * FROM alist_ingest_uploads
       WHERE setting_id = $1 AND alist_file_path = $2`
      , [settingId, alistFilePath]
    );
    return result.rows[0] || null;
  }

  static async create(task) {
    const result = await query(
      `INSERT INTO alist_ingest_uploads (
         setting_id, resource_id, folder_path, file_name, alist_file_path,
         file_size, file_modified_at, bucket, object_name, file_url,
         upload_url, upload_method, content_type, upload_headers,
         status, retry_count, last_error, expires_at
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14,
         $15, $16, $17, $18
       )
       RETURNING *`,
      [
        task.setting_id,
        task.resource_id,
        task.folder_path,
        task.file_name,
        task.alist_file_path,
        task.file_size || 0,
        task.file_modified_at || null,
        task.bucket,
        task.object_name,
        task.file_url,
        task.upload_url || null,
        task.upload_method || 'PUT',
        task.content_type || null,
        task.upload_headers || null,
        task.status || 'pending',
        task.retry_count || 0,
        task.last_error || null,
        task.expires_at || null
      ]
    );
    return result.rows[0];
  }

  static async updateById(id, update) {
    const fields = [];
    const values = [];
    let idx = 1;

    Object.entries(update).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(value);
        idx += 1;
      }
    });

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await query(
      `UPDATE alist_ingest_uploads
       SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${idx}
       RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }

  static async findById(id) {
    const result = await query('SELECT * FROM alist_ingest_uploads WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  static async upsertTask(task) {
    const existing = await this.findByAlistPath(task.setting_id, task.alist_file_path);

    if (!existing) {
      return this.create(task);
    }

    const update = {};
    let needsReset = false;

    const existingModifiedAt = existing.file_modified_at ? new Date(existing.file_modified_at) : null;
    const newModifiedAt = task.file_modified_at || null;

    if (newModifiedAt && (!existingModifiedAt || existingModifiedAt.getTime() !== newModifiedAt.getTime())) {
      update.file_modified_at = newModifiedAt;
      needsReset = true;
    }

    const existingExpiresAt = existing.expires_at ? new Date(existing.expires_at) : null;

    if (needsReset || existing.status === 'failed') {
      update.status = 'pending';
      update.retry_count = 0;
      update.last_error = null;
      update.object_name = task.object_name;
      update.file_url = task.file_url;
      update.upload_url = task.upload_url;
      update.content_type = task.content_type;
      update.upload_headers = task.upload_headers ? JSON.stringify(task.upload_headers) : null;
      update.bucket = task.bucket;
      update.expires_at = task.expires_at;
      update.file_size = task.file_size || 0;
    } else if (task.upload_url && (!existingExpiresAt || existingExpiresAt.getTime() < task.expires_at.getTime())) {
      update.upload_url = task.upload_url;
      update.expires_at = task.expires_at;
      update.upload_headers = task.upload_headers ? JSON.stringify(task.upload_headers) : null;
    }

    update.resource_id = task.resource_id;
    update.folder_path = task.folder_path;
    update.file_name = task.file_name;

    if (Object.keys(update).length === 0) {
      return existing;
    }

    const updated = await this.updateById(existing.id, update);
    return updated || (await this.findById(existing.id));
  }

  static async refreshUploadCredentials(id, credentials) {
    return this.updateById(id, {
      upload_url: credentials.upload_url,
      upload_headers: credentials.upload_headers || null,
      expires_at: credentials.expires_at,
      status: 'pending'
    });
  }

  static async findPending(limit = 5) {
    const result = await query(
      `SELECT * FROM alist_ingest_uploads
       WHERE status IN ('pending', 'failed')
       ORDER BY updated_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  static async markProcessing(id) {
    const result = await query(
      `UPDATE alist_ingest_uploads
       SET status = 'processing', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status IN ('pending', 'failed')
       RETURNING *`,
      [id]
    );

    return result.rows[0] || null;
  }

  static async markCompleted(id) {
    await query(
      `UPDATE alist_ingest_uploads
       SET status = 'completed', retry_count = 0, last_error = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );
  }

  static async markFailed(id, errorMessage) {
    await query(
      `UPDATE alist_ingest_uploads
       SET status = 'failed', retry_count = retry_count + 1,
           last_error = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, errorMessage?.substring(0, 500) || null]
    );
  }
}

module.exports = AlistIngestUpload;
