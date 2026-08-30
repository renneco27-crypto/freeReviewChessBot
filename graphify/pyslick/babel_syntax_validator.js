/**
 * Babel Syntax Validator (Node.js)
 * Validates JSX and ES6+ JavaScript syntax in .html, .js, or .jsx files.
 * Extracts inline <script type="text/babel"> blocks or validates entire files.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BABEL_LOCAL_PATH = path.join(__dirname, 'babel.min.js');
const BABEL_CDN = 'https://unpkg.com/@babel/standalone@7.24.0/babel.min.js';

function ensureBabel(callback) {
  if (fs.existsSync(BABEL_LOCAL_PATH)) {
    return callback(require(BABEL_LOCAL_PATH));
  }

  console.log('Downloading @babel/standalone cache...');
  const file = fs.createWriteStream(BABEL_LOCAL_PATH);
  https.get(BABEL_CDN, (res) => {
    res.pipe(file);
    file.on('finish', () => {
      file.close(() => {
        callback(require(BABEL_LOCAL_PATH));
      });
    });
  }).on('error', (err) => {
    console.error('Error downloading Babel:', err.message);
    process.exit(1);
  });
}

function validateFile(filePath, Babel) {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(filePath, 'utf8');
  let codeToValidate = rawContent;
  let isHtml = filePath.endsWith('.html') || rawContent.includes('<script');

  if (isHtml) {
    const babelStartRegex = /<script[^>]*type=["']text\/babel["'][^>]*>/gi;
    let match;
    let scripts = [];

    while ((match = babelStartRegex.exec(rawContent)) !== null) {
      const startIndex = match.index + match[0].length;
      const endIndex = rawContent.indexOf('</script>', startIndex);
      if (endIndex !== -1) {
        const scriptCode = rawContent.substring(startIndex, endIndex);
        const lineOffset = rawContent.substring(0, startIndex).split('\n').length;
        scripts.push({ code: scriptCode, lineOffset });
      }
    }

    if (scripts.length === 0) {
      console.log('No <script type="text/babel"> blocks found. Validating whole file as JS/JSX...');
    } else {
      let allPassed = true;
      scripts.forEach((s, idx) => {
        try {
          Babel.transform(s.code, { presets: ['react', 'env'] });
          console.log(`[OK] Script block #${idx + 1} (starting around line ${s.lineOffset}): Syntax valid!`);
        } catch (err) {
          allPassed = false;
          const actualLine = (err.loc ? err.loc.line : 0) + s.lineOffset - 1;
          console.error(`\n[ERROR] Babel Syntax Error in Script #${idx + 1} (File Line ~${actualLine}):`);
          console.error(`Message: ${err.message}\n`);
          if (err.loc) {
            const lines = s.code.split('\n');
            const errLineIdx = err.loc.line - 1;
            console.error('Code context:');
            for (let i = Math.max(0, errLineIdx - 3); i <= Math.min(lines.length - 1, errLineIdx + 3); i++) {
              const prefix = i === errLineIdx ? ' > ' : '   ';
              console.error(`${prefix} Line ${i + s.lineOffset}: ${lines[i]}`);
            }
          }
        }
      });
      process.exit(allPassed ? 0 : 1);
    }
  }

  try {
    Babel.transform(codeToValidate, { presets: ['react', 'env'] });
    console.log('[OK] JSX / JS Syntax valid! No parsing errors.');
  } catch (err) {
    console.error('\n[ERROR] Babel Syntax Error:');
    console.error(err.message);
    process.exit(1);
  }
}

const targetFile = process.argv[2];
if (!targetFile) {
  console.log('Usage: node babel_syntax_validator.js <path_to_file>');
  process.exit(1);
}

ensureBabel((Babel) => {
  validateFile(targetFile, Babel);
});
