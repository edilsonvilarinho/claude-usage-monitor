// @ts-check
'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;
const productName = pkg.build.productName;
const outDir = path.join(__dirname, '..', 'dist-build');

const files = [
  {
    exe: path.join(outDir, `${productName} Setup ${version}.exe`),
    zip: path.join(outDir, `Claude-Usage-Monitor-Setup-${version}.zip`),
    label: 'installer',
  },
  {
    exe: path.join(outDir, `${productName} ${version}.exe`),
    zip: path.join(outDir, `Claude-Usage-Monitor-Portable-${version}.zip`),
    label: 'portable',
  },
];

for (const { exe, zip, label } of files) {
  if (!fs.existsSync(exe)) {
    console.error(`ERROR: ${label} EXE not found: ${exe}`);
    process.exit(1);
  }
  if (fs.existsSync(zip)) {
    fs.unlinkSync(zip);
  }

  // Use 7z if available, otherwise fall back to PowerShell with -ExecutionPolicy Bypass
  try {
    execSync(`7z a "${zip}" "${exe}"`, { stdio: 'pipe' });
  } catch {
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "Import-Module Microsoft.PowerShell.Archive -ErrorAction SilentlyContinue; Compress-Archive -Path '${exe}' -DestinationPath '${zip}'"`,
      { stdio: 'inherit' }
    );
  }

  console.log(`Created ${label} ZIP: ${path.basename(zip)}`);
}
