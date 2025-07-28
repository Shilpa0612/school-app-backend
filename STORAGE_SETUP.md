# Supabase Storage Setup Guide

## Overview
This document outlines the complete setup for file storage in the School App, including bucket creation, policy configuration, and best practices for file handling.

## Table of Contents
1. [Bucket Setup](#bucket-setup)
2. [Storage Policies](#storage-policies)
3. [File Structure](#file-structure)
4. [Implementation Guide](#implementation-guide)
5. [Security Best Practices](#security-best-practices)
6. [Monitoring](#monitoring)
7. [Code Examples](#code-examples)

## Bucket Setup

### 1. Create Buckets
Access Supabase Dashboard > Storage > Create Bucket

#### homework-attachments
```properties
Name: homework-attachments
Public: Yes
File Size Limit: 10MB
Allowed MIME Types:
- application/pdf
- image/jpeg
- image/png
- application/msword
- application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

#### profile-pictures
```properties
Name: profile-pictures
Public: Yes
File Size Limit: 2MB
Allowed MIME Types:
- image/jpeg
- image/png
```

## Storage Policies

### Homework Attachments Policies

```sql
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload homework attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'homework-attachments' AND
    (auth.role() = 'authenticated')
);

-- Allow teachers to delete their own uploads
CREATE POLICY "Teachers can delete their homework attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'homework-attachments' AND
    (EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'teacher'
    ))
);

-- Allow public read access
CREATE POLICY "Public can view homework attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'homework-attachments');

-- Allow teachers to update their files
CREATE POLICY "Teachers can update their homework attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'homework-attachments' AND
    (EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role = 'teacher'
    ))
);
```

### Profile Pictures Policies

```sql
-- Allow authenticated users to upload their own profile pictures
CREATE POLICY "Users can upload their own profile pictures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'profile-pictures' AND
    (auth.role() = 'authenticated') AND
    (file_name LIKE auth.uid() || '/%')
);

-- Allow users to update their own profile pictures
CREATE POLICY "Users can update their own profile pictures"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'profile-pictures' AND
    (file_name LIKE auth.uid() || '/%')
);

-- Allow users to delete their own profile pictures
CREATE POLICY "Users can delete their own profile pictures"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'profile-pictures' AND
    (file_name LIKE auth.uid() || '/%')
);

-- Allow public read access
CREATE POLICY "Public can view profile pictures"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');
```

## File Structure

### Homework Attachments
```
homework-attachments/
├── {homework_id}/
│   ├── {timestamp}_{original_filename}
│   └── ...
```

### Profile Pictures
```
profile-pictures/
├── {user_id}/
│   ├── avatar.jpg
│   └── ...
```

## Implementation Guide

### 1. File Upload Implementation

```javascript
// Utility function for homework attachment upload
const uploadHomeworkAttachment = async (homeworkId, file) => {
    try {
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `${timestamp}_${file.name}`;
        const filePath = `${homeworkId}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('homework-attachments')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Error uploading file:', error);
        throw error;
    }
};

// Utility function for profile picture upload
const uploadProfilePicture = async (userId, file) => {
    try {
        const fileName = 'avatar.jpg';
        const filePath = `${userId}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('profile-pictures')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) throw error;
        return data;
    } catch (error) {
        logger.error('Error uploading profile picture:', error);
        throw error;
    }
};
```

### 2. File Download Implementation

```javascript
// Get public URL for homework attachment
const getHomeworkFileUrl = async (homeworkId, fileName) => {
    const { data } = supabase.storage
        .from('homework-attachments')
        .getPublicUrl(`${homeworkId}/${fileName}`);
    
    return data.publicUrl;
};

// Get public URL for profile picture
const getProfilePictureUrl = async (userId) => {
    const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(`${userId}/avatar.jpg`);
    
    return data.publicUrl;
};
```

## Security Best Practices

### 1. File Validation
```javascript
const validateFile = (file, allowedTypes, maxSize) => {
    if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type');
    }
    
    if (file.size > maxSize) {
        throw new Error('File size exceeds limit');
    }
};
```

### 2. File Naming
```javascript
const generateSecureFileName = (originalName) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const ext = originalName.split('.').pop();
    return `${timestamp}_${randomString}.${ext}`;
};
```

### 3. Security Checklist
- ✓ Validate file types on client and server
- ✓ Implement file size restrictions
- ✓ Use secure file naming
- ✓ Implement virus scanning (recommended)
- ✓ Set up CORS policies
- ✓ Implement rate limiting
- ✓ Regular security audits

## Monitoring

### 1. Storage Monitoring Setup
```sql
-- Create storage usage tracking
CREATE OR REPLACE FUNCTION public.track_storage_usage()
RETURNS trigger AS $$
BEGIN
    -- Track storage metrics
    INSERT INTO storage_metrics (
        bucket_id,
        total_size,
        file_count,
        recorded_at
    )
    SELECT
        bucket_id,
        SUM(metadata->>'size')::bigint,
        COUNT(*),
        NOW()
    FROM storage.objects
    GROUP BY bucket_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Alert Setup
```javascript
// Example monitoring thresholds
const STORAGE_ALERTS = {
    BUCKET_SIZE_THRESHOLD: 1000000000, // 1GB
    FILE_COUNT_THRESHOLD: 10000,
    FAILED_UPLOAD_THRESHOLD: 100
};
```

## Code Examples

### 1. Complete File Upload Example
```javascript
const handleHomeworkUpload = async (req, res) => {
    try {
        const { homeworkId } = req.params;
        const file = req.file;

        // Validate file
        validateFile(file, [
            'application/pdf',
            'image/jpeg',
            'image/png'
        ], 10 * 1024 * 1024); // 10MB

        // Upload file
        const result = await uploadHomeworkAttachment(homeworkId, file);

        // Save to database
        await saveFileReference(homeworkId, result.path);

        res.json({
            status: 'success',
            data: { file: result }
        });
    } catch (error) {
        logger.error('Upload failed:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};
```

### 2. File Download Example
```javascript
const downloadHomeworkFile = async (req, res) => {
    try {
        const { homeworkId, fileId } = req.params;

        // Get file metadata
        const { data: file, error } = await supabase.storage
            .from('homework-attachments')
            .download(`${homeworkId}/${fileId}`);

        if (error) throw error;

        // Set response headers
        res.setHeader('Content-Type', file.type);
        res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);

        // Send file
        res.send(file);
    } catch (error) {
        logger.error('Download failed:', error);
        res.status(400).json({
            status: 'error',
            message: error.message
        });
    }
};
```

## Troubleshooting

### Common Issues and Solutions

1. **Upload Failed**
   - Check file size limits
   - Verify file type
   - Ensure proper authentication
   - Check storage quota

2. **Access Denied**
   - Verify user permissions
   - Check policy configuration
   - Ensure proper token

3. **File Not Found**
   - Verify file path
   - Check if file was deleted
   - Ensure bucket exists

### Support

For additional support:
1. Check Supabase documentation
2. Review server logs
3. Contact system administrator 