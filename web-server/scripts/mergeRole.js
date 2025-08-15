'use strict';
const fs = require('fs');
const path = require('path');

const readJSON = (file) => {
  const fullPath = path.resolve(__dirname, file);
  if (!fs.existsSync(fullPath)) return [];
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

const mergeMany = (fileList) => {
  const map = new Map();
  for (const file of fileList) {
    const roles = readJSON(file);
    for (const role of roles) {
      if (!map.has(role.type)) map.set(role.type, role);
    }
  }
  return Array.from(map.values());
};

(() => {
  const files = fs.readdirSync(__dirname)
    .filter(f => f.startsWith('roles-') && f.endsWith('.json') && f !== 'roles-merged.json');

  const merged = mergeMany(files);
  const outPath = path.resolve(__dirname, 'roles-merged.json');

  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
  console.log(`✅ Merged ${files.length} files into ${outPath} (${merged.length} roles)`);
})();
