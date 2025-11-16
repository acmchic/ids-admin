import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const ADS_DATA_FILE = path.join(process.cwd(), 'data', 'ads-tracking.json');

interface AdsEntry {
  id: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: string;
}

interface AdsData {
  entries: AdsEntry[];
  totalDebt: number;
}

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.dirname(ADS_DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Read ads data from file
function readAdsData(): AdsData {
  ensureDataDir();
  
  if (!fs.existsSync(ADS_DATA_FILE)) {
    const initialData: AdsData = { entries: [], totalDebt: 0 };
    fs.writeFileSync(ADS_DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  
  const fileContent = fs.readFileSync(ADS_DATA_FILE, 'utf-8');
  return JSON.parse(fileContent);
}

// Write ads data to file
function writeAdsData(data: AdsData) {
  ensureDataDir();
  fs.writeFileSync(ADS_DATA_FILE, JSON.stringify(data, null, 2));
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method === 'GET') {
      // Get all ads entries
      const data = readAdsData();
      return res.status(200).json(data);
    }
    
    if (req.method === 'POST') {
      // Add new ads entry
      const { amount, date, note } = req.body;
      
      if (!amount || !date) {
        return res.status(400).json({ error: 'Amount and date are required' });
      }
      
      const data = readAdsData();
      const newEntry: AdsEntry = {
        id: Date.now().toString(),
        amount: parseFloat(amount),
        date,
        note: note || '',
        createdAt: new Date().toISOString(),
      };
      
      data.entries.unshift(newEntry); // Add to beginning
      writeAdsData(data);
      
      return res.status(201).json(newEntry);
    }
    
    if (req.method === 'PUT') {
      // Update existing entry or debt
      const { id, amount, date, note, totalDebt } = req.body;
      const data = readAdsData();
      
      // Update total debt
      if (totalDebt !== undefined) {
        data.totalDebt = parseFloat(totalDebt);
        writeAdsData(data);
        return res.status(200).json({ totalDebt: data.totalDebt });
      }
      
      // Update entry
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      
      const entryIndex = data.entries.findIndex(e => e.id === id);
      if (entryIndex === -1) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      
      data.entries[entryIndex] = {
        ...data.entries[entryIndex],
        amount: amount !== undefined ? parseFloat(amount) : data.entries[entryIndex].amount,
        date: date || data.entries[entryIndex].date,
        note: note !== undefined ? note : data.entries[entryIndex].note,
      };
      
      writeAdsData(data);
      return res.status(200).json(data.entries[entryIndex]);
    }
    
    if (req.method === 'DELETE') {
      // Delete entry
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      
      const data = readAdsData();
      data.entries = data.entries.filter(e => e.id !== id);
      writeAdsData(data);
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Ads API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

