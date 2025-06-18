-- Create database if not exists
CREATE DATABASE IF NOT EXISTS whatsapp_multi_session;
USE whatsapp_multi_session;

-- Create whatsapp_sessions table
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    status ENUM('pending', 'connecting', 'qr_ready', 'connected', 'disconnected', 'error') DEFAULT 'pending',
    creds TEXT,
    session_keys TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default user (password: admin123)
INSERT IGNORE INTO users (username, password) VALUES ('admin', '$2b$10$rQZ8K9mX2nL5vA1sB3cD7eF4gH6iJ8kL2mN4oP6qR8sT0uV2wX4yZ6aB8cD'); 