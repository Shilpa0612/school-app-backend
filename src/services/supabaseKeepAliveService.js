import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

class SupabaseKeepAliveService {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        // Run every 10 days to prevent Supabase project from pausing due to inactivity
        this.intervalMs = 10 * 24 * 60 * 60 * 1000; // 10 days in milliseconds
    }

    /**
     * Start the Supabase keep-alive scheduler
     * Runs every 10 days to prevent project from pausing due to inactivity
     */
    start() {
        if (this.isRunning) {
            logger.warn('Supabase keep-alive service is already running');
            return;
        }

        const days = Math.round(this.intervalMs / (24 * 60 * 60 * 1000));
        const hours = Math.round(this.intervalMs / (60 * 60 * 1000));
        const minutes = Math.round(this.intervalMs / (60 * 1000));
        
        let intervalText;
        if (days >= 1) {
            intervalText = `${days} day${days > 1 ? 's' : ''}`;
        } else if (hours >= 1) {
            intervalText = `${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
            intervalText = `${minutes} minute${minutes > 1 ? 's' : ''}`;
        }
        
        logger.info(`Supabase keep-alive service started. Will run every ${intervalText} to prevent project pausing.`);
        logger.info(`Next keep-alive check will run in ${intervalText}.`);

        // Run immediately on start to establish initial connection
        this.performKeepAlive();

        // Schedule recurring runs every 10 days
        this.intervalId = setInterval(() => {
            this.performKeepAlive();
        }, this.intervalMs);

        this.isRunning = true;
    }

    /**
     * Perform the keep-alive check by making a lightweight query to Supabase
     */
    async performKeepAlive() {
        try {
            logger.info('🔄 Performing Supabase keep-alive check...');

            const startTime = Date.now();
            
            // Make a lightweight query to keep the connection active
            // This is the same query used in /test-db endpoint
            const { data, error } = await adminSupabase
                .from('users')
                .select('count')
                .limit(1);

            const duration = Date.now() - startTime;

            if (error) {
                logger.warn(`⚠️ Supabase keep-alive check failed: ${error.message} (${duration}ms)`);
                logger.warn('This might indicate the Supabase project is paused or there is a connection issue.');
            } else {
                logger.info(`✅ Supabase keep-alive check successful (${duration}ms)`);
                logger.info('Supabase project is active and will not pause due to inactivity.');
            }

        } catch (error) {
            logger.error(`❌ Error in Supabase keep-alive check: ${error.message}`);
            // Don't throw - we want this to fail silently and continue running
        }
    }

    /**
     * Stop the Supabase keep-alive scheduler
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        logger.info('Supabase keep-alive service stopped');
    }
}

export default new SupabaseKeepAliveService();

