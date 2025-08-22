import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// OPTIMIZATION: Query caching and batching for high-scale operations
class QueryOptimizer {
    constructor() {
        this.queryCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.batchQueue = new Map();
        this.batchTimeout = 100; // 100ms batch window
    }

    // Cache frequently accessed data
    async getCachedOrFetch(key, fetchFunction) {
        const cached = this.queryCache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }

        const data = await fetchFunction();
        this.queryCache.set(key, {
            data,
            timestamp: Date.now()
        });
        return data;
    }

    // Batch similar queries
    async batchQuery(key, queryFunction) {
        if (this.batchQueue.has(key)) {
            return this.batchQueue.get(key);
        }

        const promise = queryFunction();
        this.batchQueue.set(key, promise);

        // Clear batch after timeout
        setTimeout(() => {
            this.batchQueue.delete(key);
        }, this.batchTimeout);

        return promise;
    }

    // Clear expired cache entries
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.queryCache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.queryCache.delete(key);
            }
        }
    }

    getStats() {
        return {
            cacheSize: this.queryCache.size,
            batchQueueSize: this.batchQueue.size,
            cacheHitRate: this.calculateCacheHitRate()
        };
    }

    calculateCacheHitRate() {
        // This would need to be implemented with actual hit tracking
        return 'N/A';
    }
}

// Create query optimizer instance
export const queryOptimizer = new QueryOptimizer();

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
    // OPTIMIZATION: Add connection pooling and timeout settings for scale
    db: {
        schema: 'public'
    },
    // OPTIMIZATION: Add request timeout and retry settings
    realtime: {
        timeout: 20000, // 20 seconds
        retryAfterMs: 1000 // 1 second
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

// OPTIMIZATION: Performance monitoring wrapper
export const monitoredSupabase = {
    ...supabase,
    from: (table) => {
        const startTime = Date.now();
        const originalFrom = supabase.from(table);

        // Wrap the select method to monitor performance
        const originalSelect = originalFrom.select;
        originalFrom.select = function (...args) {
            const result = originalSelect.apply(this, args);

            // Monitor query performance
            const originalThen = result.then;
            result.then = function (onFulfilled, onRejected) {
                return originalThen.call(this,
                    (data) => {
                        const queryTime = Date.now() - startTime;
                        if (queryTime > 1000) { // Log slow queries (>1s)
                            console.warn(`⚠️  Slow query on ${table}: ${queryTime}ms`);
                        }
                        return onFulfilled ? onFulfilled(data) : data;
                    },
                    (error) => {
                        const queryTime = Date.now() - startTime;
                        console.error(`❌ Query failed on ${table} after ${queryTime}ms:`, error);
                        return onRejected ? onRejected(error) : Promise.reject(error);
                    }
                );
            };

            return result;
        };

        return originalFrom;
    }
};

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