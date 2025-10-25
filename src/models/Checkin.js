/**
 * 签到系统数据模型
 * 处理用户签到、签到配置等相关数据操作
 */

const { query, getClient } = require('../config/database');
const Points = require('./Points');

class Checkin {
  /**
   * 获取当前激活的签到配置
   */
  static async getActiveConfig() {
    const queryStr = `
      SELECT * FROM checkin_configs 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await query(queryStr);
    return result.rows[0];
  }

  /**
   * 获取所有签到配置（包含角色信息）
   */
  static async getAllConfigs() {
    // 先获取基本配置信息
    const configsQueryStr = `
      SELECT
        cc.*,
        u.username as created_by_username
      FROM checkin_configs cc
      LEFT JOIN users u ON cc.created_by = u.id
      ORDER BY cc.created_at DESC
    `;
    const configsResult = await query(configsQueryStr);
    const configs = configsResult.rows;

    // 然后为每个配置获取角色信息
    for (const config of configs) {
      const rolesQueryStr = `
        SELECT role_name
        FROM checkin_config_roles
        WHERE checkin_config_id = $1
        ORDER BY created_at
      `;
      const rolesResult = await query(rolesQueryStr, [config.id]);
      config.roles = rolesResult.rows.map(row => row.role_name);
    }

    return configs;
  }

  /**
   * 创建签到配置（支持角色绑定）
   */
  static async createConfig(configData, createdBy = null) {
    const {
      name,
      description,
      daily_points = 10,
      consecutive_bonus = {},
      monthly_reset = true,
      roles = []
    } = configData;

    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 创建签到配置
      const configQueryStr = `
        INSERT INTO checkin_configs
        (name, description, daily_points, consecutive_bonus, monthly_reset, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const configValues = [name, description, daily_points, consecutive_bonus, monthly_reset, createdBy];
      const configResult = await client.query(configQueryStr, configValues);
      const config = configResult.rows[0];

      // 添加角色绑定
      if (roles && roles.length > 0) {
        for (const role of roles) {
          const roleQueryStr = `
            INSERT INTO checkin_config_roles (checkin_config_id, role_name, created_by)
            VALUES ($1, $2, $3)
          `;
          await client.query(roleQueryStr, [config.id, role, createdBy]);
        }
      }

      await client.query('COMMIT');

      // 返回包含角色信息的配置
      return { ...config, roles };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 更新签到配置（支持角色绑定）
   */
  static async updateConfig(configId, updateData) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      const { roles, ...configData } = updateData;

      // 更新配置基本信息
      if (Object.keys(configData).length > 0) {
        const fields = [];
        const values = [];
        let paramCount = 1;

        Object.keys(configData).forEach(key => {
          if (configData[key] !== undefined) {
            fields.push(`${key} = $${paramCount}`);
            values.push(configData[key]);
            paramCount++;
          }
        });

        values.push(configId);
        const queryStr = `
          UPDATE checkin_configs
          SET ${fields.join(', ')}
          WHERE id = $${paramCount}
          RETURNING *
        `;
        await client.query(queryStr, values);
      }

      // 更新角色绑定
      if (roles !== undefined) {
        // 删除现有角色绑定
        await client.query(
          'DELETE FROM checkin_config_roles WHERE checkin_config_id = $1',
          [configId]
        );

        // 添加新的角色绑定
        if (roles && roles.length > 0) {
          for (const role of roles) {
            await client.query(
              'INSERT INTO checkin_config_roles (checkin_config_id, role_name) VALUES ($1, $2)',
              [configId, role]
            );
          }
        }
      }

      await client.query('COMMIT');

      // 返回更新后的配置信息
      const result = await this.getConfigById(configId);
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 根据ID获取单个签到配置（包含角色信息）
   */
  static async getConfigById(configId) {
    // 先获取基本配置信息
    const configQueryStr = `
      SELECT
        cc.*,
        u.username as created_by_username
      FROM checkin_configs cc
      LEFT JOIN users u ON cc.created_by = u.id
      WHERE cc.id = $1
    `;
    const configResult = await query(configQueryStr, [configId]);
    const config = configResult.rows[0];

    if (config) {
      // 获取角色信息
      const rolesQueryStr = `
        SELECT role_name
        FROM checkin_config_roles
        WHERE checkin_config_id = $1
        ORDER BY created_at
      `;
      const rolesResult = await query(rolesQueryStr, [configId]);
      config.roles = rolesResult.rows.map(row => row.role_name);
    }

    return config;
  }

  /**
   * 获取用户可用的签到配置（根据用户角色过滤）
   */
  static async getAvailableConfigForUser(userRoles = ['user']) {
    // 确保userRoles是数组
    if (!Array.isArray(userRoles)) {
      userRoles = [userRoles];
    }

    // 构建角色匹配条件
    const rolePlaceholders = userRoles.map((_, index) => `$${index + 1}`).join(', ');

    // 使用子查询避免DISTINCT在JSON字段上的问题
    const queryStr = `
      SELECT
        cc.*,
        u.username as created_by_username
      FROM checkin_configs cc
      LEFT JOIN users u ON cc.created_by = u.id
      WHERE cc.is_active = true
        AND cc.id IN (
          SELECT DISTINCT config_id FROM (
            SELECT cc2.id as config_id
            FROM checkin_configs cc2
            WHERE cc2.is_active = true
              AND NOT EXISTS (
                SELECT 1 FROM checkin_config_roles
                WHERE checkin_config_id = cc2.id
              )
            UNION
            SELECT ccr.checkin_config_id as config_id
            FROM checkin_config_roles ccr
            JOIN checkin_configs cc3 ON ccr.checkin_config_id = cc3.id
            WHERE cc3.is_active = true
              AND ccr.role_name IN (${rolePlaceholders})
          ) as available_configs
        )
      ORDER BY cc.created_at DESC
      LIMIT 1
    `;

    const queryParams = userRoles;
    const result = await query(queryStr, queryParams);
    return result.rows[0];
  }

  /**
   * 获取配置绑定的角色列表
   */
  static async getConfigRoles(configId) {
    const queryStr = `
      SELECT
        ccr.*,
        u.username as created_by_username
      FROM checkin_config_roles ccr
      LEFT JOIN users u ON ccr.created_by = u.id
      WHERE ccr.checkin_config_id = $1
      ORDER BY ccr.created_at
    `;
    const result = await query(queryStr, [configId]);
    return result.rows;
  }

  /**
   * 为配置添加角色绑定
   */
  static async addConfigRole(configId, roleName, createdBy = null) {
    const queryStr = `
      INSERT INTO checkin_config_roles (checkin_config_id, role_name, created_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (checkin_config_id, role_name) DO NOTHING
      RETURNING *
    `;
    const result = await query(queryStr, [configId, roleName, createdBy]);
    return result.rows[0];
  }

  /**
   * 删除配置的角色绑定
   */
  static async removeConfigRole(configId, roleName) {
    const queryStr = `
      DELETE FROM checkin_config_roles
      WHERE checkin_config_id = $1 AND role_name = $2
      RETURNING *
    `;
    const result = await query(queryStr, [configId, roleName]);
    return result.rows[0];
  }

  /**
   * 删除签到配置
   */
  static async deleteConfig(configId) {
    // 首先检查配置是否存在
    const checkQueryStr = `
      SELECT id, is_active FROM checkin_configs
      WHERE id = $1
    `;
    const checkResult = await query(checkQueryStr, [configId]);

    if (checkResult.rows.length === 0) {
      throw new Error('签到配置不存在');
    }

    const config = checkResult.rows[0];

    // 检查是否为激活状态的配置
    if (config.is_active) {
      throw new Error('无法删除正在使用的配置，请先停用该配置');
    }

    // 执行删除操作
    const deleteQueryStr = `
      DELETE FROM checkin_configs
      WHERE id = $1 AND is_active = false
      RETURNING *
    `;
    const result = await query(deleteQueryStr, [configId]);

    if (result.rows.length === 0) {
      throw new Error('删除失败，配置可能正在使用中');
    }

    return result.rows[0];
  }

  /**
   * 获取用户今日签到状态
   */
  static async getTodayCheckinStatus(userId) {
    const today = new Date().toISOString().split('T')[0];
    
    const queryStr = `
      SELECT * FROM user_checkins 
      WHERE user_id = $1 AND checkin_date = $2
    `;
    const result = await query(queryStr, [userId, today]);
    return result.rows[0];
  }

  /**
   * 获取用户连续签到天数
   */
  static async getUserConsecutiveDays(userId) {
    const queryStr = `
      SELECT consecutive_days, checkin_date
      FROM user_checkins
      WHERE user_id = $1
      ORDER BY checkin_date DESC
      LIMIT 1
    `;
    const result = await query(queryStr, [userId]);
    
    if (result.rows.length === 0) {
      return 0;
    }

    const lastCheckin = result.rows[0];
    const lastDate = new Date(lastCheckin.checkin_date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // 格式化日期为 YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];
    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(yesterday);
    const lastCheckinStr = formatDate(lastDate);

    // 如果上次签到是今天，返回当前连续天数
    if (lastCheckinStr === todayStr) {
      return lastCheckin.consecutive_days;
    }
    
    // 如果上次签到是昨天，连续天数有效
    if (lastCheckinStr === yesterdayStr) {
      return lastCheckin.consecutive_days;
    }
    
    // 否则连续签到中断
    return 0;
  }

  /**
   * 执行用户签到（支持角色绑定配置）
   */
  static async performCheckin(userId, userRoles = ['user']) {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 检查今日是否已签到
      const todayStatus = await this.getTodayCheckinStatus(userId);
      if (todayStatus) {
        throw new Error('今日已签到');
      }

      // 获取用户可用的签到配置
      const config = await this.getAvailableConfigForUser(userRoles);
      if (!config) {
        throw new Error('签到功能未配置或您没有权限使用');
      }

      // 获取连续签到天数
      const consecutiveDays = await this.getUserConsecutiveDays(userId);
      const newConsecutiveDays = consecutiveDays + 1;

      // 计算本次签到积分
      let pointsEarned = config.daily_points;
      let bonusPoints = 0;
      let isBonus = false;

      // 检查连续签到奖励
      if (config.consecutive_bonus && Object.keys(config.consecutive_bonus).length > 0) {
        const bonusConfig = config.consecutive_bonus;
        
        // 查找适用的连续签到奖励
        const eligibleDays = Object.keys(bonusConfig)
          .map(Number)
          .filter(days => newConsecutiveDays >= days && newConsecutiveDays % days === 0)
          .sort((a, b) => b - a);

        if (eligibleDays.length > 0) {
          const bonusDays = eligibleDays[0];
          bonusPoints = bonusConfig[bonusDays] || 0;
          isBonus = bonusPoints > 0;
        }
      }

      const totalPoints = pointsEarned + bonusPoints;

      // 记录签到
      const today = new Date().toISOString().split('T')[0];
      const checkinQuery = `
        INSERT INTO user_checkins 
        (user_id, checkin_date, points_earned, consecutive_days, is_bonus, bonus_points, config_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const checkinValues = [userId, today, pointsEarned, newConsecutiveDays, isBonus, bonusPoints, config.id];
      const checkinResult = await client.query(checkinQuery, checkinValues);

      // 增加用户积分
      let pointsResult = null;
      if (totalPoints > 0) {
        const description = isBonus 
          ? `每日签到+${pointsEarned}积分，连续${newConsecutiveDays}天奖励+${bonusPoints}积分`
          : `每日签到获得${pointsEarned}积分`;
        
        pointsResult = await Points.addPoints(
          userId, 
          totalPoints, 
          'checkin', 
          description, 
          checkinResult.rows[0].id, 
          'checkin'
        );
      }

      await client.query('COMMIT');

      return {
        checkin: checkinResult.rows[0],
        points: pointsResult,
        total_points: totalPoints,
        is_bonus: isBonus,
        consecutive_days: newConsecutiveDays
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 获取用户签到历史
   */
  static async getUserCheckinHistory(userId, limit = 30, offset = 0) {
    const queryStr = `
      SELECT 
        uc.id,
        uc.user_id,
        TO_CHAR(uc.checkin_date, 'YYYY-MM-DD') AS checkin_date,
        uc.points_earned,
        uc.consecutive_days,
        uc.is_bonus,
        uc.bonus_points,
        uc.config_id,
        TO_CHAR(uc.created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS.US') AS created_at,
        cc.name as config_name,
        cc.daily_points as config_daily_points
      FROM user_checkins uc
      LEFT JOIN checkin_configs cc ON uc.config_id = cc.id
      WHERE uc.user_id = $1
      ORDER BY uc.checkin_date DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await query(queryStr, [userId, limit, offset]);
    return result.rows;
  }

  /**
   * 获取用户签到统计
   */
  static async getUserCheckinStats(userId) {
    const queryStr = `
      SELECT 
        COUNT(*) as total_checkins,
        SUM(points_earned + bonus_points) as total_points_earned,
        MAX(consecutive_days) as max_consecutive_days,
        COUNT(CASE WHEN is_bonus = true THEN 1 END) as bonus_count,
        MIN(checkin_date) as first_checkin_date,
        MAX(checkin_date) as last_checkin_date
      FROM user_checkins 
      WHERE user_id = $1
    `;
    const result = await query(queryStr, [userId]);
    
    // 获取当前连续签到天数
    const consecutiveDays = await this.getUserConsecutiveDays(userId);
    
    return {
      ...result.rows[0],
      current_consecutive_days: consecutiveDays,
      checked_in_today: !!(await this.getTodayCheckinStatus(userId))
    };
  }

  /**
   * 获取签到排行榜
   */
  static async getCheckinLeaderboard(type = 'consecutive', limit = 50) {
    let queryStr;
    
    if (type === 'consecutive') {
      // 当前连续签到天数排行
      queryStr = `
        SELECT 
          u.id,
          u.username,
          u.nickname,
          u.avatar_url,
          uc.consecutive_days,
          uc.checkin_date as last_checkin_date
        FROM (
          SELECT DISTINCT ON (user_id) 
            user_id,
            consecutive_days,
            checkin_date
          FROM user_checkins
          ORDER BY user_id, checkin_date DESC
        ) uc
        JOIN users u ON uc.user_id = u.id
        WHERE u.status = 'normal'
        ORDER BY uc.consecutive_days DESC, uc.checkin_date DESC
        LIMIT $1
      `;
    } else if (type === 'total') {
      // 总签到次数排行
      queryStr = `
        SELECT 
          u.id,
          u.username,
          u.nickname,
          u.avatar_url,
          COUNT(uc.id) as total_checkins,
          SUM(uc.points_earned + uc.bonus_points) as total_points_earned
        FROM users u
        JOIN user_checkins uc ON u.id = uc.user_id
        WHERE u.status = 'normal'
        GROUP BY u.id, u.username, u.nickname, u.avatar_url
        ORDER BY total_checkins DESC, total_points_earned DESC
        LIMIT $1
      `;
    } else {
      // 本月签到次数排行
      queryStr = `
        SELECT 
          u.id,
          u.username,
          u.nickname,
          u.avatar_url,
          COUNT(uc.id) as monthly_checkins,
          SUM(uc.points_earned + uc.bonus_points) as monthly_points_earned
        FROM users u
        JOIN user_checkins uc ON u.id = uc.user_id
        WHERE u.status = 'normal'
          AND uc.checkin_date >= date_trunc('month', CURRENT_DATE)
        GROUP BY u.id, u.username, u.nickname, u.avatar_url
        ORDER BY monthly_checkins DESC, monthly_points_earned DESC
        LIMIT $1
      `;
    }
    
    const result = await query(queryStr, [limit]);
    return result.rows;
  }

  /**
   * 获取签到统计数据（管理员）
   */
  static async getCheckinStatistics(dateFrom = null, dateTo = null) {
    let whereConditions = ['1=1'];
    let values = [];
    let paramCount = 1;

    if (dateFrom) {
      whereConditions.push(`checkin_date >= $${paramCount}`);
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      whereConditions.push(`checkin_date <= $${paramCount}`);
      values.push(dateTo);
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    const queryStr = `
      SELECT 
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) as total_checkins,
        SUM(points_earned + bonus_points) as total_points_distributed,
        COUNT(CASE WHEN is_bonus = true THEN 1 END) as bonus_checkins,
        AVG(consecutive_days) as avg_consecutive_days,
        MAX(consecutive_days) as max_consecutive_days
      FROM user_checkins
      WHERE ${whereClause}
    `;

    const result = await query(queryStr, values);
    return result.rows[0];
  }

  /**
   * 重置用户签到数据（管理员功能）
   */
  static async resetUserCheckins(userId) {
    const queryStr = `
      DELETE FROM user_checkins 
      WHERE user_id = $1
      RETURNING COUNT(*) as deleted_count
    `;
    const result = await query(queryStr, [userId]);
    return { deleted_count: result.rowCount };
  }

  /**
   * 补签功能（管理员或特殊权限）
   */
  static async makeupCheckin(userId, date, adminId = null) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // 检查指定日期是否已签到
      const existingQuery = `
        SELECT id FROM user_checkins 
        WHERE user_id = $1 AND checkin_date = $2
      `;
      const existingResult = await client.query(existingQuery, [userId, date]);
      
      if (existingResult.rows.length > 0) {
        throw new Error('该日期已有签到记录');
      }

      // 获取签到配置
      const config = await this.getActiveConfig();
      if (!config) {
        throw new Error('签到功能未配置');
      }

      // 补签记录
      const checkinQuery = `
        INSERT INTO user_checkins 
        (user_id, checkin_date, points_earned, consecutive_days, is_bonus, bonus_points, config_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const checkinValues = [userId, date, config.daily_points, 1, false, 0, config.id];
      const checkinResult = await client.query(checkinQuery, checkinValues);

      // 增加用户积分
      const pointsResult = await Points.addPoints(
        userId, 
        config.daily_points, 
        'makeup_checkin', 
        `补签${date}获得${config.daily_points}积分`, 
        checkinResult.rows[0].id, 
        'makeup_checkin'
      );

      await client.query('COMMIT');

      return {
        checkin: checkinResult.rows[0],
        points: pointsResult
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Checkin;
