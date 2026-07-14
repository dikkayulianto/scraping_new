const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const THEME_DIR = path.join(__dirname, 'scrapeflow-theme');
const OUTPUT_ZIP = path.join(__dirname, 'scrapeflow-theme.zip');

function addDirectoryToZip(zip, dirPath, rootPath) {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        const relativePath = path.relative(rootPath, fullPath);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            // Recurse directories
            addDirectoryToZip(zip, fullPath, rootPath);
        } else if (stat.isFile()) {
            // Read file content and add to ZIP with clean path slashes
            const content = fs.readFileSync(fullPath);
            const zipPath = path.join('scrapeflow-theme', relativePath).replace(/\\/g, '/');
            zip.file(zipPath, content);
            console.log(`Adding to ZIP: ${zipPath}`);
        }
    });
}

async function compileThemeToZip() {
    console.log(`Starting WordPress Theme Compilation...`);
    console.log(`Source directory: ${THEME_DIR}`);
    
    if (!fs.existsSync(THEME_DIR)) {
        console.error(`Error: Theme source directory not found!`);
        process.exit(1);
    }
    
    const zip = new JSZip();
    addDirectoryToZip(zip, THEME_DIR, THEME_DIR);
    
    try {
        console.log(`Generating ZIP buffer...`);
        const content = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });
        
        fs.writeFileSync(OUTPUT_ZIP, content);
        console.log(`=========================================`);
        console.log(`WordPress Theme compiled successfully!`);
        console.log(`Saved to: ${OUTPUT_ZIP}`);
        console.log(`=========================================`);
    } catch (e) {
        console.error(`Failed to compile ZIP:`, e.message);
    }
}

compileThemeToZip();
