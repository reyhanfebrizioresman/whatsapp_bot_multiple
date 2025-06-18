// seeders/userSeeder.js
import User from '../models/User.js';
import sequelize from '../config/database.js';

const createDefaultUser = async () => {
    try {
        console.log('=== STARTING USER SEEDING ===');
        
        // Sync database first
        await sequelize.sync({ force: false });
        console.log('Database synced');

        // Check and create admin user
        const adminExists = await User.findOne({ where: { username: 'admin' } });
        
        if (!adminExists) {
            const adminUser = await User.create({
                username: 'admin',
                password: 'admin123' // Will be hashed by the model hook
            });
            console.log('✅ Default admin user created successfully');
            console.log('Admin user ID:', adminUser.id);
        } else {
            console.log('ℹ️  Admin user already exists');
            console.log('Existing admin user details:', {
                id: adminExists.id,
                username: adminExists.username,
                hasPassword: adminExists.password ? 'Yes' : 'No'
            });
        }

        // Check and create test user
        const testExists = await User.findOne({ where: { username: 'test' } });
        
        if (!testExists) {
            const testUser = await User.create({
                username: 'test',
                password: 'test123' // Will be hashed by the model hook
            });
            console.log('✅ Test user created successfully');
            console.log('Test user ID:', testUser.id);
        } else {
            console.log('ℹ️  Test user already exists');
            console.log('Existing test user details:', {
                id: testExists.id,
                username: testExists.username,
                hasPassword: testExists.password ? 'Yes' : 'No'
            });
        }

        // Verify users
        const allUsers = await User.findAll();
        console.log('=== ALL USERS IN DATABASE ===');
        allUsers.forEach(user => {
            console.log(`- ID: ${user.id}, Username: ${user.username}, Password Hash Length: ${user.password ? user.password.length : 'No password'}`);
        });

    } catch (error) {
        console.error('=== SEEDING ERROR ===');
        console.error('Error creating default users:', error);
        throw error;
    }
};

// Run the seeder
if (import.meta.url === `file://${process.argv[1]}`) {
    createDefaultUser()
        .then(() => {
            console.log('=== SEEDING COMPLETED SUCCESSFULLY ===');
            process.exit(0);
        })
        .catch(error => {
            console.error('=== SEEDING FAILED ===');
            console.error(error);
            process.exit(1);
        });
}

export default createDefaultUser;