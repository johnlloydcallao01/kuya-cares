const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const OUTPUT_PATH = path.join(__dirname, 'tsc-errors.json');

function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Error: config.json not found at', CONFIG_PATH);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const appName = config.name;

  if (!appName) {
    console.error('Error: "name" field missing in config.json');
    process.exit(1);
  }

  const appDir = path.join(ROOT, appName);
  if (!fs.existsSync(appDir)) {
    console.error(`Error: directory "${appDir}" does not exist`);
    process.exit(1);
  }

  console.log(`Running tsc --noEmit in ${appName}...`);

  let stdout = '';
  let stderr = '';
  try {
    stdout = execSync('pnpm exec tsc --noEmit 2>&1', {
      cwd: appDir,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (err) {
    // tsc exits with code 1 when there are errors — that's expected
    stdout = err.stdout || '';
    stderr = err.stderr || '';
  }

  const output = (stdout + '\n' + stderr).trim();

  if (!output) {
    console.log('No errors found.');
    const emptyResult = { totalErrorCount: 0, errors: [] };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(emptyResult, null, 2), 'utf8');
    console.log(`Output written to ${OUTPUT_PATH}`);
    return;
  }

  // Parse tsc output lines
  // Format: src/file.tsx(10,5): error TS2345: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;
  const errors = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const match = line.match(errorRegex);
    if (match) {
      const [, filePath, lineNum, column, errorCode, message] = match;
      errors.push({
        filePath: filePath.trim(),
        line: parseInt(lineNum, 10),
        column: parseInt(column, 10),
        errorCode: errorCode.trim(),
        message: message.trim(),
      });
    }
  }

  const result = {
    totalErrorCount: errors.length,
    errors,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');

  console.log(`Found ${errors.length} error(s).`);
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main();
