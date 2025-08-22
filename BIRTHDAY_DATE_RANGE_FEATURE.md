# Birthday API Date Range Feature

## Overview

The `/api/birthdays/upcoming` endpoint now supports flexible date range filtering, allowing you to specify custom date ranges or use predefined periods for retrieving student birthdays.

## New Query Parameters

### Date Range Parameters

- **`start_date`** (optional): Start date in YYYY-MM-DD format
- **`end_date`** (optional): End date in YYYY-MM-DD format
- **`days_ahead`** (optional): Number of days from today to look ahead

### Existing Parameters

- **`class_division_id`** (optional): Filter by specific class division
- **`page`** (optional): Page number for pagination (default: 1)
- **`limit`** (optional): Number of results per page (default: 20)

## Usage Examples

### 1. Default Behavior (Next 7 Days)

```http
GET /api/birthdays/upcoming
```

Returns birthdays for the next 7 days from today.

### 2. Custom Date Range

```http
GET /api/birthdays/upcoming?start_date=2024-01-01&end_date=2024-01-31
```

Returns all birthdays in January 2024.

### 3. Custom Days Ahead

```http
GET /api/birthdays/upcoming?days_ahead=30
```

Returns birthdays for the next 30 days from today.

### 4. With Class Division Filter

```http
GET /api/birthdays/upcoming?start_date=2024-03-01&end_date=2024-03-31&class_division_id=5
```

Returns March 2024 birthdays for students in class division ID 5.

### 5. Pagination with Date Range

```http
GET /api/birthdays/upcoming?start_date=2024-06-01&end_date=2024-08-31&page=2&limit=10
```

Returns page 2 of summer 2024 birthdays with 10 results per page.

## Response Format

The API response now includes a `date_range` object with information about the requested date range:

```json
{
  "status": "success",
  "data": {
    "upcoming_birthdays": [...],
    "total_count": 15,
    "class_division_id": null,
    "date_range": {
      "start_date": "2024-01-01",
      "end_date": "2024-01-31",
      "total_days": 31
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "total_pages": 1,
      "has_next": false,
      "has_prev": false
    }
  }
}
```

## Date Format Requirements

- **Format**: YYYY-MM-DD (ISO 8601 date format)
- **Examples**:
  - `2024-01-01` (January 1, 2024)
  - `2024-12-31` (December 31, 2024)
  - `2025-02-15` (February 15, 2025)

## Validation Rules

1. **Date Format**: Both `start_date` and `end_date` must be valid dates in YYYY-MM-DD format
2. **Date Logic**: `start_date` cannot be after `end_date`
3. **Required Pairs**: If `start_date` is provided, `end_date` is also required (and vice versa)
4. **Fallback**: If no date parameters are provided, defaults to next 7 days

## Error Responses

### Invalid Date Format

```json
{
  "status": "error",
  "message": "Invalid date format. Use YYYY-MM-DD"
}
```

### Start Date After End Date

```json
{
  "status": "error",
  "message": "start_date cannot be after end_date"
}
```

### Missing Date Parameter

```json
{
  "status": "error",
  "message": "Both start_date and end_date are required for date range filtering"
}
```

## Use Cases

### Academic Planning

- **Monthly Reports**: Get all birthdays in a specific month
- **Quarterly Planning**: Retrieve birthdays for the next quarter
- **Academic Year**: Get birthdays for the entire academic year

### Event Planning

- **Birthday Celebrations**: Plan monthly or weekly birthday events
- **Resource Allocation**: Prepare for birthday-related activities
- **Staff Scheduling**: Organize birthday celebrations efficiently

### Administrative Tasks

- **Birthday Cards**: Send birthday wishes to students
- **Special Programs**: Plan birthday-related activities
- **Parent Communication**: Notify parents of upcoming birthdays

## Testing

Use the provided test script to verify the functionality:

```bash
node test_birthday_date_range.js
```

The test script covers:

- Default behavior
- Custom date ranges
- Days ahead parameter
- Class division filtering
- Error cases
- Pagination

## Backward Compatibility

This enhancement maintains full backward compatibility:

- Existing API calls without date parameters work exactly as before
- The default behavior (next 7 days) remains unchanged
- All existing query parameters continue to function

## Performance Considerations

- Date range filtering is performed in-memory after fetching student data
- Large date ranges may impact performance with many students
- Consider using smaller date ranges for better performance
- Pagination helps manage large result sets efficiently
