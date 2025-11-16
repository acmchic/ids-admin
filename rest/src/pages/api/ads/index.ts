import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Use /tmp directory on server for write access
const DATA_DIR = process.env.NODE_ENV === 'production' 
  ? '/tmp/ads-data'
  : path.join(process.cwd(), 'data');
const ADS_DATA_FILE = path.join(DATA_DIR, 'ads-tracking.json');

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
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o755 });
      console.log(`[Ads API] Created directory: ${DATA_DIR}`);
    }
  } catch (error: any) {
    console.error(`[Ads API] Failed to create directory: ${error.message}`);
    throw error;
  }
}

// Read ads data from file
function readAdsData(): AdsData {
  try {
    ensureDataDir();
    
    if (!fs.existsSync(ADS_DATA_FILE)) {
      const initialData: AdsData = { entries: [], totalDebt: 0 };
      fs.writeFileSync(ADS_DATA_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
      return initialData;
    }
    
    const fileContent = fs.readFileSync(ADS_DATA_FILE, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Validate data structure
    if (!data.entries || !Array.isArray(data.entries)) {
      console.warn('[Ads API] Invalid data structure, resetting to default');
      const defaultData: AdsData = { entries: [], totalDebt: data.totalDebt || 0 };
      writeAdsData(defaultData);
      return defaultData;
    }
    
    return data;
  } catch (error: any) {
    console.error('[Ads API] Error reading data file:', error);
    // Return default data if file is corrupted
    return { entries: [], totalDebt: 0 };
  }
}

// Write ads data to file
function writeAdsData(data: AdsData) {
  try {
    ensureDataDir();
    const jsonString = JSON.stringify(data, null, 2);
    fs.writeFileSync(ADS_DATA_FILE, jsonString, 'utf-8');
    console.log('[Ads API] Data written successfully');
  } catch (error: any) {
    console.error('[Ads API] Error writing data file:', error);
    throw new Error(`Failed to write data: ${error.message}`);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Log request for debugging
    console.log(`[Ads API] ${req.method} request received - Data file: ${ADS_DATA_FILE}`);
    console.log(`[Ads API] Environment: ${process.env.NODE_ENV}`);
    
    if (req.method === 'GET') {
      // Get all ads entries
      const data = readAdsData();
      console.log(`[Ads API] GET - Returning ${data.entries.length} entries, debt: ${data.totalDebt}`);
      return res.status(200).json(data);
    }
    
    if (req.method === 'POST') {
      // Add new ads entry
      const { amount, date, note } = req.body;
      
      if (!amount || !date) {
        return res.status(400).json({ error: 'Amount and date are required' });
      }
      
      const data = readAdsData();
      const amountValue = parseFloat(amount);
      
      const newEntry: AdsEntry = {
        id: Date.now().toString(),
        amount: amountValue,
        date,
        note: note || '',
        createdAt: new Date().toISOString(),
      };
      
      data.entries.unshift(newEntry); // Add to beginning
      
      // Tự động cộng vào totalDebt
      data.totalDebt = (data.totalDebt || 0) + amountValue;
      
      writeAdsData(data);
      
      return res.status(201).json({ entry: newEntry, totalDebt: data.totalDebt });
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
  } catch (error: any) {
    console.error('Ads API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

