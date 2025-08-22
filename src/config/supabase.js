import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create regular Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    },
    global: {
        headers: {
            'x-application-name': 'school-app'
        }
    },
    // OPTIMIZATION: Add connection pooling and timeout settings
    db: {
        schema: 'public'
    }
});

// Create service role client for admin operations
export const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    global: {
        headers: {
            'x-application-name': 'school-app-admin'
        }
    },
    // OPTIMIZATION: Add connection pooling and timeout settings
    db: {
        schema: 'public'
    }
});

// File upload utility
export const uploadFile = async (bucket, filePath, file) => {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};

// Get secure URL utility
export const getSecureUrl = async (bucket, filePath) => {
    try {
        const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (error) throw error;
        return data.signedUrl;
    } catch (error) {
        console.error('Error getting secure URL:', error);
        throw error;
    }
};

// Delete file utility
export const deleteFile = async (bucket, filePath) => {
    try {
        const { error } = await supabase.storage
            .from(bucket)
            .remove([filePath]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error deleting file:', error);
        throw error;
    }
}; 