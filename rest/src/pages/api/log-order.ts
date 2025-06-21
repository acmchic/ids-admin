import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { fileName, lines } = req.body;

  if (!fileName || !Array.isArray(lines)) {
    return res.status(400).json({ message: 'Invalid input' });
  }

  try {
    const fullPath = path.join(process.cwd(), 'public', fileName);
    const dirPath = path.dirname(fullPath);

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.appendFileSync(fullPath, lines.join('\n') + '\n');

    return res.status(200).json({ message: 'Log written successfully' });
  } catch (error: any) {
    console.error('Logging error:', error);
    return res.status(500).json({ message: 'Failed to write log' });
  }
}
