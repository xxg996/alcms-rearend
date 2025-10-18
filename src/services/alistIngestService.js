const Resource = require('../models/Resource');
const AlistResource = require('../models/AlistResource');
const AlistIngestSetting = require('../models/AlistIngestSetting');
const AlistIngestRecord = require('../models/AlistIngestRecord');
const { alistClient } = require('../utils/alistClient');
const { logger } = require('../utils/logger');

function joinAlistPath(basePath, segment) {
  if (!segment) {
    return basePath;
  }

  if (basePath === '/') {
    return `/${segment}`;
  }

  return `${basePath.replace(/\/+$/, '')}/${segment}`;
}

async function fetchDirectoryEntries(path, perPage = 200) {
  let page = 1;
  const items = [];

  while (true) {
    const { content = [], total = 0 } = await alistClient.listDirectory(path, page, perPage);
    items.push(...content);

    if (content.length < perPage || items.length >= total) {
      break;
    }

    page += 1;
  }

  return items;
}

class AlistIngestService {
  static normalizeDescription() {
    return '自动入库无需描述';
  }

  static async scanSetting(settingId, options = {}) {
    const setting = await AlistIngestSetting.findById(settingId);

    if (!setting || !setting.is_active) {
      throw new Error('入库配置不存在或已禁用');
    }

    const rootPath = AlistIngestSetting.normalizePath(setting.alist_root_path);

    await alistClient.initialize();

    const directories = await fetchDirectoryEntries(rootPath);

    const results = {
      totalFolders: directories.length,
      created: [],
      updated: [],
      skipped: [],
      errors: []
    };

    for (const item of directories) {
      if (!item.is_dir) {
        continue;
      }

      const folderName = item.name;
      const folderPath = joinAlistPath(rootPath, folderName);
      const folderModifiedAt = item.modified ? new Date(item.modified) : null;

      try {
        const record = await AlistIngestRecord.findBySettingAndPath(setting.id, folderPath);

        if (record && record.folder_modified_at && folderModifiedAt && record.folder_modified_at.getTime() === folderModifiedAt.getTime()) {
          results.skipped.push({ folder: folderPath, reason: '未修改' });
          continue;
        }

        let resourceId = record?.resource_id || null;

        if (!resourceId) {
          const resource = await Resource.create({
            title: folderName,
            description: this.normalizeDescription(),
            summary: null,
            category_id: setting.category_id,
            resource_type_id: setting.resource_type_id,
            author_id: setting.author_id,
            is_public: true,
            status: 'published',
            official: true
          });

          resourceId = resource.id;
          results.created.push({ folder: folderPath, resourceId });
        } else {
          await Resource.update(resourceId, {
            title: folderName,
            description: this.normalizeDescription(),
            category_id: setting.category_id,
            resource_type_id: setting.resource_type_id,
            is_public: true,
            status: 'published',
            official: true
          });

          await AlistResource.deleteByResourceId(resourceId);
          results.updated.push({ folder: folderPath, resourceId });
        }

        const files = await fetchDirectoryEntries(folderPath);

        let ingestedFileCount = 0;

        for (const file of files) {
          if (file.is_dir) {
            continue;
          }

          if (!alistClient.isExtensionAllowed(file.name)) {
            continue;
          }

          const filePath = joinAlistPath(folderPath, file.name);

          await AlistResource.upsertAlistResource(resourceId, filePath, {
            name: file.name,
            size: file.size || 0,
            type: file.type || null,
            is_dir: false,
            hash: file.sign || null
          });

          ingestedFileCount += 1;
        }

        await AlistIngestRecord.upsert({
          setting_id: setting.id,
          folder_name: folderName,
          folder_path: folderPath,
          folder_modified_at: folderModifiedAt || null,
          resource_id: resourceId
        });

        logger.info('Alist入库完成', {
          settingId: setting.id,
          folderPath,
          resourceId,
          fileCount: ingestedFileCount
        });
      } catch (error) {
        logger.error('Alist入库处理失败', {
          settingId: setting.id,
          folderPath,
          error: error.message
        });
        results.errors.push({ folder: folderPath, error: error.message });
      }
    }

    return results;
  }
}

module.exports = AlistIngestService;
