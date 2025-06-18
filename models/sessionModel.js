import db from '../config/db.js';

export const getAllSessions = async () => {
  const [rows] = await db.query("SELECT * FROM whatsapp_sessions");
  return rows;
};

export const getSessionByToken = async (token) => {
  const [rows] = await db.query("SELECT * FROM whatsapp_sessions WHERE token = ?", [token]);
  return rows[0];
};

export const createSession = async (token, name) => {
  await db.query("INSERT INTO whatsapp_sessions (token, name, status) VALUES (?, ?, 'pending')", [token, name]);
};

export const updateSessionCreds = async (token, creds) => {
  await db.query("UPDATE whatsapp_sessions SET creds = ?, status = 'connected' WHERE token = ?", [JSON.stringify(creds), token]);
};

export const updateSessionKeys = async (token, keys) => {
  await db.query("UPDATE whatsapp_sessions SET keys = ? WHERE token = ?", [JSON.stringify(keys), token]);
};

// Fungsi baru untuk clear/reset session
export const clearSession = async (token) => {
  try {
    await db.query("UPDATE whatsapp_sessions SET creds = NULL, keys = NULL, status = 'pending' WHERE token = ?", [token]);
    console.log(`Session ${token} cleared successfully`);
  } catch (error) {
    console.error('Error clearing session:', error);
    throw error;
  }
};

// Fungsi untuk delete session completely
export const deleteSession = async (token) => {
  try {
    await db.query("DELETE FROM whatsapp_sessions WHERE token = ?", [token]);
    console.log(`Session ${token} deleted successfully`);
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
};

// Fungsi untuk update status session
export const updateSessionStatus = async (token, status) => {
  try {
    await db.query("UPDATE whatsapp_sessions SET status = ? WHERE token = ?", [status, token]);
  } catch (error) {
    console.error('Error updating session status:', error);
    throw error;
  }
};