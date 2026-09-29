const fs = require('fs');
const path = './src/lib/notifications/email-templates.ts';
let code = fs.readFileSync(path, 'utf8');

// Add gap
code = code.replace(
  /justify-content: space-between;\r?\n\s*align-items: center;\r?\n\s*padding: 10px 0;/g,
  'justify-content: space-between;\n      align-items: center;\n      gap: 12px;\n      padding: 10px 0;'
);

// Replace data.time
code = code.replace(/\$\{data\.time\}/g, '${data.time.slice(0, 5)}');

fs.writeFileSync(path, code);
console.log('Update done');
