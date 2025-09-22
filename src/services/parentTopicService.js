import { adminSupabase } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import pushNotificationService from './pushNotificationService.js';

class ParentTopicService {
    constructor() {
        // Define all available topics for parents
        this.parentTopics = {
            // School-wide topics
            SCHOOL_WIDE: 'school_wide',
            URGENT_ANNOUNCEMENTS: 'urgent_announcements',
            SCHOOL_EVENTS: 'school_events',

            // Class-specific topics (will be generated dynamically)
            CLASS_ANNOUNCEMENTS: 'class_announcements', // class_announcements_grade1_a
            CLASS_EVENTS: 'class_events', // class_events_grade1_a
            CLASS_HOMEWORK: 'class_homework', // class_homework_grade1_a
            CLASS_CLASSWORK: 'class_classwork', // class_classwork_grade1_a
            CLASS_MESSAGES: 'class_messages', // class_messages_grade1_a

            // Student-specific topics
            STUDENT_ATTENDANCE: 'student_attendance', // student_attendance_student123
            STUDENT_BIRTHDAY: 'student_birthday', // student_birthday_student123
            STUDENT_SPECIFIC: 'student_specific' // student_specific_student123
        };

        this.notificationTypes = {
            ANNOUNCEMENT: 'announcement',
            EVENT: 'event',
            HOMEWORK: 'homework',
            CLASSWORK: 'classwork',
            MESSAGE: 'message',
            ATTENDANCE: 'attendance',
            BIRTHDAY: 'birthday',
            SYSTEM: 'system'
        };
    }

    /**
     * Get all topics a parent should be subscribed to
     */
    async getParentTopics(parentId) {
        try {
            const topics = [];

            // 1. Get parent's students and their class information
            const { data: parentStudents, error: studentsError } = await adminSupabase
                .from('parent_student_mappings')
                .select(`
                    student_id,
                    students_master!inner(
                        id,
                        admission_number,
                        full_name
                    ),
                    student_academic_records!inner(
                        class_division_id,
                        class_divisions!inner(
                            id,
                            class_levels!inner(
                                name
                            ),
                            division
                        )
                    )
                `)
                .eq('parent_id', parentId);

            if (studentsError) {
                logger.error('Error fetching parent students:', studentsError);
                return { success: false, error: studentsError };
            }

            if (!parentStudents || parentStudents.length === 0) {
                return { success: true, topics: [] };
            }

            // 2. Add school-wide topics
            topics.push(
                this.parentTopics.SCHOOL_WIDE,
                this.parentTopics.URGENT_ANNOUNCEMENTS,
                this.parentTopics.SCHOOL_EVENTS
            );

            // 3. Add class-specific topics for each student
            const classTopics = new Set(); // Use Set to avoid duplicates

            parentStudents.forEach(parentStudent => {
                const student = parentStudent.students_master;
                const academicRecord = parentStudent.student_academic_records;
                const classDivision = academicRecord.class_divisions;
                const classLevel = classDivision.class_levels;

                // Generate class-specific topic names
                const className = classLevel.name.toLowerCase().replace(/\s+/g, '');
                const division = classDivision.division.toLowerCase();
                const classIdentifier = `${className}_${division}`;

                // Add class-specific topics
                classTopics.add(`${this.parentTopics.CLASS_ANNOUNCEMENTS}_${classIdentifier}`);
                classTopics.add(`${this.parentTopics.CLASS_EVENTS}_${classIdentifier}`);
                classTopics.add(`${this.parentTopics.CLASS_HOMEWORK}_${classIdentifier}`);
                classTopics.add(`${this.parentTopics.CLASS_CLASSWORK}_${classIdentifier}`);
                classTopics.add(`${this.parentTopics.CLASS_MESSAGES}_${classIdentifier}`);

                // Add student-specific topics
                topics.push(`${this.parentTopics.STUDENT_ATTENDANCE}_${student.id}`);
                topics.push(`${this.parentTopics.STUDENT_BIRTHDAY}_${student.id}`);
                topics.push(`${this.parentTopics.STUDENT_SPECIFIC}_${student.id}`);
            });

            // Add class topics to the main topics array
            topics.push(...Array.from(classTopics));

            return { success: true, topics };

        } catch (error) {
            logger.error('Error getting parent topics:', error);
            return { success: false, error };
        }
    }

    /**
     * Automatically subscribe parent's device to all relevant topics
     */
    async autoSubscribeParentDevice(parentId, deviceToken) {
        try {
            // Get all topics for this parent
            const { success, topics, error } = await this.getParentTopics(parentId);

            if (!success) {
                return { success: false, error };
            }

            if (!topics || topics.length === 0) {
                logger.info(`No topics found for parent ${parentId}`);
                return { success: true, subscribedTopics: [] };
            }

            const results = [];
            const errors = [];

            // Subscribe to each topic
            for (const topic of topics) {
                try {
                    const result = await pushNotificationService.subscribeToTopic(deviceToken, topic);
                    results.push({ topic, success: true, result });
                    logger.info(`Parent ${parentId} subscribed to topic: ${topic}`);
                } catch (error) {
                    errors.push({ topic, error: error.message });
                    logger.error(`Failed to subscribe parent ${parentId} to topic ${topic}:`, error);
                }
            }

            return {
                success: true,
                subscribedTopics: results,
                errors: errors,
                totalTopics: topics.length,
                successfulSubscriptions: results.length,
                failedSubscriptions: errors.length
            };

        } catch (error) {
            logger.error('Error auto-subscribing parent device:', error);
            return { success: false, error };
        }
    }

    /**
     * Unsubscribe parent's device from all topics
     */
    async autoUnsubscribeParentDevice(parentId, deviceToken) {
        try {
            // Get all topics for this parent
            const { success, topics, error } = await this.getParentTopics(parentId);

            if (!success) {
                return { success: false, error };
            }

            if (!topics || topics.length === 0) {
                return { success: true, unsubscribedTopics: [] };
            }

            const results = [];
            const errors = [];

            // Unsubscribe from each topic
            for (const topic of topics) {
                try {
                    const result = await pushNotificationService.unsubscribeFromTopic(deviceToken, topic);
                    results.push({ topic, success: true, result });
                    logger.info(`Parent ${parentId} unsubscribed from topic: ${topic}`);
                } catch (error) {
                    errors.push({ topic, error: error.message });
                    logger.error(`Failed to unsubscribe parent ${parentId} from topic ${topic}:`, error);
                }
            }

            return {
                success: true,
                unsubscribedTopics: results,
                errors: errors,
                totalTopics: topics.length,
                successfulUnsubscriptions: results.length,
                failedUnsubscriptions: errors.length
            };

        } catch (error) {
            logger.error('Error auto-unsubscribing parent device:', error);
            return { success: false, error };
        }
    }

    /**
     * Get available topics for a parent (for display purposes)
     */
    async getAvailableTopics(parentId) {
        try {
            const { success, topics, error } = await this.getParentTopics(parentId);

            if (!success) {
                return { success: false, error };
            }

            // Categorize topics for better display
            const categorizedTopics = {
                schoolWide: topics.filter(topic =>
                    topic.includes('school_wide') ||
                    topic.includes('urgent_announcements') ||
                    topic.includes('school_events')
                ),
                classSpecific: topics.filter(topic =>
                    topic.includes('class_') &&
                    !topic.includes('student_')
                ),
                studentSpecific: topics.filter(topic =>
                    topic.includes('student_')
                )
            };

            return {
                success: true,
                allTopics: topics,
                categorizedTopics,
                totalTopics: topics.length
            };

        } catch (error) {
            logger.error('Error getting available topics:', error);
            return { success: false, error };
        }
    }

    /**
     * Send notification to relevant topics based on notification type and target
     */
    async sendNotificationToTopics(notificationData) {
        try {
            const { type, targetRoles, classDivisionId, studentId, priority } = notificationData;

            const topicsToNotify = [];

            // School-wide notifications
            if (targetRoles.includes('parent') && !classDivisionId && !studentId) {
                topicsToNotify.push(this.parentTopics.SCHOOL_WIDE);

                if (priority === 'urgent') {
                    topicsToNotify.push(this.parentTopics.URGENT_ANNOUNCEMENTS);
                }
            }

            // Class-specific notifications
            if (classDivisionId) {
                // Get class information to generate topic name
                const { data: classDivision, error: classError } = await adminSupabase
                    .from('class_divisions')
                    .select(`
                        class_levels!inner(name),
                        division
                    `)
                    .eq('id', classDivisionId)
                    .single();

                if (!classError && classDivision) {
                    const className = classDivision.class_levels.name.toLowerCase().replace(/\s+/g, '');
                    const division = classDivision.division.toLowerCase();
                    const classIdentifier = `${className}_${division}`;

                    // Add class-specific topic based on notification type
                    switch (type) {
                        case this.notificationTypes.ANNOUNCEMENT:
                            topicsToNotify.push(`${this.parentTopics.CLASS_ANNOUNCEMENTS}_${classIdentifier}`);
                            break;
                        case this.notificationTypes.EVENT:
                            topicsToNotify.push(`${this.parentTopics.CLASS_EVENTS}_${classIdentifier}`);
                            break;
                        case this.notificationTypes.HOMEWORK:
                            topicsToNotify.push(`${this.parentTopics.CLASS_HOMEWORK}_${classIdentifier}`);
                            break;
                        case this.notificationTypes.CLASSWORK:
                            topicsToNotify.push(`${this.parentTopics.CLASS_CLASSWORK}_${classIdentifier}`);
                            break;
                        case this.notificationTypes.MESSAGE:
                            topicsToNotify.push(`${this.parentTopics.CLASS_MESSAGES}_${classIdentifier}`);
                            break;
                    }
                }
            }

            // Student-specific notifications
            if (studentId) {
                switch (type) {
                    case this.notificationTypes.ATTENDANCE:
                        topicsToNotify.push(`${this.parentTopics.STUDENT_ATTENDANCE}_${studentId}`);
                        break;
                    case this.notificationTypes.BIRTHDAY:
                        topicsToNotify.push(`${this.parentTopics.STUDENT_BIRTHDAY}_${studentId}`);
                        break;
                    default:
                        topicsToNotify.push(`${this.parentTopics.STUDENT_SPECIFIC}_${studentId}`);
                        break;
                }
            }

            // Send to all relevant topics
            const results = [];
            for (const topic of topicsToNotify) {
                try {
                    const result = await pushNotificationService.sendToTopic(topic, notificationData);
                    results.push({ topic, success: true, result });
                } catch (error) {
                    results.push({ topic, success: false, error: error.message });
                }
            }

            return {
                success: true,
                topicsNotified: results,
                totalTopics: topicsToNotify.length
            };

        } catch (error) {
            logger.error('Error sending notification to topics:', error);
            return { success: false, error };
        }
    }
}

export default new ParentTopicService();
