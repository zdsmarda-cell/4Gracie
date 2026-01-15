
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDate = new Date();
// Format: YYYYMMDD-HHmm
const version = `${buildDate.getFullYear()}${(buildDate.getMonth()+1).toString().padStart(2, '0')}${buildDate.getDate().toString().padStart(2, '0')}-${buildDate.getHours().toString().padStart(2, '0')}${buildDate.getMinutes().toString().padStart(2, '0')}`;

console.log(`🚀 Preparing build version: ${version}`);

// 1. Create public/version.json
const versionFilePath = path.join(__dirname, 'public', 'version.json');
fs.writeFileSync(versionFilePath, JSON.stringify({ version, buildDate: buildDate.toISOString() }, null, 2));
console.log(`✅ Created public/version.json`);

// 2. Update public/sw.js to force cache bust
const swFilePath = path.join(__dirname, 'public', 'sw.js');
if (fs.existsSync(swFilePath)) {
    let swContent = fs.readFileSync(swFilePath, 'utf8');
    
    // Replace CACHE_NAME
    // Regex matches: const CACHE_NAME = '...';
    const cacheNameRegex = /const\s+CACHE_NAME\s*=\s*['"`].*['"`];/;
    const newCacheLine = `const CACHE_NAME = '4gracie-v${version}';`;
    
    if (cacheNameRegex.test(swContent)) {
        swContent = swContent.replace(cacheNameRegex, newCacheLine);
    } else {
        // Fallback if not found, prepend it
        swContent = `${newCacheLine}\n${swContent}`;
    }

    // Add/Update build comment at the end
    const commentMarker = '// BUILD_VERSION:';
    if (swContent.includes(commentMarker)) {
        swContent = swContent.replace(new RegExp(`${commentMarker}.*`), `${commentMarker} ${version}`);
    } else {
        swContent += `\n${commentMarker} ${version}`;
    }

    fs.writeFileSync(swFilePath, swContent);
    console.log(`✅ Updated public/sw.js cache name`);
} else {
    console.warn(`⚠️ public/sw.js not found!`);
}
