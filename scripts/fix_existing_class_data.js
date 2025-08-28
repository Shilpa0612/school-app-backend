import { adminSupabase } from '../src/config/supabase.js';

async function fixExistingClassData() {
    try {
        console.log('🔄 Fixing existing class_divisions data...');

        // Get all events that have class_division_ids but empty class_divisions
        const { data: events, error: fetchError } = await adminSupabase
            .from('calendar_events')
            .select('id, class_division_id, class_division_ids, class_divisions')
            .or('class_division_ids.neq.[],class_division_id.neq.null');

        if (fetchError) {
            console.error('❌ Error fetching events:', fetchError);
            return;
        }

        console.log(`📊 Found ${events?.length || 0} events to process`);

        let updatedCount = 0;
        let errorCount = 0;

        for (const event of events || []) {
            try {
                let classDivisions = [];

                if (event.class_division_ids) {
                    // Parse the JSON string to array
                    try {
                        classDivisions = JSON.parse(event.class_division_ids);
                    } catch (parseError) {
                        console.log(`⚠️ Could not parse class_division_ids for event ${event.id}:`, event.class_division_ids);
                        continue;
                    }
                } else if (event.class_division_id) {
                    // Single class event
                    classDivisions = [event.class_division_id];
                }

                // Update the event with the correct class_divisions
                const { error: updateError } = await adminSupabase
                    .from('calendar_events')
                    .update({ class_divisions: classDivisions })
                    .eq('id', event.id);

                if (updateError) {
                    console.error(`❌ Error updating event ${event.id}:`, updateError);
                    errorCount++;
                } else {
                    console.log(`✅ Updated event ${event.id} with ${classDivisions.length} classes`);
                    updatedCount++;
                }
            } catch (error) {
                console.error(`❌ Error processing event ${event.id}:`, error);
                errorCount++;
            }
        }

        console.log(`\n📈 Summary:`);
        console.log(`✅ Successfully updated: ${updatedCount} events`);
        console.log(`❌ Errors: ${errorCount} events`);
        console.log(`📊 Total processed: ${events?.length || 0} events`);

    } catch (error) {
        console.error('❌ Error in fixExistingClassData:', error);
    }
}

fixExistingClassData();
