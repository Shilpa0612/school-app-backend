// Update academic year
router.put('/years/:id',
    authenticate,
    authorize(['admin', 'principal']),
    [
        body('name').optional().trim(),
        body('start_date').optional().isDate(),
        body('end_date').optional().isDate(),
        body('is_active').optional().isBoolean()
    ],
    async (req, res, next) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { id } = req.params;
            const updates = req.body;

            // If setting this year as active
            if (updates.is_active) {
                // First deactivate all other years
                const { error: updateError } = await adminSupabase
                    .from('academic_years')
                    .update({ is_active: false })
                    .neq('id', id);

                if (updateError) {
                    logger.error('Error deactivating other academic years:', updateError);
                    throw updateError;
                }
            }

            // Update the specified academic year
            const { data, error } = await adminSupabase
                .from('academic_years')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            res.json({
                status: 'success',
                data: { academic_year: data }
            });

        } catch (error) {
            next(error);
        }
    }
);
