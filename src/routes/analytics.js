import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Analytics summary
router.get('/summary', authenticate, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;

        // Check permissions (only admins and principals can view analytics)
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can view analytics'
            });
        }

        // Build date filter
        let dateFilter = '';
        if (date_from && date_to) {
            dateFilter = `WHERE date >= '${date_from}' AND date <= '${date_to}'`;
        } else if (date_from) {
            dateFilter = `WHERE date >= '${date_from}'`;
        } else if (date_to) {
            dateFilter = `WHERE date <= '${date_to}'`;
        }

        // Get summary statistics
        const { data: summary, error } = await supabase
            .rpc('get_analytics_summary', {
                date_filter: dateFilter
            });

        if (error) {
            logger.error('Error getting analytics summary:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to get analytics summary'
            });
        }

        // Get recent activity
        const { data: recentActivity, error: activityError } = await supabase
            .from('user_activity_logs')
            .select(`
                *,
                user:users(full_name, role)
            `)
            .order('created_at', { ascending: false })
            .limit(10);

        if (activityError) {
            logger.error('Error getting recent activity:', activityError);
        }

        res.json({
            status: 'success',
            data: {
                summary: summary || {},
                recent_activity: recentActivity || []
            }
        });

    } catch (error) {
        logger.error('Error in analytics summary:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Daily reports
router.get('/daily', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 30, date_from, date_to } = req.query;
        const offset = (page - 1) * limit;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can view daily reports'
            });
        }

        let query = supabase
            .from('daily_statistics')
            .select('*')
            .order('date', { ascending: false });

        // Apply date filters
        if (date_from) {
            query = query.gte('date', date_from);
        }

        if (date_to) {
            query = query.lte('date', date_to);
        }

        // Get total count
        const { count, error: countError } = await query.count();
        
        if (countError) {
            logger.error('Error getting daily reports count:', countError);
        }

        // Get paginated results
        const { data: reports, error } = await query
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching daily reports:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch daily reports'
            });
        }

        res.json({
            status: 'success',
            data: {
                reports,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in daily reports:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Generate custom report
router.post('/reports', authenticate, async (req, res) => {
    try {
        const { report_type, parameters, template_id } = req.body;

        // Check permissions
        if (!['admin', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Only admins and principals can generate reports'
            });
        }

        // Validate required fields
        if (!report_type) {
            return res.status(400).json({
                status: 'error',
                message: 'Report type is required'
            });
        }

        // Create report record
        const { data: report, error } = await supabase
            .from('generated_reports')
            .insert({
                template_id,
                report_name: `${report_type}_report_${new Date().toISOString().split('T')[0]}`,
                report_type,
                parameters: parameters || {},
                generated_by: req.user.id
            })
            .select()
            .single();

        if (error) {
            logger.error('Error creating report:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to create report'
            });
        }

        // Start report generation (this would typically be handled by a background job)
        // For now, we'll simulate the process
        setTimeout(async () => {
            try {
                const reportData = await generateReportData(report_type, parameters);
                
                // Update report status
                await supabase
                    .from('generated_reports')
                    .update({
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        file_url: `reports/${report.id}.json` // In real implementation, this would be a PDF/Excel file
                    })
                    .eq('id', report.id);

                logger.info(`Report ${report.id} generated successfully`);
            } catch (error) {
                logger.error(`Error generating report ${report.id}:`, error);
                
                await supabase
                    .from('generated_reports')
                    .update({
                        status: 'failed',
                        completed_at: new Date().toISOString()
                    })
                    .eq('id', report.id);
            }
        }, 1000);

        res.status(201).json({
            status: 'success',
            data: {
                report,
                message: 'Report generation started'
            }
        });

    } catch (error) {
        logger.error('Error in generate report:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get generated reports
router.get('/reports', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('generated_reports')
            .select(`
                *,
                template:report_templates(name, description),
                generator:users(full_name, role)
            `)
            .order('generated_at', { ascending: false });

        // Apply status filter
        if (status) {
            query = query.eq('status', status);
        }

        // Role-based filtering
        if (req.user.role !== 'admin' && req.user.role !== 'principal') {
            query = query.eq('generated_by', req.user.id);
        }

        // Get total count
        const { count, error: countError } = await query.count();
        
        if (countError) {
            logger.error('Error getting reports count:', countError);
        }

        // Get paginated results
        const { data: reports, error } = await query
            .range(offset, offset + limit - 1);

        if (error) {
            logger.error('Error fetching reports:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch reports'
            });
        }

        res.json({
            status: 'success',
            data: {
                reports,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            }
        });

    } catch (error) {
        logger.error('Error in get reports:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Get report by ID
router.get('/reports/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: report, error } = await supabase
            .from('generated_reports')
            .select(`
                *,
                template:report_templates(name, description),
                generator:users(full_name, role)
            `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({
                    status: 'error',
                    message: 'Report not found'
                });
            }
            logger.error('Error fetching report:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Failed to fetch report'
            });
        }

        // Check permissions
        if (req.user.role !== 'admin' && req.user.role !== 'principal' && report.generated_by !== req.user.id) {
            return res.status(403).json({
                status: 'error',
                message: 'Access denied'
            });
        }

        res.json({
            status: 'success',
            data: report
        });

    } catch (error) {
        logger.error('Error in get report:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error'
        });
    }
});

// Helper function to generate report data
async function generateReportData(reportType, parameters) {
    // This is a simplified implementation
    // In a real application, this would generate actual report data
    const reportData = {
        type: reportType,
        generated_at: new Date().toISOString(),
        parameters: parameters || {},
        data: {}
    };

    switch (reportType) {
        case 'user_activity':
            // Get user activity data
            const { data: activityData } = await supabase
                .from('user_activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            reportData.data = activityData || [];
            break;

        case 'academic_performance':
            // Get academic data
            const { data: academicData } = await supabase
                .from('students_master')
                .select('*')
                .limit(100);
            reportData.data = academicData || [];
            break;

        case 'communication_summary':
            // Get communication data
            const { data: messageData } = await supabase
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            reportData.data = messageData || [];
            break;

        default:
            reportData.data = { message: 'Report type not implemented' };
    }

    return reportData;
}

export default router; 