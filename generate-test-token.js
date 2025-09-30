import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

const testUser = {
    user_id: '34e0bb46-ec50-4fec-ac30-4e33f3ced66c',
    role: 'parent'
};

const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '1h' });
console.log('JWT Token:');
console.log(token);
