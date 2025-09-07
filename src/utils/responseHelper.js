/**
 * API 响应统一格式化工具
 */

/**
 * 成功响应
 * @param {Object} res - Express响应对象
 * @param {string} message - 成功消息
 * @param {*} data - 响应数据
 * @param {number} statusCode - HTTP状态码
 */
function successResponse(res, message, data = null, statusCode = 200) {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

/**
 * 错误响应
 * @param {Object} res - Express响应对象
 * @param {string} message - 错误消息
 * @param {number} statusCode - HTTP状态码
 * @param {*} data - 额外错误数据
 */
function errorResponse(res, message, statusCode = 400, data = null) {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
}

module.exports = {
  successResponse,
  errorResponse
};
