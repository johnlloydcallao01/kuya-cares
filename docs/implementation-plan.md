# Store Hours Implementation Plan

> **Status**: Phase-Based Checklist  
> **Total Phases**: 5 phases (0-4)  
> **Estimated Timeline**: 1.5-2.5 weeks  
> **Last Updated**: 2026-01-23

---

## Overview

This plan implements a complete store hours management system for Tap2Go CMS based on research from FoodPanda, Uber Eats, DoorDash, and Grubhub.

**What We're Building:**
- Weekly operating hours with timezone support
- Special hours for holidays/events
- Split shifts (e.g., lunch & dinner periods)
- Midnight-spanning hours (e.g., 10pm-2am)
- "Open Now" status display
- Admin UI for easy hours management

**Current Status:**
- ✅ JSON fields exist (`operatingHours`, `specialHours`, `delivery_hours`)
- ❌ Missing timezone field
- ❌ No validation
- ❌ No admin UI
- ❌ No query logic

---

## Phase 0: Preparation & Setup

### 0.1 Install Dependencies
- [ ] Install `date-fns` package
- [ ] Install `date-fns-tz` package
- [ ] Install `zod` package for validation

**Command**: `pnpm add date-fns date-fns-tz zod`

### 0.2 Backup Current Data
- [ ] Run backup script for merchants collection
- [ ] Export current `operatingHours` data for reference
- [ ] Document any existing custom formats

**Command**: `pnpm tsx apps/cms/backup-supabase-simple.cjs`

### 0.3 Review Current Schema
- [ ] Check `apps/cms/src/collections/Vendors.ts` (line 258)
- [ ] Check `apps/cms/src/collections/Merchants.ts` (lines 145-157, 528-533)
- [ ] Identify merchants with existing hours data

---

## Phase 1: Database Schema Enhancement

### 1.1 Add Timezone Field to Merchants
- [ ] Open `apps/cms/src/collections/Merchants.ts`
- [ ] Add `timezone` field after line 551
- [ ] Set field type: `text`
- [ ] Set default value: `'Asia/Manila'`
- [ ] Set as required: `true`
- [ ] Add description: "IANA timezone identifier (e.g., Asia/Manila, Asia/Singapore)"

### 1.2 Run Database Migration
- [ ] Create migration script `apps/cms/scripts/add-timezone-field.ts`
- [ ] Update all existing merchants with default timezone `'Asia/Manila'`
- [ ] Verify all merchants now have timezone field
- [ ] Test on staging environment first

### 1.3 Validate Schema Changes
- [ ] Restart PayloadCMS server
- [ ] Check PayloadCMS admin UI
- [ ] Verify timezone field appears in Merchant editor
- [ ] Test creating new merchant with timezone

---

## Phase 2: Core Utilities & Validation

### 2.1 Create Store Hours Utility Functions
- [ ] Create file `apps/cms/src/utils/storeHours.ts`
- [ ] Implement `isStoreOpen()` function
- [ ] Implement `getNextOpeningTime()` function
- [ ] Implement `getTodaysHours()` function
- [ ] Implement `isWithinTimeRange()` helper
- [ ] Implement `convertToMerchantTime()` helper

### 2.2 Create Validation Schemas
- [ ] Create file `apps/cms/src/schemas/storeHoursSchemas.ts`
- [ ] Define validation for `operatingHours` JSON
- [ ] Define validation for `specialHours` JSON
- [ ] Define validation for `delivery_hours` JSON
- [ ] Export validation functions

### 2.3 Add Validation to Schema
- [ ] Add validation hook to `operatingHours` field
- [ ] Add validation hook to `specialHours` field
- [ ] Add validation hook to `delivery_hours` field
- [ ] Test validation with invalid data


### 2.4 Create TypeScript Types
- [ ] Create file `apps/cms/src/types/storeHours.ts`
- [ ] Define `TimePeriod` interface
- [ ] Define `OperatingHours` interface
- [ ] Define `SpecialHour` interface
- [ ] Define `MerchantWithHours` interface

---

## Phase 3: Admin UI Components

### 3.1 Create Store Hours Editor Component
- [ ] Create file `apps/cms/src/components/StoreHoursEditor.tsx`
- [ ] Build UI for weekly schedule editing
- [ ] Add ability to add/remove time periods per day
- [ ] Add validation feedback
- [ ] Add preview of current schedule
- [ ] Test component in PayloadCMS admin

### 3.2 Create Special Hours Editor Component
- [ ] Create file `apps/cms/src/components/SpecialHoursEditor.tsx`
- [ ] Build UI for special hours management
- [ ] Add date picker
- [ ] Add "closed all day" toggle
- [ ] Add time range editor
- [ ] Add reason/description field
- [ ] Test component in PayloadCMS admin

### 3.3 Integrate Components into Schema
- [ ] Update `Merchants.ts` to use custom components
- [ ] Replace JSON textarea with StoreHoursEditor for `operatingHours`
- [ ] Replace JSON textarea with SpecialHoursEditor for `specialHours`
- [ ] Test in PayloadCMS admin interface

### 3.4 Add Timezone Selector
- [ ] Add timezone dropdown to Merchant editor
- [ ] Populate with common IANA timezones
- [ ] Allow custom timezone input
- [ ] Show current merchant time preview

---

## Phase 4: Frontend Display

### 4.1 Create Store Status Component
- [ ] Create file `apps/web/src/components/merchant/StoreStatus.tsx`
- [ ] Display "Open Now" or "Closed" badge
- [ ] Show closing time when open ("Closes at 10:00 PM")
- [ ] Show next opening time when closed ("Opens at 11:00 AM")
- [ ] Add auto-refresh every minute

### 4.2 Create Weekly Schedule Component
- [ ] Create file `apps/web/src/components/merchant/WeeklySchedule.tsx`
- [ ] Display full weekly hours in readable format
- [ ] Show split shifts properly
- [ ] Show "Closed" for days with no hours
- [ ] Display timezone information

### 5.3 Integrate into Merchant Pages
- [ ] Add StoreStatus component to merchant card listings
- [ ] Add WeeklySchedule component to merchant detail page
- [ ] Test display on various screen sizes
- [ ] Verify real-time status updates

---

## Testing Checklist

### Test Scenario 1: Regular Hours
- [ ] Set merchant hours: Monday-Friday 9:00-17:00
- [ ] Verify status shows "Open" during business hours
- [ ] Verify status shows "Closed" outside business hours
- [ ] Verify status shows "Closed" on weekends

### Test Scenario 2: Split Shifts
- [ ] Set merchant hours: 11:00-14:00, 17:00-22:00
- [ ] Verify "Open" during lunch (12:00 PM)
- [ ] Verify "Closed" between shifts (3:00 PM)
- [ ] Verify "Open" during dinner (7:00 PM)

### Test Scenario 3: Midnight-Spanning
- [ ] Set merchant hours: Friday 22:00-02:00
- [ ] Verify "Open" Friday at 11:00 PM
- [ ] Verify "Open" Saturday at 1:00 AM
- [ ] Verify "Closed" Saturday at 3:00 AM

### Test Scenario 4: Special Hours
- [ ] Add special hour: Dec 25 closed (Christmas)
- [ ] Verify merchant shows "Closed" on Dec 25
- [ ] Verify reason displays ("Christmas Day")

### Test Scenario 5: Timezone Handling
- [ ] Create merchant with timezone "Asia/Manila"
- [ ] Create merchant with timezone "America/New_York"
- [ ] Verify both show correct status for their local time

---

## Verification Plan

### Before Deployment
- [ ] All unit tests passing
- [ ] All manual test scenarios passing
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] PayloadCMS admin UI working
- [ ] Frontend components displaying correctly

### After Deployment (Staging)
- [ ] Verify timezone migration completed
- [ ] Test API endpoints in staging
- [ ] Test admin UI in staging
- [ ] Test frontend display in staging
- [ ] Check error logs for issues

### After Deployment (Production)
- [ ] Monitor API endpoint response times
- [ ] Monitor error rates
- [ ] Verify merchant hours display correctly
- [ ] Collect user feedback
- [ ] Document any issues

---

## Migration Strategy

### Pre-Migration
- [ ] Backup production database
- [ ] Test migration script on staging
- [ ] Prepare rollback plan
- [ ] Schedule migration during low-traffic period

### Migration Steps
1. [ ] Deploy code changes (without breaking existing functionality)
2. [ ] Run timezone migration script
3. [ ] Verify all merchants have timezone field
4. [ ] Enable new admin UI components
5. [ ] Monitor for errors

### Post-Migration
- [ ] Verify no data loss
- [ ] Check all merchants are accessible
- [ ] Test hours display on frontend
- [ ] Update documentation

### Rollback Plan (if needed)
- [ ] Revert code deployment
- [ ] Remove timezone field from database
- [ ] Restore from backup if necessary

---

## Documentation

### Required Documentation
- [ ] Update `apps/cms/README.md` with store hours section
- [ ] Create `apps/cms/docs/store-hours-guide.md`
- [ ] Document JSON schema format
- [ ] Document API endpoints
- [ ] Create admin user guide with screenshots

### Content to Include
- [ ] JSON schema examples
- [ ] Common scenarios (split shifts, midnight-spanning, etc.)
- [ ] Timezone list (Asia/Manila, etc.)
- [ ] Troubleshooting guide
- [ ] FAQ section

---

## Timeline Estimate

### Phase 0: Preparation (1 day)
- Install dependencies
- Backup data
- Review current schema

### Phase 1: Database Schema (1 day)
- Add timezone field
- Run migration
- Validate changes

### Phase 2: Core Utilities (2-3 days)
- Create utility functions
- Add validation
- Define TypeScript types

### Phase 3: Admin UI (2-3 days)
- Build editor components
- Integrate with schema
- Polish UI/UX

### Phase 4: Frontend Display (1-2 days)
- Create display components
- Integrate into pages
- Test responsiveness

### Testing & Documentation (2 days)
- Run all test scenarios
- Write documentation
- Final QA

**Total: ~8-12 days (1.5-2.5 weeks)**

---

## Success Criteria

### Functional Requirements
- ✅ Merchants can set weekly operating hours
- ✅ Merchants can set special hours for holidays
- ✅ System handles split shifts correctly
- ✅ System handles midnight-spanning hours
- ✅ Timezone calculations are accurate
- ✅ Frontend shows accurate "Open/Closed" status

### Non-Functional Requirements
- ✅ Admin UI is user-friendly
- ✅ API responses are fast (< 100ms)
- ✅ No data corruption during migration
- ✅ All existing merchants continue to work

### Quality Requirements
- ✅ Zero critical bugs
- ✅ Code is well-documented
- ✅ Test coverage ≥ 80%
- ✅ User feedback is positive

---

## Key Decisions for Review

### Decision 1: Default Timezone
**Question**: Should all existing merchants default to `Asia/Manila`?  
**Options**:
- A) Yes, use `Asia/Manila` for all (Philippines market)
- B) Use different defaults based on merchant location
- C) Leave null and require manual setting

**Recommendation**: Option A (simplest for deployment)

### Decision 2: Validation Strictness
**Question**: Should we enforce strict validation or allow flexible formats?  
**Options**:
- A) Strict validation (reject invalid JSON immediately)
- B) Flexible validation (accept and auto-fix common issues)
- C) No validation (trust admin input)

**Recommendation**: Option A (prevent data quality issues)

### Decision 3: UI Framework
**Question**: Which UI approach for admin components?  
**Options**:
- A) PayloadCMS native components (consistent with admin)
- B) Custom React components (more flexibility)
- C) Third-party UI library (faster development)

**Recommendation**: Option A (better integration)

---

## Risk Assessment

### High Risk Items
- **Database Migration**: Could affect all merchants
  - **Mitigation**: Test thoroughly on staging, have rollback plan
  
- **Timezone Calculations**: Complex logic, easy to get wrong
  - **Mitigation**: Comprehensive unit tests, use proven library (date-fns-tz)

### Medium Risk Items
- **Admin UI Complexity**: Users might find it confusing
  - **Mitigation**: Simple design, tooltips, examples
  
- **Performance**: Checking hours for many merchants
  - **Mitigation**: Benchmark testing, caching if needed

### Low Risk Items
- **API Endpoints**: Straightforward implementation
- **Frontend Display**: Non-critical, can fix post-launch

---

## Post-Launch Tasks

### Week 1 After Launch
- [ ] Monitor error logs daily
- [ ] Collect merchant feedback
- [ ] Fix critical bugs immediately
- [ ] Document common issues

### Week 2-4 After Launch
- [ ] Review performance metrics
- [ ] Optimize slow queries
- [ ] Add requested features
- [ ] Update documentation based on feedback

### Future Enhancements (Not in Scope)
- Analytics dashboard for peak hours
- Bulk update tools for multiple merchants
- Advanced: Zone-specific delivery hours
- Mobile app integration

---

## Quick Reference

### JSON Schema Format

**Operating Hours**:
```
{
  "monday": [{ "open": "09:00", "close": "17:00" }],
  "tuesday": [{ "open": "09:00", "close": "17:00" }],
  ...
}
```

**Special Hours**:
```
[
  {
    "date": "2026-12-25",
    "isClosed": true,
    "reason": "Christmas Day"
  }
]
```

### Time Format Rules
- Use 24-hour format: `"HH:MM"` (e.g., `"09:00"`, `"17:00"`, `"23:30"`)
- Empty array `[]` = closed all day
- Multiple periods per day = split shifts
- If close < open = spans midnight

### Priority Order
1. Special hours (highest priority)
2. Delivery hours (if set)
3. Operating hours (default)

---

**Status**: ✅ Ready for Implementation  
**Next Step**: Review checklist → Start Phase 0

