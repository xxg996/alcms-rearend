/**
 * 安全中间件
 * 包含各种安全防护措施
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

/**
 * 基础安全中间件配置
 * Source: context7-mcp on Express.js security best practices
 */
const securityMiddleware = [
  // 设置各种HTTP头以提高安全性
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  })
];

/**
 * API访问频率限制
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 15分钟内最多100个请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true, // 返回rate limit信息在headers中
  legacyHeaders: false, // 禁用X-RateLimit-*headers
});

/**
 * 认证相关API的严格限制
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 5, // 限制每个IP 15分钟内最多5次登录尝试
  message: {
    success: false,
    message: '登录尝试过于频繁，请15分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // 成功的请求不计入限制
});

/**
 * 注册验证规则
 */
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度必须在3-50个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('请输入有效的邮箱地址'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码长度至少6个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个大写字母、一个小写字母和一个数字'),
  
  body('nickname')
    .optional()
    .isLength({ max: 100 })
    .withMessage('昵称长度不能超过100个字符')
];

/**
 * 登录验证规则
 */
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('请输入有效的邮箱地址'),
  
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
];

/**
 * 用户资料更新验证规则
 */
const profileUpdateValidation = [
  body('nickname')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('昵称长度必须在1-100个字符之间'),
  
  body('avatar_url')
    .optional()
    .isURL()
    .withMessage('头像URL格式不正确')
    .isLength({ max: 500 })
    .withMessage('头像URL长度不能超过500个字符'),
  
  body('bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('个人简介长度不能超过500个字符')
];

/**
 * 验证结果处理中间件
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '输入验证失败',
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      }))
    });
  }
  
  next();
};

/**
 * CORS配置
 */
const corsOptions = {
  origin: function (origin, callback) {
    // 在生产环境中，应该设置具体的允许域名
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允许的来源'));
    }
  },
  credentials: true, // 允许发送cookies
  optionsSuccessStatus: 200
};

/**
 * 请求体大小限制
 */
const bodySizeLimit = '10mb';

/**
 * SQL注入防护中间件
 */
const sqlInjectionProtection = (req, res, next) => {
  const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|;|\/\*|\*\/|xp_|sp_)/gi,
    /(\b(OR|AND)\b.*[=<>].*(\b(OR|AND)\b))/gi
  ];

  const checkInput = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        for (const pattern of suspiciousPatterns) {
          if (pattern.test(obj[key])) {
            return true;
          }
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkInput(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (req.body && checkInput(req.body)) {
    return res.status(400).json({
      success: false,
      message: '输入包含非法字符'
    });
  }

  if (req.query && checkInput(req.query)) {
    return res.status(400).json({
      success: false,
      message: '查询参数包含非法字符'
    });
  }

  next();
};

/**
 * XSS防护中间件
 */
const xssProtection = (req, res, next) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi
  ];

  const sanitizeInput = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        for (const pattern of xssPatterns) {
          obj[key] = obj[key].replace(pattern, '');
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitizeInput(obj[key]);
      }
    }
  };

  if (req.body) {
    sanitizeInput(req.body);
  }

  next();
};

module.exports = {
  securityMiddleware,
  apiLimiter,
  authLimiter,
  registerValidation,
  loginValidation,
  profileUpdateValidation,
  handleValidationErrors,
  corsOptions,
  bodySizeLimit,
  sqlInjectionProtection,
  xssProtection
};
