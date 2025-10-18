/**
 * Alist API客户端
 * 基于Alist公开API文档实现文件管理功能
 */

const axios = require('axios');
const SystemSetting = require('../models/SystemSetting');
const { logger } = require('./logger');

class AlistClient {
  constructor() {
    this.config = null;
    this.client = null;
  }

  /**
   * 初始化客户端配置
   */
  async initialize() {
    try {
      this.config = await SystemSetting.getSetting('alist_config');

      if (!this.config || !this.config.enabled) {
        throw new Error('Alist功能未启用');
      }

      if (!this.config.base_url || !this.config.username || !this.config.password) {
        throw new Error('Alist配置不完整，请检查base_url、username、password');
      }

      // 创建axios实例
      this.client = axios.create({
        baseURL: this.config.base_url,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // 添加请求拦截器，自动添加token
      this.client.interceptors.request.use(async (config) => {
        const token = await this.ensureValidToken();
        if (token) {
          config.headers['Authorization'] = token;
        }
        return config;
      });

      logger.info('Alist客户端初始化成功', { baseURL: this.config.base_url });
    } catch (error) {
      logger.error('Alist客户端初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保Token有效
   */
  async ensureValidToken() {
    const now = Date.now();

    // 从数据库获取token信息
    const tokenExpires = this.config.token_expires_at ? new Date(this.config.token_expires_at).getTime() : 0;

    if (!this.config.access_token || now >= tokenExpires) {
      await this.login();
      // 重新获取更新后的配置
      this.config = await SystemSetting.getSetting('alist_config');
    }

    return this.config.access_token;
  }

  /**
   * 登录获取Token
   */
  async login() {
    try {
      const response = await axios.post(`${this.config.base_url}/api/auth/login`, {
        username: this.config.username,
        password: this.config.password
      });

      if (response.data.code !== 200) {
        throw new Error(`登录失败: ${response.data.message}`);
      }

      const token = response.data.data.token;
      const tokenExpiresHours = this.config.token_expires || 48; // 默认48小时
      const tokenExpiresAt = new Date(Date.now() + (tokenExpiresHours * 60 * 60 * 1000));

      // 将token信息存储到数据库配置中
      const updatedConfig = {
        ...this.config,
        access_token: token,
        token_expires_at: tokenExpiresAt.toISOString(),
        last_token_refresh: new Date().toISOString()
      };

      await SystemSetting.upsertSetting(
        'alist_config',
        updatedConfig,
        'Alist文件存储系统配置',
        null // 系统自动更新，不指定用户
      );

      // 更新本地配置
      this.config = updatedConfig;

      logger.info('Alist登录成功，token已存储到数据库', {
        username: this.config.username,
        expires: tokenExpiresAt.toISOString(),
        tokenLength: token.length
      });

    } catch (error) {
      logger.error('Alist登录失败:', error);
      throw new Error(`Alist登录失败: ${error.message}`);
    }
  }

  /**
   * 强制刷新Token（用于定时任务）
   */
  async forceRefreshToken() {
    try {
      logger.info('开始强制刷新Alist token');

      // 重新初始化以获取最新配置
      await this.initialize();

      // 强制登录获取新token
      await this.login();

      logger.info('Alist token强制刷新成功');
      return true;
    } catch (error) {
      logger.error('Alist token强制刷新失败:', error);
      return false;
    }
  }

  /**
   * 检查是否需要刷新alist-token（39小时检查）
   */
  async shouldRefreshToken() {
    try {
      const config = await SystemSetting.getSetting('alist_config');
      if (!config || !config.last_token_refresh) {
        return true; // 没有刷新记录，需要刷新
      }

      const lastRefresh = new Date(config.last_token_refresh).getTime();
      const now = Date.now();
      const refreshInterval = 39 * 60 * 60 * 1000; // 39小时的毫秒数

      return (now - lastRefresh) >= refreshInterval;
    } catch (error) {
      logger.error('检查alist-token刷新状态失败:', error);
      return true; // 出错时默认需要刷新
    }
  }

  /**
   * 定时刷新alist-token任务
   */
  async tokenRefreshTask() {
    try {
      const needsRefresh = await this.shouldRefreshToken();

      if (needsRefresh) {
        const success = await this.forceRefreshToken();
        if (success) {
          logger.info('alist-t定时token刷新任务完成');
        } else {
          logger.warn('alist-t定时token刷新任务失败');
        }
      } else {
        logger.info('alist-token仍然有效，跳过刷新');
      }
    } catch (error) {
      logger.error('alist-t定时token刷新任务异常:', error);
    }
  }

  /**
   * 获取文件/目录详情
   */
  async getFileInfo(path) {
    try {
      await this.initialize();

      const response = await this.client.post('/api/fs/get', {
        path: path,
        password: ''
      });

      if (response.data.code !== 200) {
        throw new Error(`获取文件信息失败: ${response.data.message}`);
      }

      const fileInfo = response.data.data;

      return {
        name: fileInfo.name,
        size: fileInfo.size,
        is_dir: fileInfo.is_dir,
        modified: fileInfo.modified,
        sign: fileInfo.sign,
        thumb: fileInfo.thumb,
        type: fileInfo.type,
        raw_url: fileInfo.raw_url,
        readme: fileInfo.readme,
        provider: fileInfo.provider,
        related: fileInfo.related
      };

    } catch (error) {
      logger.error('获取Alist文件信息失败:', error);
      throw error;
    }
  }

  /**
   * 列出目录内容
   */
  async listDirectory(path, page = 1, perPage = 100) {
    try {
      await this.initialize();

      const response = await this.client.post('/api/fs/list', {
        path: path,
        password: '',
        page: page,
        per_page: perPage,
        refresh: false
      });

      if (response.data.code !== 200) {
        throw new Error(`获取目录列表失败: ${response.data.message}`);
      }

      const data = response.data.data;

      return {
        content: data.content || [],
        total: data.total || 0,
        readme: data.readme || '',
        write: data.write || false,
        provider: data.provider || ''
      };

    } catch (error) {
      logger.error('获取Alist目录列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取下载链接（通过API调用）
   */
  async getDownloadLink(path) {
    try {
      await this.initialize();

      const response = await this.client.post('/api/fs/link', {
        path: path,
        password: ''
      });

      if (response.data.code !== 200) {
        throw new Error(`获取下载链接失败: ${response.data.message}`);
      }

      const linkData = response.data.data;

      return {
        url: linkData.url,
        header: linkData.header || {},
        method: linkData.method || 'GET',
        type: linkData.type || 0,
        expire: linkData.expire || 0
      };

    } catch (error) {
      logger.error('获取Alist下载链接失败:', error);
      throw error;
    }
  }

  /**
   * 生成直接下载链接（使用Alist的sign参数）
   */
  async generateDirectDownloadLink(path) {
    try {
      // 先初始化Alist客户端配置
      await this.initialize();

      if (!this.config || !this.config.base_url) {
        throw new Error('Alist配置未初始化');
      }

      // 先获取文件信息和Alist的签名
      const fileInfo = await this.getFileInfo(path);

      if (!fileInfo.sign) {
        throw new Error('无法获取Alist文件签名');
      }

      // 移除开头的斜杠并编码路径
      const cleanPath = path.startsWith('/') ? path.substring(1) : path;
      const encodedPath = encodeURIComponent(cleanPath).replace(/%2F/g, '/');

      // 解析Alist的sign格式（通常为 "sign_string:timestamp"）
      const [signValue, expireTime] = fileInfo.sign.split(':');
      const expireTimestamp = expireTime ? parseInt(expireTime) : (Math.floor(Date.now() / 1000) + 1800);

      // 生成带Alist签名的下载链接
      // 优先使用专用的下载域名，如果没有配置则使用base_url
      const downloadDomain = this.config.download_domain || this.config.base_url;
      const baseUrl = downloadDomain.replace(/\/$/, ''); // 移除末尾斜杠
      const downloadUrl = `${baseUrl}/d/${encodedPath}?sign=${fileInfo.sign}`;

      logger.info('生成带Alist签名的直接下载链接', {
        originalPath: path,
        cleanPath,
        encodedPath,
        downloadDomain: this.config.download_domain ? 'custom' : 'base_url',
        usedDomain: baseUrl,
        alistSign: signValue.substring(0, 16) + '...',
        expireTime: expireTimestamp,
        downloadUrl
      });

      return {
        url: downloadUrl,
        method: 'GET',
        type: 'direct',
        expire: expireTimestamp * 1000,
        sign: fileInfo.sign,
        fileInfo: {
          name: fileInfo.name,
          size: fileInfo.size,
          is_dir: fileInfo.is_dir,
          modified: fileInfo.modified
        }
      };

    } catch (error) {
      logger.error('生成直接下载链接失败:', error);
      throw error;
    }
  }


  /**
   * 搜索文件
   */
  async searchFiles(keywords, path = '/', scope = 0, page = 1, perPage = 100) {
    try {
      await this.initialize();

      const response = await this.client.post('/api/fs/search', {
        parent: path,
        keywords: keywords,
        scope: scope, // 0: 仅当前目录, 1: 递归搜索
        page: page,
        per_page: perPage
      });

      if (response.data.code !== 200) {
        throw new Error(`搜索文件失败: ${response.data.message}`);
      }

      return response.data.data || [];

    } catch (error) {
      logger.error('搜索Alist文件失败:', error);
      throw error;
    }
  }

  /**
   * 验证文件路径是否存在
   */
  async pathExists(path) {
    try {
      await this.getFileInfo(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 获取文件扩展名
  */
  static getFileExtension(filename) {
    if (!filename || filename.lastIndexOf('.') === -1) {
      return '';
    }
    return filename.toLowerCase().substring(filename.lastIndexOf('.'));
  }

  /**
   * 检查文件扩展名是否被允许
   */
  isExtensionAllowed(filename) {
    const extension = AlistClient.getFileExtension(filename);
    const allowed = Array.isArray(this.config?.allowed_extensions)
      ? this.config.allowed_extensions.map((item) => item.toLowerCase())
      : null;

    if (!allowed || allowed.length === 0) {
      return true;
    }

    return allowed.includes(extension);
  }

  /**
   * 检查文件大小是否超限
   */
  isFileSizeAllowed(fileSize) {
    return fileSize <= this.config.max_file_size;
  }

  /**
   * 获取文件原始内容
   * @param {string} path 文件在Alist中的路径
   * @param {string} [encoding='utf-8'] 返回内容编码
   * @returns {Promise<string|Buffer>}
   */
  async getFileContent(path, encoding = 'utf-8') {
    await this.initialize();

    const fileInfo = await this.getFileInfo(path);

    if (!fileInfo.raw_url) {
      throw new Error('该文件无法获取原始内容链接');
    }

    const response = await this.client.get(fileInfo.raw_url, {
      responseType: 'arraybuffer'
    });

    const buffer = Buffer.from(response.data);
    return encoding ? buffer.toString(encoding) : buffer;
  }
}

// 创建单例实例
const alistClient = new AlistClient();

module.exports = {
  alistClient,
  AlistClient
};
