// models/User.js
import { DataTypes } from 'sequelize';
import bcrypt from 'bcrypt';
import sequelize from '../config/database.js';

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'users',
    timestamps: true
});

// Hash password before saving
User.beforeCreate(async (user) => {
    if (user.password) {
        const saltRounds = 10;
        user.password = await bcrypt.hash(user.password, saltRounds);
        console.log('Password hashed for user:', user.username);
    }
});

User.beforeUpdate(async (user) => {
    if (user.changed('password')) {
        const saltRounds = 10;
        user.password = await bcrypt.hash(user.password, saltRounds);
        console.log('Password updated and hashed for user:', user.username);
    }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
    try {
        console.log('Comparing password for user:', this.username);
        console.log('Candidate password:', candidatePassword);
        console.log('Stored hash:', this.password);
        
        const isMatch = await bcrypt.compare(candidatePassword, this.password);
        console.log('Password comparison result:', isMatch);
        return isMatch;
    } catch (error) {
        console.error('Error comparing password:', error);
        return false;
    }
};

export default User;