import express from 'express';
import sessionRoutes from './routes/sessionRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import authRoutes from './routes/authRoutes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import sequelize from './config/database.js';
import { isAuthenticated } from './middleware/auth.js';
import { startAutomaticCleanup } from './services/whatsappService.js';

dotenv.config();
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Test database connection
sequelize.authenticate()
    .then(() => console.log('Connected to MySQL database'))
    .catch(err => console.error('MySQL connection error:', err));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
const MySQLStoreSession = MySQLStore(session);
const sessionStore = new MySQLStoreSession({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'whatsapp_multi_session'
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));

// Routes
app.use('/auth', authRoutes);
app.use('/', sessionRoutes);
app.use('/api/whatsapp', isAuthenticated, whatsappRoutes);

// Start automatic cleanup service
startAutomaticCleanup();

app.listen(3001, () => console.log('Server running at http://localhost:3001'));