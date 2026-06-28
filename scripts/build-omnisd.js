const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, '../dist');
const buildDir = path.join(__dirname, '../omnisd_build');

// 1. Ensure directories exist
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

console.log('Building for OmniSD...');

// 2. Create metadata.json for OmniSD
const metadata = {
  version: 1,
  manifestURL: "app://kaicube.kaios/manifest.webapp"
};
fs.writeFileSync(path.join(buildDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

// 3. Create update.webapp (copy of manifest.webapp)
const manifestPath = path.join(distDir, 'manifest.webapp');
if (fs.existsSync(manifestPath)) {
  fs.copyFileSync(manifestPath, path.join(buildDir, 'update.webapp'));
}

// 4. Zip the dist folder into application.zip inside omnisd_build
try {
  console.log('Zipping application files...');
  // Use bestzip via npx
  execSync(`npx bestzip ../omnisd_build/application.zip *`, { cwd: distDir });
  console.log('OmniSD build completed in /omnisd_build');
} catch (error) {
  console.error('Error zipping application:', error);
  process.exit(1);
}
