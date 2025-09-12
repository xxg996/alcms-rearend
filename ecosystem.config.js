/**
 * PM2 生产环境集群配置
 * 充分利用多核CPU，实现高可用部署
 */

module.exports = {
  apps: [
    {
      name: 'alcms-backend',
      script: './src/app.js',
      instances: 'max', // 使用所有CPU核心
      exec_mode: 'cluster', // 集群模式
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // 性能优化配置
      max_memory_restart: '500M', // 内存超过500M重启
      min_uptime: '10s', // 最小运行时间
      max_restarts: 10, // 最大重启次数
      
      // 日志配置
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      
      // 监控配置
      watch: false, // 生产环境不启用文件监控
      ignore_watch: ['node_modules', 'logs', '*.log'],
      
      // 优雅关闭
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 3000
    },
    {
      name: 'alcms-backend-dev',
      script: './src/app.js',
      instances: 2, // 开发环境使用2个实例
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: true, // 开发环境启用文件监控
      ignore_watch: ['node_modules', 'logs', '*.log'],
      max_memory_restart: '300M'
    }
  ],

  // 部署配置
  deploy: {
    production: {
      user: 'node',
      host: 'production-server',
      ref: 'origin/main',
      repo: 'git@github.com:username/alcms-rearend.git',
      path: '/var/www/alcms-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};