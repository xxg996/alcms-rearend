#!/usr/bin/env node

/**
 * 自动替换console.log的脚本
 * 将所有console.log替换为结构化日志记录
 */

const fs = require('fs');
const path = require('path');

// 需要处理的文件扩展名
const extensions = ['.js'];

// 忽略的目录
const ignoreDirs = ['node_modules', 'logs', '.git', 'dist', 'build'];

// console方法映射
const consoleMethods = {
  'console.log': 'logger.info',
  'console.info': 'logger.info', 
  'console.warn': 'logger.warn',
  'console.error': 'logger.error',
  'console.debug': 'logger.debug'
};

/**
 * 递归获取所有JS文件
 */
function getAllJSFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过忽略的目录
      if (!ignoreDirs.includes(file)) {
        getAllJSFiles(filePath, fileList);
      }
    } else if (extensions.includes(path.extname(file))) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

/**
 * 处理单个文件
 */
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let hasLogger = false;
    
    // 检查是否已经导入了logger
    if (content.includes("require('../utils/logger')") || 
        content.includes("require('./utils/logger')") ||
        content.includes('const { logger }') ||
        content.includes('const logger')) {
      hasLogger = true;
    }
    
    // 统计替换次数
    let replacements = 0;
    
    // 替换console方法
    for (const [oldMethod, newMethod] of Object.entries(consoleMethods)) {
      const regex = new RegExp(`\\b${oldMethod.replace('.', '\\.')}\\s*\\(`, 'g');
      const matches = content.match(regex);
      
      if (matches) {
        content = content.replace(regex, `${newMethod}(`);
        replacements += matches.length;
        modified = true;
      }
    }
    
    // 如果有替换且没有导入logger，则添加导入
    if (modified && !hasLogger) {
      // 计算相对路径
      const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '../src/utils/logger'));
      const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
      
      // 在文件顶部添加logger导入
      const lines = content.split('\n');
      let insertIndex = 0;
      
      // 找到合适的插入位置（在已有require之后）
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('const ') && lines[i].includes('require(')) {
          insertIndex = i + 1;
        } else if (lines[i].trim().startsWith('require(')) {
          insertIndex = i + 1;
        } else if (lines[i].trim() === '' && insertIndex > 0) {
          break;
        }
      }
      
      // 插入logger导入
      const loggerImport = `const { logger } = require('${importPath}');`;
      lines.splice(insertIndex, 0, loggerImport);
      content = lines.join('\n');
    }
    
    // 写回文件
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ ${filePath}: 替换了 ${replacements} 个console调用`);
      return replacements;
    }
    
    return 0;
  } catch (error) {
    console.error(`❌ 处理文件失败 ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * 主函数
 */
function main() {
  console.log('🚀 开始替换console.log为结构化日志...\n');
  
  const rootDir = path.join(__dirname, '..');
  const jsFiles = getAllJSFiles(path.join(rootDir, 'src'));
  
  let totalReplacements = 0;
  let processedFiles = 0;
  
  jsFiles.forEach(filePath => {
    const replacements = processFile(filePath);
    if (replacements > 0) {
      processedFiles++;
      totalReplacements += replacements;
    }
  });
  
  console.log('\n📊 替换统计:');
  console.log(`- 处理的文件数: ${processedFiles}`);
  console.log(`- 总替换次数: ${totalReplacements}`);
  console.log(`- 扫描的文件数: ${jsFiles.length}`);
  
  if (totalReplacements > 0) {
    console.log('\n✅ console.log替换完成！');
    console.log('💡 建议: 运行项目并检查日志输出是否正常');
  } else {
    console.log('\n📝 没有找到需要替换的console.log');
  }
}

// 运行脚本
if (require.main === module) {
  main();
}

module.exports = { processFile, getAllJSFiles };