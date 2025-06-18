# WhatsApp Multi-Session Dashboard

A powerful WhatsApp multi-session management system built with Node.js, Express, and Baileys library. Manage multiple WhatsApp sessions simultaneously with a beautiful web interface.

## 🚀 Features

- **Multi-Session Management**: Create and manage multiple WhatsApp sessions
- **QR Code Generation**: Easy QR code scanning for WhatsApp Web
- **Real-time Status**: Live status updates for all sessions
- **Authentication System**: Secure login/logout functionality
- **Session Persistence**: Sessions remain active across server restarts
- **Beautiful UI**: Modern, responsive dashboard interface
- **Auto-reconnection**: Automatic reconnection on connection loss

## 📋 Prerequisites

- Node.js (v16 or higher)
- MySQL Database
- npm or yarn

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whatsapp-multi-session2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up database**
   ```bash
   # Create database
   mysql -u root -p
   CREATE DATABASE whatsapp_multi_session;
   exit
   
   # Run database setup
   mysql -u root -p < database_setup.sql
   ```

4. **Configure environment variables**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit .env with your configuration
   nano .env
   ```

5. **Run database seeder (optional)**
   ```bash
   npm run seed
   ```

6. **Start the application**
   ```bash
   npm start
   ```

## ⚙️ Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=whatsapp_multi_session

# Session Configuration
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# Environment
NODE_ENV=development

# Server Configuration (optional)
PORT=3000
```

## 🔐 Default Login

After running the seeder, you can login with:
- **Username**: `admin`
- **Password**: `admin123`

Or create a test user:
- **Username**: `test`
- **Password**: `test123`

## 📱 Usage

1. **Access the dashboard**
   - Open your browser and go to `http://localhost:3000`
   - Login with your credentials

2. **Create a new session**
   - Click "Create New Session" 
   - Enter a session name
   - Click "Create Session"

3. **Connect WhatsApp**
   - Click "Start Session" on your created session
   - Scan the QR code with your WhatsApp mobile app
   - Wait for connection confirmation

4. **Manage sessions**
   - View real-time status of all sessions
   - Restart sessions if needed
   - Delete sessions when no longer needed

## 🏗️ Project Structure

```
whatsapp-multi-session2/
├── config/                 # Database configuration
├── controllers/           # Route controllers
├── middleware/            # Authentication middleware
├── models/               # Database models
├── public/               # Static assets
├── routes/               # Express routes
├── seeders/              # Database seeders
├── services/             # WhatsApp service logic
├── sessions/             # WhatsApp session data (gitignored)
├── views/                # EJS templates
├── server.js             # Main application file
└── package.json          # Dependencies and scripts
```

## 🔧 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /logout` - User logout

### Session Management
- `GET /` - Dashboard
- `GET /sessions` - Get all sessions
- `POST /session` - Create new session
- `POST /session/start/:token` - Start WhatsApp session
- `GET /session/status/:token` - Check session status
- `POST /session/restart/:token` - Restart session
- `POST /session/refresh/:token` - Refresh QR code
- `DELETE /session/:token` - Delete session

### WhatsApp API
- `GET /api/whatsapp/test/:token` - Test connection
- `POST /api/whatsapp/send/:token` - Send message
- `POST /api/whatsapp/bulk-send/:token` - Send bulk messages
- `POST /api/whatsapp/check-number/:token` - Check number exists
- `GET /api/whatsapp/profile-picture/:token` - Get profile picture

## 🛡️ Security Features

- **Session-based authentication**
- **Password hashing with bcrypt**
- **CSRF protection**
- **Secure session storage**
- **Environment variable protection**

## 📊 Session States

- **pending**: Session created but not started
- **connecting**: Attempting to connect to WhatsApp
- **qr_ready**: QR code generated, waiting for scan
- **connected**: Successfully connected to WhatsApp
- **disconnected**: Connection lost or logged out
- **error**: Connection error occurred

## 🔄 Auto-reconnection

The system automatically:
- Reconnects sessions on connection loss
- Updates database status in real-time
- Maintains session persistence
- Handles WhatsApp Web disconnections

## 🐛 Troubleshooting

### Common Issues

1. **"logger.child is not a function" error**
   - Ensure pino is installed: `npm install pino`
   - Check that logger is properly configured in whatsappService.js

2. **Database connection error**
   - Verify MySQL is running
   - Check database credentials in .env
   - Ensure database exists

3. **QR code not generating**
   - Check internet connection
   - Verify Baileys library is up to date
   - Check server logs for errors

4. **Session not connecting**
   - Ensure WhatsApp mobile app is up to date
   - Check if phone has internet connection
   - Try restarting the session

### Logs

Check the console output for detailed error messages and connection status updates.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## ⚠️ Disclaimer

This project is for educational and development purposes. Please ensure compliance with WhatsApp's Terms of Service and applicable laws when using this software.

## 🆘 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section
2. Review the logs for error messages
3. Create an issue in the repository
4. Contact the maintainers

---

**Happy coding! 🚀** 