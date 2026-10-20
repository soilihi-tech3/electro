const fs = require('fs');
const path = require('path');

const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
      const content = fs.readFileSync(file, 'utf8');
      const matches = content.match(emojiRegex);
      if (matches) {
        results.push({ file, emojis: [...new Set(matches)] });
      }
    }
  });
  return results;
}

const res = walk('/Users/soilihiabdou/Downloads/easymarket/frontend/src');
console.log(JSON.stringify(res, null, 2));
