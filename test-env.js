import { config } from 'dotenv';

// Load environment variables
config();

console.log('Environment variables test:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');

// Test Supabase import
try {
    const { supabase } = await import('./src/config/supabase.js');
    console.log('Supabase import successful');
} catch (error) {
    console.error('Supabase import failed:', error.message);
} 