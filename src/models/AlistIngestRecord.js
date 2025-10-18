const { query } = require('../config/database');
const { logger } = require('../utils/logger');

class AlistIngestRecord {
  static async findBySettingAndPath(settingId, folderPath) {
    try {
      const result = await query(
        `SELECT * FROM alist_ingest_records
         WHERE setting_id = $1 AND folder_path = $2`,
        [settingId, folderPath]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('查询Alist入库记录失败:', error);
      throw error;
    }
  }

  static async upsert(record) {
    try {
      const result = await query(
        `INSERT INTO alist_ingest_records (
           setting_id, folder_name, folder_path, folder_modified_at,
           resource_id, ingested_at
         ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_id, folder_path)
         DO UPDATE SET
           folder_name = EXCLUDED.folder_name,
           folder_modified_at = EXCLUDED.folder_modified_at,
           resource_id = EXCLUDED.resource_id,
           ingested_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
          record.setting_id,
          record.folder_name,
          record.folder_path,
          record.folder_modified_at || null,
          record.resource_id || null
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('写入Alist入库记录失败:', error);
      throw error;
    }
  }
}

module.exports = AlistIngestRecord;
