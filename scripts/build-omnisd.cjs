const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const distDir = path.join(__dirname, '../dist');
const buildDir = path.join(__dirname, '../omnisd_build');
const tempDir = path.join(__dirname, '../omnisd_temp');

// 1. Ensure clean directories
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
fs.mkdirSync(buildDir);

if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir);

console.log('Building for OmniSD...');

// 2. Create application.zip (Internal Zip)
try {
  console.log('Creating application.zip...');
  // Zip dist content into temp/application.zip
  execSync(`npx bestzip ../omnisd_temp/application.zip *`, { cwd: distDir });
} catch (error) {
  console.error('Error creating application.zip:', error);
  process.exit(1);
}

// 3. Create metadata.json
const metadata = {
  version: 1,
  manifestURL: "app://kaicube.kaios/manifest.webapp"
};
fs.writeFileSync(path.join(tempDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

// 4. Create update.webapp (copy of manifest.webapp)
const manifestPath = path.join(distDir, 'manifest.webapp');
if (fs.existsSync(manifestPath)) {
  fs.copyFileSync(manifestPath, path.join(tempDir, 'update.webapp'));
}

// 5. Create the final OmniSD Package Zip
try {
  console.log('Creating final OmniSD package...');
  // Zip temp content into omnisd_build/KaiCube-3D.zip
  execSync(`npx bestzip ../omnisd_build/KaiCube-3D.zip *`, { cwd: tempDir });
  console.log('OmniSD build completed: /omnisd_build/KaiCube-3D.zip');
} catch (error) {
  console.error('Error creating OmniSD package:', error);
  process.exit(1);
} finally {
  // Clean up temp dir
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
