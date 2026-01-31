
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');
const IMAGES_DIR = path.join(UPLOAD_ROOT, 'images');

// Ensure directory exists
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

export const processImage = async (inputBuffer, originalFilename) => {
    const filenameBase = path.parse(originalFilename).name;
    // We keep the original timestamp/id prefix if present
    
    // 1. Save Original (if passed as buffer, otherwise it's assumed saved)
    // In our flow, we save manually, but let's assume we handle the variants here.
    
    // Generate Medium (Web) - Max width 800px, WebP
    // Added .rotate() to auto-orient based on EXIF data before stripping metadata
    await sharp(inputBuffer)
        .rotate() 
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(path.join(IMAGES_DIR, `${filenameBase}-medium.webp`));

    // Generate Small (Mobile) - Max width 400px, WebP
    await sharp(inputBuffer)
        .rotate()
        .resize({ width: 400, withoutEnlargement: true })
        .webp({ quality: 70 })
        .toFile(path.join(IMAGES_DIR, `${filenameBase}-small.webp`));
        
    console.log(`🖼️  Optimized variants created for: ${filenameBase}`);
};

export const checkAndGenerateMissingVariants = async () => {
    console.log("🔍 Checking image variants and fixing rotation...");
    
    try {
        const files = fs.readdirSync(IMAGES_DIR);
        
        // Filter for original files (not -medium or -small) and image types
        const originals = files.filter(f => 
            !f.includes('-medium.') && 
            !f.includes('-small.') && 
            /\.(jpg|jpeg|png)$/i.test(f)
        );

        let count = 0;
        for (const file of originals) {
            const filenameBase = path.parse(file).name;
            const mediumPath = path.join(IMAGES_DIR, `${filenameBase}-medium.webp`);
            const smallPath = path.join(IMAGES_DIR, `${filenameBase}-small.webp`);
            const originalPath = path.join(IMAGES_DIR, file);

            // We force regeneration to ensure rotation is applied to existing images
            // even if the file exists.
            const forceRegenerate = true; 

            if (forceRegenerate || !fs.existsSync(mediumPath) || !fs.existsSync(smallPath)) {
                try {
                    const buffer = fs.readFileSync(originalPath);
                    
                    // Always regenerate Medium with rotation
                    await sharp(buffer)
                        .rotate() // Auto-orient
                        .resize({ width: 800, withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toFile(mediumPath);
                    
                    // Always regenerate Small with rotation
                    await sharp(buffer)
                        .rotate() // Auto-orient
                        .resize({ width: 400, withoutEnlargement: true })
                        .webp({ quality: 70 })
                        .toFile(smallPath);
                    
                    count++;
                } catch (err) {
                    console.error(`❌ Failed to process existing image ${file}:`, err.message);
                }
            }
        }
        
        if (count > 0) console.log(`✅ Regenerated/Fixed variants for ${count} existing images.`);
        else console.log("✅ All images are optimized.");
        
    } catch (e) {
        console.error("❌ Image check failed:", e.message);
    }
};
