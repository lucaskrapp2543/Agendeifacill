#!/usr/bin/env node

// Script para limpar cache e configurações problemáticas do Cursor/VSCode

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Limpando cache e configurações...\n');

// Função para remover diretório recursivamente
const rmdirRecursive = (dir) => {
  if (fs.existsSync(dir)) {
    try {
      execSync(`rmdir /s /q "${dir}"`, { stdio: 'ignore' });
      console.log(`✅ Removido: ${dir}`);
    } catch (error) {
      console.log(`⚠️  Erro ao remover: ${dir}`);
    }
  }
};

// Limpar cache do Vite
console.log('📁 Limpando cache do Vite...');
const viteCache = path.join(__dirname, '..', 'node_modules', '.vite');
rmdirRecursive(viteCache);

// Limpar cache do éditor  
console.log('📁 Limpando cache do editor...');
const editorCache = path.join(__dirname, '..', '.eslintcache');
if (fs.existsSync(editorCache)) {
  try {
    fs.unlinkSync(editorCache);
    console.log('✅ Removido .eslintcache');
  } catch (error) {
    console.log('⚠️  Erro ao remover .eslintcache');
  }
}

// Limpar dist se existir
console.log('📁 Verificando pasta dist...');
const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  rmdirRecursive(distDir);
}

console.log('\n✨ Limpeza concluída! Agora reinicie o Cursor.\n');

console.log('📋 Próximos passos:');
console.log('1. Feche o Cursor completamente');
console.log('2. Reabra o projeto');
console.log('3. Execute: npm install');
console.log('4. Execute: npm run dev');

