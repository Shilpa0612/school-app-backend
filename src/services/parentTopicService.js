import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import pushNotificationService from './pushNotificationService.js';

/**
 * Parent Topic Service
 * - No schema changes required
 * - Uses existing tables: parent_student_mappings, students_master
 * - Subscribes a parent device token to student-specific topics
 */
async function autoSubscribeParentDevice(parentId, deviceToken) {
    try {
        // 1) Fetch student's ids mapped to this parent
        const { data: mappings, error: mapErr } = await adminSupabase
                .from('parent_student_mappings')
            .select('student_id')
                .eq('parent_id', parentId);

        if (mapErr) {
            logger.warn('ParentTopicService: mapping fetch failed', { code: mapErr.code, message: mapErr.message });
            return { success: false, error: mapErr };
        }

        const studentIds = (mappings || []).map(m => m.student_id).filter(Boolean);
        if (studentIds.length === 0) {
            return {
                success: true,
                subscribedTopics: [],
                successfulSubscriptions: 0,
                failedSubscriptions: 0
            };
        }

        // 2) Resolve students (kept minimal; adjust columns as needed)
        const { data: students, error: stuErr } = await adminSupabase
            .from('students_master')
            .select('id')
            .in('id', studentIds);

        if (stuErr) {
            logger.warn('ParentTopicService: students fetch failed', { code: stuErr.code, message: stuErr.message });
            return { success: false, error: stuErr };
        }

        // 3) Build topics; minimal: one per student
        const topics = (students || []).map(s => `student_${s.id}`);
        if (topics.length === 0) {
            return {
                success: true,
                subscribedTopics: [],
                successfulSubscriptions: 0,
                failedSubscriptions: 0
            };
        }

        // 4) Subscribe device token to topics
        const failures = [];
        for (const topic of topics) {
            try {
                const res = await pushNotificationService.subscribeToTopic(deviceToken, topic);
                if (!res?.success) {
                    failures.push({ topic, error: res?.error });
                }
            } catch (e) {
                failures.push({ topic, error: e?.message || 'unknown_error' });
                }
            }

            return {
            success: failures.length === 0,
            subscribedTopics: topics,
            totalTopics: topics.length,
            successfulSubscriptions: topics.length - failures.length,
            failedSubscriptions: failures.length
        };
        } catch (error) {
        logger.warn('ParentTopicService: unexpected error', { message: error?.message });
            return { success: false, error };
    }
}

export default { autoSubscribeParentDevice };
