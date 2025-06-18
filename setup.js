import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  port: 3306
};

async function setupDatabase() {
  let connection;
  
  try {
    console.log('🔧 Setting up database...');
    
    // Connect to MySQL server
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server');
    
    // Create database
    await connection.query('CREATE DATABASE IF NOT EXISTS whatsapp_multi_session');
    console.log('✅ Database created or already exists');
    
    // Use the database
    await connection.query('USE whatsapp_multi_session');
    
    // Create whatsapp_sessions table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        status ENUM('pending', 'connecting', 'qr_ready', 'connected', 'disconnected', 'error') DEFAULT 'pending',
        creds TEXT,
        \`keys\` TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ whatsapp_sessions table created');
    
    // Create users table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ users table created');
    
    // Check if admin user exists
    const [users] = await connection.execute('SELECT * FROM users WHERE username = ?', ['admin']);
    
    if (users.length === 0) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await connection.execute('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
      console.log('✅ Default admin user created');
      console.log('   Username: admin');
      console.log('   Password: admin123');
    } else {
      console.log('✅ Admin user already exists');
    }
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('You can now start the server with: node server.js');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.log('\nPlease make sure:');
    console.log('1. MySQL is running on your system');
    console.log('2. MySQL credentials are correct (default: root with no password)');
    console.log('3. You have permission to create databases');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase(); 