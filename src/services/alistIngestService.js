const Resource = require('../models/Resource');
const AlistResource = require('../models/AlistResource');
const AlistIngestSetting = require('../models/AlistIngestSetting');
const AlistIngestRecord = require('../models/AlistIngestRecord');
const AlistIngestUpload = require('../models/AlistIngestUpload');
const Tag = require('../models/Tag');
const { alistClient, AlistClient } = require('../utils/alistClient');
const { minioClient, BUCKETS, generateFileName, getFileUrl } = require('../config/minio');
const { logger } = require('../utils/logger');
const AlistIngestUploadWorker = require('./alistIngestUploadWorker');

const DEFAULT_DESCRIPTION = '自动入库无需描述';

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

function parseMarkdownContent(raw) {
  if (!raw || typeof raw !== 'string') {
    return {
      description: DEFAULT_DESCRIPTION,
      tags: []
    };
  }

  const lines = raw.split(/\r?\n/);
  const descriptionLines = [];
  let tags = [];

  for (const line of lines) {
    const match = line.match(/^\s*标签\s*[:：]\s*(.+)$/i);
    if (match) {
      tags = match[1]
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean);
      continue;
    }

    descriptionLines.push(line);
  }

  const description = descriptionLines
    .map((line) => line.replace(/\s+$/u, ''))
    .filter((line) => !/^[=\-]{3,}\s*$/u.test(line))
    .join('\n')
    .trim()
    || DEFAULT_DESCRIPTION;

  return {
    description,
    tags
  };
}

function isImageFile(filename) {
  if (!filename) {
    return false;
  }

  const ext = AlistClient.getFileExtension(filename);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  return imageExtensions.includes(ext);
}

function getImageContentType(filename) {
  const ext = AlistClient.getFileExtension(filename);
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

async function prepareImageUploadTask(setting, resourceId, folderPath, file) {
  const alistFilePath = joinAlistPath(folderPath, file.name);
  const fileModifiedAt = file.modified ? new Date(file.modified) : null;

  const existing = await AlistIngestUpload.findByAlistPath(setting.id, alistFilePath);

  const objectName = existing?.object_name || generateFileName(file.name);
  const fileUrl = getFileUrl(BUCKETS.IMAGES, objectName);
  let expiresAt = existing?.expires_at ? new Date(existing.expires_at) : null;
  let uploadUrl = existing?.upload_url || null;
  let uploadHeaders = existing?.upload_headers || null;

  let needsNewCredentials = false;

  if (!existing) {
    needsNewCredentials = true;
  } else {
    const existingModifiedAt = existing.file_modified_at ? new Date(existing.file_modified_at) : null;

    if (fileModifiedAt && (!existingModifiedAt || existingModifiedAt.getTime() !== fileModifiedAt.getTime())) {
      needsNewCredentials = true;
    }

    if (existing.status === 'failed') {
      needsNewCredentials = true;
    }

    if (!expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      needsNewCredentials = true;
    }
  }

  if (needsNewCredentials) {
    uploadUrl = await minioClient.presignedPutObject(BUCKETS.IMAGES, objectName, 60 * 60);
    expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    uploadHeaders = null;
  }

  const taskRecord = await AlistIngestUpload.upsertTask({
    setting_id: setting.id,
    resource_id: resourceId,
    folder_path: folderPath,
    file_name: file.name,
    alist_file_path: alistFilePath,
    file_size: file.size || 0,
    file_modified_at: fileModifiedAt,
    bucket: BUCKETS.IMAGES,
    object_name: objectName,
    file_url: fileUrl,
    upload_url: uploadUrl,
    upload_method: 'PUT',
    content_type: getImageContentType(file.name),
    upload_headers: uploadHeaders,
    expires_at: expiresAt
  });

  return taskRecord;
}

function isImageFile(filename) {
  if (!filename) {
    return false;
  }

  const ext = AlistClient.getFileExtension(filename);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  return imageExtensions.includes(ext);
}

function getImageContentType(filename) {
  const ext = AlistClient.getFileExtension(filename);
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.bmp':
      return 'image/bmp';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

class AlistIngestService {
  static normalizeDescription() {
    return DEFAULT_DESCRIPTION;
  }

  static async scanTest(setting, options = {}) {
    const rootPath = AlistIngestSetting.normalizePath(setting.alist_root_path);

    await alistClient.initialize();

    const directories = await fetchDirectoryEntries(rootPath);
    const candidates = [];
    const skipped = [];

    for (const dir of directories) {
      if (!dir.is_dir) {
        continue;
      }

      const folderPath = joinAlistPath(rootPath, dir.name);
      const record = await AlistIngestRecord.findBySettingAndPath(setting.id, folderPath);
      const folderModifiedAt = dir.modified ? new Date(dir.modified) : null;
      const recordModifiedAt = record?.folder_modified_at ? new Date(record.folder_modified_at) : null;

      const folderFiles = await fetchDirectoryEntries(folderPath, 200);

      const markdownFile = folderFiles.find((file) => !file.is_dir && file.name.toLowerCase() === 'markdown.txt');
      let markdownPreview = null;
      if (markdownFile) {
        try {
          const markdownPath = joinAlistPath(folderPath, markdownFile.name);
          const markdownContent = await alistClient.getFileContent(markdownPath, 'utf-8');
          const parsed = parseMarkdownContent(markdownContent);
          markdownPreview = {
            fileName: markdownFile.name,
            descriptionPreview: parsed.description.slice(0, 200),
            tags: parsed.tags
          };
        } catch (error) {
          markdownPreview = {
            fileName: markdownFile.name,
            error: error.message
          };
        }
      }

      const allowedFiles = folderFiles.filter((file) => !file.is_dir && alistClient.isExtensionAllowed(file.name));
      const allowedDocumentFiles = allowedFiles.filter((file) => !isImageFile(file.name));
      const allImageFiles = folderFiles.filter((file) => !file.is_dir && isImageFile(file.name));

      let existingDocumentCount = 0;
      if (record?.resource_id) {
        try {
          const existingResources = await AlistResource.getByResourceId(record.resource_id);
          existingDocumentCount = existingResources.filter((file) => file && !file.is_folder && !isImageFile(file.alist_name)).length;
        } catch (error) {
          logger.warn('获取已入库资源文件失败', {
            resourceId: record.resource_id,
            error: error.message
          });
        }
      }

      const folderUnchanged =
        record
        && recordModifiedAt
        && folderModifiedAt
        && recordModifiedAt.getTime() === folderModifiedAt.getTime();

      const newDocumentCount = Math.max(allowedDocumentFiles.length - existingDocumentCount, 0);

      let type = null;
      if (!record) {
        if (allowedFiles.length > 0 || markdownPreview) {
          type = 'create';
        }
      } else if (newDocumentCount > 0) {
        type = 'update';
      }

      if (!type) {
        const reason = folderUnchanged ? '未修改' : (record ? '无可更新文件' : '未发现可入库文件');
        skipped.push({
          folder: folderPath,
          reason
        });
        continue;
      }

      candidates.push({
        folderName: dir.name,
        folderPath,
        directory: dir,
        markdown: markdownPreview,
        allowedDocumentFiles,
        allImageFiles,
        existingRecord: record,
        newDocumentCount,
        type
      });
    }

    if (candidates.length === 0) {
      return {
        totalFolders: skipped.length,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: skipped.length,
        created: [],
        updated: [],
        skipped,
        errors: []
      };
    }

    const created = candidates
      .filter((item) => item.type === 'create')
      .map((item) => ({
        folder: item.folderPath,
        markdown: item.markdown ? 'true' : 'false',
        images: item.allImageFiles.length.toString(),
        documents: item.allowedDocumentFiles.length.toString()
      }));

    const updated = candidates
      .filter((item) => item.type === 'update')
      .map((item) => ({
        folder: item.folderPath,
        updated_documents: item.newDocumentCount.toString()
      }));

    return {
      totalFolders: candidates.length + skipped.length,
      createdCount: created.length,
      updatedCount: updated.length,
      skippedCount: skipped.length,
      created,
      updated,
      skipped,
      errors: []
    };
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

        const files = await fetchDirectoryEntries(folderPath);

        let baseDescription = DEFAULT_DESCRIPTION;
        let tagNames = [];

        const markdownFile = files.find((file) => !file.is_dir && file.name.toLowerCase() === 'markdown.txt');

        if (markdownFile) {
          try {
            const markdownPath = joinAlistPath(folderPath, markdownFile.name);
            const markdownContent = await alistClient.getFileContent(markdownPath, 'utf-8');
            const parsed = parseMarkdownContent(markdownContent);
            baseDescription = parsed.description || DEFAULT_DESCRIPTION;
            tagNames = parsed.tags || [];
          } catch (error) {
            logger.warn('读取Markdown说明失败', {
              settingId: setting.id,
              folderPath,
              error: error.message
            });
          }
        }

        const allowedFiles = files.filter((file) => !file.is_dir && alistClient.isExtensionAllowed(file.name));
        const allowedDocumentFiles = allowedFiles.filter((file) => !isImageFile(file.name));
        const imageFiles = files.filter((file) => !file.is_dir && isImageFile(file.name));

        let existingDocumentCount = 0;
        if (record?.resource_id) {
          try {
            const existingResources = await AlistResource.getByResourceId(record.resource_id);
            existingDocumentCount = existingResources.filter((file) => {
              if (!file || file.is_folder) {
                return false;
              }
              return !isImageFile(file.alist_name || '');
            }).length;
          } catch (error) {
            logger.warn('获取已入库资源文件失败', {
              resourceId: record.resource_id,
              error: error.message
            });
          }
        }

        const newDocumentCount = Math.max(allowedDocumentFiles.length - existingDocumentCount, 0);
        const folderUnchanged =
          record
          && record.folder_modified_at
          && folderModifiedAt
          && record.folder_modified_at.getTime() === folderModifiedAt.getTime();

        if (folderUnchanged && newDocumentCount === 0) {
          results.skipped.push({ folder: folderPath, reason: '未修改' });
          continue;
        }

        let resourceId = record?.resource_id || null;

        if (!resourceId) {
          const resource = await Resource.create({
            title: folderName,
            description: baseDescription,
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
            description: baseDescription,
            category_id: setting.category_id,
            resource_type_id: setting.resource_type_id,
            is_public: true,
            status: 'published',
            official: true
          });

          await AlistResource.deleteByResourceId(resourceId);
          results.updated.push({ folder: folderPath, resourceId });
        }

        const imageTasks = [];
        for (const file of imageFiles) {
          try {
            const taskRecord = await prepareImageUploadTask(setting, resourceId, folderPath, file);
            imageTasks.push(taskRecord);
          } catch (error) {
            logger.error('创建图片上传任务失败', {
              settingId: setting.id,
              folderPath,
              file: file.name,
              error: error.message
            });
          }
        }

        let finalDescription = baseDescription;
        let coverImageUrl = null;
        if (imageTasks.length > 0) {
          const imageMarkdown = imageTasks
            .map(({ file_name, file_url }) => `![${file_name}](${file_url})`)
            .join('\n');

          finalDescription = baseDescription
            ? `${baseDescription.replace(/\s+$/u, '')}\n\n${imageMarkdown}`
            : imageMarkdown;

          const randomTask = imageTasks[Math.floor(Math.random() * imageTasks.length)];
          coverImageUrl = randomTask?.file_url || null;
        }

        const updatePayload = { description: finalDescription };
        if (coverImageUrl) {
          updatePayload.cover_image_url = coverImageUrl;
        }
        await Resource.update(resourceId, updatePayload);

        let tagIds = [];
        if (tagNames.length > 0) {
          try {
            tagIds = await Tag.createOrGetTags(tagNames);
          } catch (error) {
            logger.error('创建或获取标签失败', {
              tags: tagNames,
              error: error.message
            });
          }
        }

        try {
          await Tag.syncResourceTags(resourceId, tagIds);
        } catch (error) {
          logger.error('同步资源标签失败', {
            resourceId,
            tags: tagNames,
            error: error.message
          });
        }

        let ingestedFileCount = 0;

        for (const file of files) {
          if (file.is_dir) {
            continue;
          }

          if (file.name.toLowerCase() === 'markdown.txt') {
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
          fileCount: ingestedFileCount,
          images: imageTasks.length
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

    setImmediate(() => {
      AlistIngestUploadWorker.processPending().catch((error) => {
        logger.error('处理Alist图片上传任务失败', { error: error.message });
      });
    });

    return results;
  }
}

module.exports = AlistIngestService;
