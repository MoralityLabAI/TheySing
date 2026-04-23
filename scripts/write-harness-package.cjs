const fs = require('fs');
const path = require('path');

const outputDir = path.resolve(__dirname, '..', 'dist-harness');
const packageJsonPath = path.join(outputDir, 'package.json');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  packageJsonPath,
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
  'utf8'
);
