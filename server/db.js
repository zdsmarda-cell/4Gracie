
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

let pool = null;

export const getDb = async () => {
  if (pool) return pool;
  try {
    if (!process.env.DB_HOST) throw new Error("DB_HOST missing from .env");
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || '4gracie_db',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      dateStrings: true 
    });
    return pool;
  } catch (err) {
    console.error(`❌ DB Configuration Error: ${err.message}`);
    return null;
  }
};

export const withDb = (handler) => async (req, res) => {
  const db = await getDb();
  if (db) {
    try { await handler(req, res, db); } 
    catch (err) { console.error("Handler Error:", err); res.status(500).json({ error: err.message }); }
  } else {
    console.error("❌ Database connection not available for request.");
    res.status(500).json({ error: 'DB Connection Failed' });
  }
};

export const parseJsonCol = (row, colName = 'data') => {
    const val = row[colName];
    if (!val) return {};
    
    // If it's already an object (mysql2 auto-parsed JSON column), return it
    if (typeof val === 'object') return val;

    // If it's a string, try to parse it
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            // Handle double-encoded JSON strings if necessary
            if (typeof parsed === 'string') {
                try { return JSON.parse(parsed); } catch(e) { return parsed; }
            }
            return parsed;
        } catch (e) {
            console.error(`JSON Parse Error for column ${colName}:`, e);
            return {};
        }
    }
    return {};
};
