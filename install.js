#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 SmallTalk Framework Installation');
console.log('===================================\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18 or higher is required');
  console.error(`   Current version: ${nodeVersion}`);
  console.error('   Please upgrade Node.js and try again');
  process.exit(1);
}

console.log(`✅ Node.js version: ${nodeVersion}`);

// Install core dependencies
console.log('\n📦 Installing core dependencies...');
try {
  execSync('npm install --only=prod', { stdio: 'inherit' });
  console.log('✅ Core dependencies installed');
} catch (error) {
  console.error('❌ Failed to install core dependencies');
  process.exit(1);
}

// Try to install optional dependencies
console.log('\n🔧 Installing optional dependencies...');

const optionalDeps = [
  { name: 'openai', description: 'OpenAI SDK for GPT models' },
  { name: '@anthropic-ai/sdk', description: 'Anthropic SDK for Claude models' },
  { name: '@google/generative-ai', description: 'Google SDK for Gemini models' },
  { name: 'token.js', description: 'Unified LLM SDK (if available)' },
  { name: '@modelcontextprotocol/sdk', description: 'MCP SDK for external tools' }
];

const installed = [];
const failed = [];

for (const dep of optionalDeps) {
  try {
    console.log(`   Installing ${dep.name}...`);
    execSync(`npm install ${dep.name}`, { stdio: 'pipe' });
    installed.push(dep);
    console.log(`   ✅ ${dep.name}`);
  } catch (error) {
    failed.push(dep);
    console.log(`   ⚠️  ${dep.name} (optional - skipped)`);
  }
}

// Install development dependencies if in dev mode
if (process.env.NODE_ENV !== 'production') {
  console.log('\n🛠️  Installing development dependencies...');
  try {
    execSync('npm install --only=dev', { stdio: 'inherit' });
    console.log('✅ Development dependencies installed');
  } catch (error) {
    console.log('⚠️  Some development dependencies failed to install');
  }
}

// Create .env template
console.log('\n📝 Creating environment template...');
const envTemplate = `# SmallTalk Framework Environment Variables
# Copy this file to .env and add your API keys

# LLM Provider API Keys (add at least one)
# OPENAI_API_KEY=your_openai_key_here
# ANTHROPIC_API_KEY=your_anthropic_key_here  
# GEMINI_API_KEY=your_gemini_key_here

# Framework Configuration
SMALLTALK_DEBUG=true
SMALLTALK_DEFAULT_PROVIDER=openai
SMALLTALK_DEFAULT_MODEL=gpt-4o

# Web Interface Configuration
SMALLTALK_WEB_PORT=3000
SMALLTALK_WEB_HOST=localhost
`;

fs.writeFileSync('.env.template', envTemplate);
console.log('✅ Created .env.template');

// Summary
console.log('\n📊 Installation Summary');
console.log('=======================');
console.log(`✅ Core dependencies: installed`);
console.log(`✅ Optional dependencies: ${installed.length}/${optionalDeps.length} installed`);

if (installed.length > 0) {
  console.log('\n🎉 Successfully installed:');
  installed.forEach(dep => console.log(`   • ${dep.name} - ${dep.description}`));
}

if (failed.length > 0) {
  console.log('\n⚠️  Optional dependencies not installed:');
  failed.forEach(dep => console.log(`   • ${dep.name} - ${dep.description}`));
  console.log('\n   These can be installed manually if needed:');
  failed.forEach(dep => console.log(`   npm install ${dep.name}`));
}

console.log('\n🚀 Next Steps:');
console.log('1. Copy .env.template to .env and add your API keys');
console.log('2. Run an example: npm run examples');
console.log('3. Start with: npm run example:basic');

console.log('\n✅ SmallTalk installation complete!');