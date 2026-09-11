# @encreasl/redux - Enterprise Redux Toolkit Package

Professional, enterprise-level Redux Toolkit state management solution for the Encreasl monorepo. This package provides type-safe, scalable state management with RTK Query, persistence, and optimized developer experience.

## 🚀 Features

- **🔧 Complete Redux Toolkit Setup** - Pre-configured store with middleware, dev tools, and persistence
- **🔄 RTK Query Integration** - Efficient data fetching with automatic caching and invalidation
- **💾 Redux Persist** - Automatic state persistence with selective hydration
- **🎯 TypeScript First** - Fully typed with comprehensive type definitions
- **🎨 React Integration** - Pre-built providers and typed hooks
- **🔐 Authentication Management** - Complete auth flow with token management
- **🎭 UI State Management** - Theme, notifications, modals, loading states
- **📊 Performance Optimized** - Memoized selectors and efficient updates
- **🛠️ Developer Experience** - Enhanced debugging and development tools

## 📦 Installation

The package is already installed in your apps via workspace dependencies:

```json
{
  "dependencies": {
    "@encreasl/redux": "workspace:*"
  }
}
```

## 🏗️ Architecture

### Core Components

```
@encreasl/redux/
├── store/           # Store configuration and selectors
├── slices/          # Redux slices (auth, ui)
├── api/             # RTK Query API definitions
├── hooks/           # Typed React hooks
├── providers/       # React providers
├── types/           # TypeScript definitions
└── utils/           # Utility functions
```

### State Structure

```typescript
interface RootState {
  auth: AuthState;     // User authentication and session
  ui: UIState;         // Global UI state (theme, notifications, modals)
  api: ApiState;       // RTK Query cache and metadata
}
```

## 🚀 Quick Start

### 1. Wrap Your App with Redux Provider

```tsx
// app/layout.tsx
import { ReduxProvider } from '@encreasl/redux';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
```

### 2. Use Typed Hooks in Components

```tsx
// components/UserProfile.tsx
import { useAuth, useNotifications } from '@encreasl/redux';

export function UserProfile() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { showSuccess } = useNotifications();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      <h1>Welcome, {user?.firstName}!</h1>
      <button onClick={() => showSuccess('Profile updated!')}>
        Update Profile
      </button>
    </div>
  );
}
```

### 3. Dispatch Actions

```tsx
// components/LoginForm.tsx
import { useAuth, loginUser } from '@encreasl/redux';

export function LoginForm() {
  const auth = useAuth();

  const handleLogin = async (credentials) => {
    const result = await auth.dispatch(loginUser(credentials));
    
    if (loginUser.fulfilled.match(result)) {
      // Login successful
      router.push('/dashboard');
    }
  };

  return (
    <form onSubmit={handleLogin}>
      {/* form fields */}
    </form>
  );
}
```

## 🎯 Core Hooks

### Authentication Hooks

```typescript
// Get auth state
const { user, isAuthenticated, isLoading, error } = useAuth();

// Get current user with computed properties
const currentUser = useCurrentUser(); // includes fullName, initials, etc.

// Manage user preferences
const { preferences, updatePreferences } = useUserPreferences();

// Check permissions
const { hasPermission, hasRole, isAdmin } = usePermissions();
```

### UI Hooks

```typescript
// Theme management
const { theme, effectiveTheme, isDark, setTheme, toggleTheme } = useTheme();

// Notifications
const { showSuccess, showError, showWarning, showInfo } = useNotifications();

// Modal management
const { isOpen, openModal, closeModal, updateData } = useModal('myModal');

// Loading states
const { isLoading, setLoading, clearLoading } = useLoading('myOperation');

// Error handling
const { error, hasError, setError, clearError } = useError('myOperation');
```

### Utility Hooks

```typescript
// Session management with auto-refresh
const { isAuthenticated, isSessionExpired, updateActivity } = useSession();

// Responsive design helpers
const { isMobile, isTablet, isDesktop, sidebarOpen } = useResponsive();
```

## 🔄 RTK Query API

### Using API Hooks

```typescript
// Fetch current user
const { data: user, isLoading, error } = useGetCurrentUserQuery();

// Update user profile
const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();

// Search functionality
const { data: searchResults } = useSearchQuery({ 
  query: 'maritime training',
  type: 'courses' 
});

// File upload
const [uploadFile] = useUploadFileMutation();
```

### Custom API Calls

```typescript
// Using the base API
import { api } from '@encreasl/redux';

// Add custom endpoints
const extendedApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getCustomData: builder.query({
      query: () => '/custom-endpoint',
      providesTags: ['CustomData'],
    }),
  }),
});
```

## 🎨 UI State Management

### Theme Management

```typescript
// Set theme
dispatch(setTheme('dark'));

// Toggle theme
dispatch(toggleTheme());

// Get effective theme (resolves 'system' preference)
const effectiveTheme = useAppSelector(selectEffectiveTheme);
```

### Notifications

```typescript
// Show notifications
dispatch(showSuccessNotification('Operation completed!'));
dispatch(showErrorNotification('Something went wrong'));

// Custom notification with actions
dispatch(showActionNotification(
  'Confirm this action',
  [
    { label: 'Confirm', action: 'confirm', style: 'primary' },
    { label: 'Cancel', action: 'cancel', style: 'secondary' }
  ],
  'Confirmation Required',
  'warning'
));
```

### Modal Management

```typescript
// Open modal with data
dispatch(openModal({
  id: 'userEditModal',
  data: { userId: '123' },
  options: { size: 'lg', closable: true }
}));

// Close modal
dispatch(closeModal('userEditModal'));
```

## 🔐 Authentication Flow

### Login Process

```typescript
// 1. Dispatch login action
const result = await dispatch(loginUser({ email, password }));

// 2. Handle result
if (loginUser.fulfilled.match(result)) {
  // Success: user is logged in, token stored, state updated
  router.push('/dashboard');
} else {
  // Error: show error message
  const error = result.payload;
  showError(error.message);
}
```

### Registration Process

```typescript
// Register new user
const result = await dispatch(registerUser(formData));

if (registerUser.fulfilled.match(result)) {
  showSuccess('Registration successful!');
  router.push('/welcome');
}
```

### Session Management

```typescript
// Auto-refresh token before expiry
useEffect(() => {
  const { timeUntilExpiry } = useSession();
  
  if (timeUntilExpiry && timeUntilExpiry < 5 * 60 * 1000) {
    dispatch(refreshToken());
  }
}, []);

// Update activity on user interaction
const { updateActivity } = useSession();
useEffect(() => {
  const handleActivity = () => updateActivity();
  
  window.addEventListener('click', handleActivity);
  window.addEventListener('keypress', handleActivity);
  
  return () => {
    window.removeEventListener('click', handleActivity);
    window.removeEventListener('keypress', handleActivity);
  };
}, []);
```

## 🎯 Advanced Usage

### Custom Selectors

```typescript
import { createSelector } from '@reduxjs/toolkit';
import { selectAuthUser } from '@encreasl/redux';

// Create custom memoized selector
const selectUserCourses = createSelector(
  [selectAuthUser],
  (user) => user?.enrolledCourses || []
);
```

### Middleware Integration

```typescript
// Add custom middleware
import { store } from '@encreasl/redux';

const customMiddleware = (store) => (next) => (action) => {
  // Custom logic
  return next(action);
};

// Middleware is already configured in the package
```

### Environment-Specific Providers

```typescript
// Development
import { DevReduxProvider } from '@encreasl/redux';

// Production
import { ProductionReduxProvider } from '@encreasl/redux';

// Minimal (for testing)
import { MinimalReduxProvider } from '@encreasl/redux';
```

## 🛠️ Development Tools

### Redux DevTools

The package includes enhanced Redux DevTools configuration:

- Action sanitization (passwords redacted)
- State sanitization (tokens redacted)
- Time-travel debugging
- Action replay

### Debug Utilities

```typescript
// Access store in browser console (development only)
window.__ENCREASL_REDUX__.store
window.__ENCREASL_REDUX__.persistor

// Reset store programmatically
import { resetReduxStore } from '@encreasl/redux';
await resetReduxStore();
```

## 📊 Performance Optimization

### Memoized Selectors

All selectors are memoized using `createSelector` for optimal performance:

```typescript
// Automatically memoized
const userFullName = useAppSelector(selectUserFullName);
const unreadNotifications = useAppSelector(selectUnreadNotifications);
```

### Selective Persistence

Only essential data is persisted:

```typescript
// Persisted: auth tokens, user preferences
// Not persisted: temporary UI state, API cache
```

### Bundle Optimization

- Tree-shakable exports
- Selective imports
- Optimized for code splitting

## 🔧 Configuration

### Environment Variables

```env
NEXT_PUBLIC_API_URL=https://api.encreasl.com
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### Custom Configuration

```typescript
import { createStore } from '@encreasl/redux';

const customStore = createStore({
  // Custom preloaded state
  auth: { user: null, isAuthenticated: false }
});
```

## 🧪 Testing

### Testing with Redux

```typescript
import { MinimalReduxProvider, createStore } from '@encreasl/redux';

// Test component with Redux
const TestWrapper = ({ children }) => (
  <MinimalReduxProvider store={createStore()}>
    {children}
  </MinimalReduxProvider>
);

render(<MyComponent />, { wrapper: TestWrapper });
```

### Mock Store

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { authSlice, uiSlice } from '@encreasl/redux';

const mockStore = configureStore({
  reducer: {
    auth: authSlice.reducer,
    ui: uiSlice.reducer,
  },
  preloadedState: {
    auth: { user: mockUser, isAuthenticated: true },
    ui: { theme: 'light', notifications: [] },
  },
});
```

## 📚 API Reference

### Actions

- **Auth**: `loginUser`, `registerUser`, `logoutUser`, `refreshToken`, `updateUserProfile`
- **UI**: `setTheme`, `addNotification`, `openModal`, `setLoading`, `setError`

### Selectors

- **Auth**: `selectAuthUser`, `selectIsAuthenticated`, `selectUserPermissions`
- **UI**: `selectUITheme`, `selectNotifications`, `selectActiveModals`

### Hooks

- **Auth**: `useAuth`, `useCurrentUser`, `usePermissions`, `useSession`
- **UI**: `useTheme`, `useNotifications`, `useModal`, `useLoading`

## 🤝 Contributing

This package follows the monorepo's contribution guidelines. When adding new features:

1. Add types to `src/types/`
2. Create slices in `src/slices/`
3. Add selectors to `src/store/selectors.ts`
4. Create hooks in `src/hooks/`
5. Update exports in `src/index.ts`
6. Add tests and documentation

## 📄 License

MIT License - see the monorepo's LICENSE file for details.

---

**Built with ❤️ for the Encreasl platform**
