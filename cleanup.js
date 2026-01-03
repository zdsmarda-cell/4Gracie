
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToDelete = [
  'App.tsx',
  'constants.ts',
  'translations.ts',
  'types.ts',
  'index.tsx' 
];

const dirsToDelete = [
  'pages',
  'components',
  'context'
];

console.log('🧹 Zahajuji úklid duplicitních souborů...');

filesToDelete.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✅ Smazán soubor: ${file}`);
    } catch (e) {
      console.error(`❌ Chyba při mazání ${file}:`, e.message);
    }
  } else {
    console.log(`ℹ️  Soubor neexistuje (již čisto): ${file}`);
  }
});

dirsToDelete.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`✅ Smazána složka: ${dir}`);
    } catch (e) {
      console.error(`❌ Chyba při mazání složky ${dir}:`, e.message);
    }
  } else {
    console.log(`ℹ️  Složka neexistuje (již čisto): ${dir}`);
  }
});

console.log('✨ Úklid dokončen! Nyní běží aplikace čistě ze složky /src.');
