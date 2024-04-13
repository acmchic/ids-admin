// logger.js

import fs from 'fs';

export default function logToFile(message) {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFile('sendmail.log', logMessage, (err) => {
    if (err) throw err;
    console.log('Log message appended to sendmail.log');
  });
}

