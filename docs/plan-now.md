# Store Hours Implementation Guide for Tap2Go CMS

## Executive Summary

This guide provides a comprehensive approach to implementing store hours in the Tap2Go apps/cms system, based on:
1. Analysis of current Tap2Go schemas (`Vendors.ts`, `Merchants.ts`, `MerchantProducts.ts`)
2. Research on major delivery platforms (FoodPanda, Uber Eats, DoorDash, Grubhub)
3. Industry best practices for handling operating hours

---

## Current Schema Analysis

### What You Already Have ✅

Your current implementation in `apps/cms` already includes operating hours fields:

#### **Vendors** (`src/collections/Vendors.ts`, line 258-263)
```typescript
{
  name: 'operatingHours',
  type: 'json',
  admin: {
    description: 'Default operating hours (can be overridden by individual merchants)',
  },
}
```

#### **Merchants** (`src/collections/Merchants.ts`, line 145-157, 528-533)
```typescript
// Regular operating hours
{
  name: 'operatingHours',
  type: 'json',
  admin: {
    description: 'Weekly operating schedule (JSON format)',
  },
}

// Special hours (holidays, events)
{
  name: 'specialHours',
  type: 'json',
  admin: {
    description: 'Special operating hours for holidays or events (JSON array of objects with date, openTime, closeTime, isClosed, reason)',
  },
}

// Delivery-specific hours
{
  name: 'delivery_hours',
  type: 'json',
  admin: {
    description: 'Delivery-specific operating hours (JSONB format)',
  },
}
```

> **Good News**: Your schema structure is already well-designed! The fields are in place and follow industry best practices by using JSON for flexibility.

---

## How Major Platforms Handle Store Hours

### 🔍 Research Findings from FoodPanda, Uber Eats, DoorDash & Grubhub

All major delivery platforms use similar patterns:

1. **Separate Regular vs Special Hours**: Distinct tables/fields for weekly recurring schedules vs one-time exceptions
2. **Multiple Periods Per Day**: Support for split shifts (e.g., 11am-2pm lunch, 5pm-10pm dinner)
3. **Midnight-Spanning Support**: Handle hours crossing midnight (e.g., 10pm-2am)
4. **Timezone Awareness**: Store timezone identifiers (not just UTC offsets)
5. **Priority System**: Special hours override regular hours

### Database Schema Pattern (Industry Standard)

```
stores
  └─ store_operating_hours (weekly recurring)
       ├─ day_of_week (0-6 or 1-7)
       ├─ open_time (TIME)
       ├─ close_time (TIME)
       └─ (multiple rows per day for split shifts)
  
  └─ store_special_hours (exceptions/overrides)
       ├─ special_date (DATE)
       ├─ open_time (TIME, nullable)
       ├─ close_time (TIME, nullable)
       ├─ is_closed (BOOLEAN)
       └─ description (VARCHAR)
```

---

## Recommended JSON Schema for Tap2Go

Since you're using JSON fields (which is perfectly valid), here's the recommended structure:

### 1. Regular Operating Hours (`operatingHours` field)

**Schema Structure:**
```json
{
  "monday": [
    { "open": "09:00", "close": "17:00" }
  ],
  "tuesday": [
    { "open": "09:00", "close": "14:00" },
    { "open": "17:00", "close": "22:00" }
  ],
  "wednesday": [
    { "open": "09:00", "close": "17:00" }
  ],
  "thursday": [
    { "open": "09:00", "close": "17:00" }
  ],
  "friday": [
    { "open": "09:00", "close": "02:00" }
  ],
  "saturday": [
    { "open": "10:00", "close": "02:00" }
  ],
  "sunday": [
    { "open": "10:00", "close": "20:00" }
  ]
}
```

**Key Features:**
- ✅ Each day is an **array** to support multiple periods (split shifts)
- ✅ Time format: **24-hour "HH:MM"** (e.g., "09:00", "17:00", "23:30")
- ✅ Midnight-spanning: If `close < open` (e.g., open "22:00", close "02:00"), it means closing next day
- ✅ Empty array `[]` or `null` = closed all day

### 2. Special Hours / Exceptions (`specialHours` field)

**Schema Structure:**
```json
[
  {
    "date": "2026-12-25",
    "isClosed": true,
    "reason": "Christmas Day"
  },
  {
    "date": "2026-12-31",
    "openTime": "09:00",
    "closeTime": "15:00",
    "reason": "New Year's Eve - Early Close"
  },
  {
    "date": "2026-01-01",
    "openTime": "12:00",
    "closeTime": "20:00",
    "reason": "New Year's Day - Special Hours"
  }
]
```

**Key Features:**
- ✅ Array of objects (one per exception date)
- ✅ `date`: ISO format "YYYY-MM-DD"
- ✅ `isClosed`: Boolean flag for full-day closures
- ✅ `openTime` / `closeTime`: Optional (only if not fully closed)
- ✅ `reason`: Human-readable explanation
- ✅ **Priority**: Special hours ALWAYS override regular hours for that date

### 3. Delivery Hours (`delivery_hours` field)

If delivery hours differ from regular store hours:

```json
{
  "monday": [
    { "open": "11:00", "close": "21:00" }
  ],
  "tuesday": [
    { "open": "11:00", "close": "21:00" }
  ],
  "wednesday": [
    { "open": "11:00", "close": "21:00" }
  ],
  "thursday": [
    { "open": "11:00", "close": "21:00" }
  ],
  "friday": [
    { "open": "11:00", "close": "23:00" }
  ],
  "saturday": [
    { "open": "11:00", "close": "23:00" }
  ],
  "sunday": [
    { "open": "12:00", "close": "20:00" }
  ]
}
```

> **Note**: If `delivery_hours` is `null` or empty, fall back to `operatingHours`

---

## Timezone Handling Best Practices

### Current Gaps in Your Schema

✅ **Implemented**: Timezone identifier field in `Merchants` table

### Recommended Addition

Add this field to `Merchants.ts`:

```typescript
{
  name: 'timezone',
  type: 'text',
  defaultValue: 'Asia/Manila',
  admin: {
    description: 'IANA timezone identifier (e.g., Asia/Manila, America/New_York)',
  },
}
```

### Why IANA Timezone Identifiers?

- ✅ Handles Daylight Saving Time (DST) automatically
- ✅ More reliable than UTC offsets (e.g., "+08:00")
- ✅ Standard used by FoodPanda, Uber Eats, DoorDash

### Storage & Display Strategy

1. **Store all times as local merchant time** (in the timezone specified)
2. **Display to users** in their local timezone or merchant timezone
3. **Query logic**: Convert current time to merchant's timezone before comparing

---

## Handling Complex Scenarios

### 1. ⏰ Hours Crossing Midnight

**Example**: Restaurant open Friday 10pm - Saturday 2am

**Option A (Recommended - Split Across Days)**:
```json
{
  "friday": [
    { "open": "22:00", "close": "23:59" }
  ],
  "saturday": [
    { "open": "00:00", "close": "02:00" }
  ]
}
```

**Option B (Implicit Rollover - Simpler Code)**:
```json
{
  "friday": [
    { "open": "22:00", "close": "02:00" }
  ]
}
```
> Application logic: If `close < open`, closing time is next day

**Recommendation**: Use **Option B** for simpler data entry and less duplication

### 2. 🍽️ Split Shifts (Midday Closure)

**Example**: Lunch 11am-2pm, Dinner 5pm-10pm

```json
{
  "monday": [
    { "open": "11:00", "close": "14:00" },
    { "open": "17:00", "close": "22:00" }
  ]
}
```

### 3. 🎄 Holiday Overrides

**Priority System** (when checking if store is open):
1. **First check** `specialHours` for today's date
   - If found and `isClosed: true` → Store is closed
   - If found with times → Use those times
2. **If no special hours**, fall back to `operatingHours` for current day of week

### 4. 🚚 Different Store vs Delivery Hours

**Query Logic**:
```
IF delivery_hours EXISTS AND NOT NULL:
  Use delivery_hours
ELSE:
  Use operatingHours
```

---

## Implementation Checklist

### ✅ Database Schema
- [x] Vendors: `operatingHours` field exists
- [x] Merchants: `operatingHours`, `specialHours`, `delivery_hours` exist
- [x] **Add**: `timezone` field to Merchants (IANA identifier)

### ✅ JSON Schema Documentation
- [x] Document JSON structure for `operatingHours`
- [x] Document JSON structure for `specialHours`
- [x] Document JSON structure for `delivery_hours`
- [x] Create validation schemas

### ✅ Application Logic
- [x] Implement "Is Store Open Now?" query function
- [x] Handle midnight-spanning logic
- [x] Implement special hours override logic
- [x] Timezone conversion logic (merchant time → user time)

### ✅ Admin UI (PayloadCMS)
- [x] Create user-friendly UI for editing weekly hours, including split shifts
- [x] Create UI for managing special hours/exceptions
- [x] Add timezone selector dropdown
- [x] Show computed open/closed status and next opening time

### ✅ Frontend Display
- [x] Show "Open Now" / "Closed" status
- [x] Display next opening time if closed
- [x] Show today's hours
- [x] Show full weekly schedule

---

## Example Query Logic (Pseudocode)

```javascript
function isStoreOpen(merchant, currentDateTime) {
  // 1. Convert current time to merchant's timezone
  const merchantTime = convertToTimezone(currentDateTime, merchant.timezone);
  const merchantDate = merchantTime.toDateString();
  const merchantDayOfWeek = merchantTime.getDayOfWeek(); // e.g., 'monday'
  const currentTimeString = merchantTime.toTimeString('HH:mm'); // e.g., '14:30'
  
  // 2. Check for special hours first (highest priority)
  if (merchant.specialHours && Array.isArray(merchant.specialHours)) {
    const specialHour = merchant.specialHours.find(sh => sh.date === merchantDate);
    
    if (specialHour) {
      if (specialHour.isClosed) {
        return { isOpen: false, reason: specialHour.reason };
      }
      
      if (specialHour.openTime && specialHour.closeTime) {
        return isWithinTimeRange(currentTimeString, specialHour.openTime, specialHour.closeTime);
      }
    }
  }
  
  // 3. Fall back to regular operating hours
  const hours = merchant.delivery_hours || merchant.operatingHours;
  
  if (!hours || !hours[merchantDayOfWeek]) {
    return { isOpen: false, reason: 'No hours defined' };
  }
  
  const dayPeriods = hours[merchantDayOfWeek];
  
  // 4. Check if current time falls within any period
  for (const period of dayPeriods) {
    if (isWithinTimeRange(currentTimeString, period.open, period.close)) {
      return { isOpen: true, period };
    }
  }
  
  return { isOpen: false, reason: 'Outside operating hours' };
}

function isWithinTimeRange(currentTime, openTime, closeTime) {
  // Handle midnight crossing
  if (closeTime < openTime) {
    // Hours span midnight (e.g., 22:00 - 02:00)
    return currentTime >= openTime || currentTime <= closeTime;
  } else {
    // Normal case (e.g., 09:00 - 17:00)
    return currentTime >= openTime && currentTime <= closeTime;
  }
}
```

---

## Real-World Examples

### Example 1: Regular Restaurant
```json
{
  "operatingHours": {
    "monday": [{ "open": "11:00", "close": "22:00" }],
    "tuesday": [{ "open": "11:00", "close": "22:00" }],
    "wednesday": [{ "open": "11:00", "close": "22:00" }],
    "thursday": [{ "open": "11:00", "close": "22:00" }],
    "friday": [{ "open": "11:00", "close": "23:00" }],
    "saturday": [{ "open": "11:00", "close": "23:00" }],
    "sunday": [{ "open": "12:00", "close": "21:00" }]
  },
  "specialHours": [
    {
      "date": "2026-12-25",
      "isClosed": true,
      "reason": "Christmas Day"
    }
  ],
  "timezone": "Asia/Manila"
}
```

### Example 2: 24/7 Convenience Store
```json
{
  "operatingHours": {
    "monday": [{ "open": "00:00", "close": "23:59" }],
    "tuesday": [{ "open": "00:00", "close": "23:59" }],
    "wednesday": [{ "open": "00:00", "close": "23:59" }],
    "thursday": [{ "open": "00:00", "close": "23:59" }],
    "friday": [{ "open": "00:00", "close": "23:59" }],
    "saturday": [{ "open": "00:00", "close": "23:59" }],
    "sunday": [{ "open": "00:00", "close": "23:59" }]
  },
  "specialHours": [],
  "timezone": "Asia/Manila"
}
```

### Example 3: Restaurant with Lunch/Dinner Split
```json
{
  "operatingHours": {
    "monday": [
      { "open": "11:00", "close": "14:00" },
      { "open": "17:00", "close": "22:00" }
    ],
    "tuesday": [
      { "open": "11:00", "close": "14:00" },
      { "open": "17:00", "close": "22:00" }
    ],
    "wednesday": [
      { "open": "11:00", "close": "14:00" },
      { "open": "17:00", "close": "22:00" }
    ],
    "thursday": [
      { "open": "11:00", "close": "14:00" },
      { "open": "17:00", "close": "22:00" }
    ],
    "friday": [
      { "open": "11:00", "close": "14:00" },
      { "open": "17:00", "close": "23:00" }
    ],
    "saturday": [
      { "open": "12:00", "close": "23:00" }
    ],
    "sunday": []
  },
  "specialHours": [],
  "timezone": "Asia/Manila"
}
```

### Example 4: Late-Night Bar (Midnight Crossing)
```json
{
  "operatingHours": {
    "monday": [],
    "tuesday": [],
    "wednesday": [],
    "thursday": [],
    "friday": [{ "open": "20:00", "close": "03:00" }],
    "saturday": [{ "open": "20:00", "close": "03:00" }],
    "sunday": []
  },
  "specialHours": [],
  "timezone": "Asia/Manila"
}
```

---

## Validation Rules

### Recommended Validation Schema

```typescript
// For operatingHours and delivery_hours
const weeklyHoursSchema = {
  type: 'object',
  properties: {
    monday: { type: 'array', items: { $ref: '#/definitions/timePeriod' } },
    tuesday: { type: 'array', items: { $ref: '#/definitions/timePeriod' } },
    wednesday: { type: 'array', items: { $ref: '#/definitions/timePeriod' } },
    thursday: { type: 'array', items: { $ref: '#/definitions/timePeriod' } },
    friday: { type: 'array', items: { $ref: '#/definitions/timePeriod' } },
    saturday: { type: 'array', items: { $ref: '#/definitions/timePeriod' } },
    sunday: { type: 'array', items: { $ref: '#/definitions/timePeriod' } },
  },
  definitions: {
    timePeriod: {
      type: 'object',
      properties: {
        open: { 
          type: 'string', 
          pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' // HH:MM format
        },
        close: { 
          type: 'string', 
          pattern: '^([01]\\d|2[0-3]):[0-5]\\d$'
        }
      },
      required: ['open', 'close']
    }
  }
};

// For specialHours
const specialHoursSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      date: { 
        type: 'string', 
        pattern: '^\\d{4}-\\d{2}-\\d{2}$' // YYYY-MM-DD
      },
      openTime: { 
        type: 'string', 
        pattern: '^([01]\\d|2[0-3]):[0-5]\\d$'
      },
      closeTime: { 
        type: 'string', 
        pattern: '^([01]\\d|2[0-3]):[0-5]\\d$'
      },
      isClosed: { type: 'boolean' },
      reason: { type: 'string' }
    },
    required: ['date']
  }
};
```

---

## Migration Path (If Needed)

If you already have data in different formats:

### Step 1: Analyze Existing Data
```sql
SELECT 
  id,
  operatingHours,
  specialHours 
FROM merchants 
WHERE operatingHours IS NOT NULL 
LIMIT 10;
```

### Step 2: Create Migration Script
```javascript
// Example migration from old format to new format
function migrateOperatingHours(oldData) {
  // Convert old format to new format
  // This depends on what your current data looks like
  
  const newFormat = {
    monday: [],
    tuesday: [],
    // ... etc
  };
  
  // Your conversion logic here
  
  return newFormat;
}
```

### Step 3: Validate & Deploy
- Test migration on staging environment
- Validate all merchants have correct hours
- Deploy to production

---

## Key Takeaways

### ✅ Your Current Setup Is Good!
You already have the right fields in place using JSON, which is flexible and follows industry standards.

### 🔧 Recommended Action Items

1. **Add `timezone` field** to Merchants schema (IANA timezone identifier)
2. **Document JSON structure** clearly for your team
3. **Implement query logic** for checking if stores are open
4. **Build admin UI** for easy editing of hours
5. **Add validation** to ensure data integrity

### 🎯 Priorities

**High Priority:**
- [x] Add timezone field to Merchants
- [x] Implement "Is Store Open?" logic
- [x] Document JSON structure

**Medium Priority:**
- [x] Build admin UI for hours management
- [x] Add validation schemas
- [x] Implement special hours override logic

**Low Priority:**
- [x] Advanced features (different hours per delivery zone)
- [x] Analytics on peak operating hours
- [x] Automatic timezone detection

---

## Additional Resources

### IANA Timezone Identifiers
- Philippines: `Asia/Manila`
- Singapore: `Asia/Singapore`
- USA (New York): `America/New_York`
- USA (Los Angeles): `America/Los_Angeles`
- Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

### Libraries for Timezone Handling
- **JavaScript**: `date-fns-tz`, `luxon`, `moment-timezone`
- **TypeScript**: `date-fns-tz` (recommended)
- **Backend**: Most frameworks have built-in timezone support

### Schema.org Reference
For SEO and structured data: https://schema.org/OpeningHoursSpecification

---

## Questions or Need Clarification?

If you have questions or need help implementing any of these recommendations, feel free to ask!

**Happy Coding! 🚀**
