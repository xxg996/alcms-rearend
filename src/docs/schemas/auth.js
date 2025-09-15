/**
 * @swagger
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - username
 *         - email
 *         - password
 *         - nickname
 *       properties:
 *         username:
 *           type: string
 *           minLength: 3
 *           maxLength: 50
 *           pattern: '^[a-zA-Z0-9_]+$'
 *           description: 用户名（只能包含字母、数字和下划线）
 *           example: "testuser"
 *         email:
 *           type: string
 *           format: email
 *           description: 邮箱地址
 *           example: "test@example.com"
 *         password:
 *           type: string
 *           minLength: 8
 *           pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'
 *           description: 密码（至少8位，包含大小写字母和数字）
 *           example: "TestPassword123"
 *         nickname:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: 用户昵称
 *           example: "测试用户"
 * 
 *     LoginRequest:
 *       type: object
 *       required:
 *         - identifier
 *         - password
 *       properties:
 *         identifier:
 *           type: string
 *           description: 用户名或邮箱
 *           example: "testuser"
 *         password:
 *           type: string
 *           description: 密码
 *           example: "TestPassword123"
 *         rememberMe:
 *           type: boolean
 *           default: false
 *           description: 是否记住登录状态（延长token有效期）
 *           example: true
 * 
 *     RefreshTokenRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: 刷新令牌
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * 
 *     AuthResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ApiResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               required:
 *                 - user
 *                 - tokens
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 tokens:
 *                   type: object
 *                   required:
 *                     - accessToken
 *                     - refreshToken
 *                     - tokenType
 *                     - expiresIn
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       description: 访问令牌
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     refreshToken:
 *                       type: string
 *                       description: 刷新令牌
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     tokenType:
 *                       type: string
 *                       description: 令牌类型
 *                       example: "Bearer"
 *                     expiresIn:
 *                       type: string
 *                       description: 访问令牌过期时间
 *                       example: "1h"
 * 
 *     TokenResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ApiResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               required:
 *                 - tokens
 *               properties:
 *                 tokens:
 *                   type: object
 *                   required:
 *                     - accessToken
 *                     - refreshToken
 *                     - tokenType
 *                     - expiresIn
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       description: 新的访问令牌
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     refreshToken:
 *                       type: string
 *                       description: 新的刷新令牌
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     tokenType:
 *                       type: string
 *                       description: 令牌类型
 *                       example: "Bearer"
 *                     expiresIn:
 *                       type: string
 *                       description: 访问令牌过期时间
 *                       example: "1h"
 * 
 *     PasswordResetRequest:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: 注册邮箱地址
 *           example: "test@example.com"
 * 
 *     ResetPasswordRequest:
 *       type: object
 *       required:
 *         - token
 *         - newPassword
 *       properties:
 *         token:
 *           type: string
 *           description: 密码重置令牌
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         newPassword:
 *           type: string
 *           minLength: 8
 *           pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)'
 *           description: 新密码（至少8位，包含大小写字母和数字）
 *           example: "NewPassword456"
 * 
 *     VerifyTokenResponse:
 *       allOf:
 *         - $ref: '#/components/schemas/ApiResponse'
 *         - type: object
 *           properties:
 *             data:
 *               type: object
 *               required:
 *                 - user
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 */