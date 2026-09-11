/**
 * Authentication Slice
 * 
 * Manages user authentication state, login/logout actions,
 * and session management for the Encreasl platform.
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { 
  AuthState, 
  User, 
  LoginCredentials, 
  RegisterData,
  ApiError,
  AsyncThunkConfig 
} from '../types';

// ============================================================================
// Initial State
// ============================================================================

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  loginAttempts: 0,
  lastActivity: Date.now(),
  sessionExpiry: null,
};

// ============================================================================
// Async Thunks
// ============================================================================

// Login user
export const loginUser = createAsyncThunk<
  { user: User; token: string; refreshToken: string; expiresIn: number },
  LoginCredentials,
  AsyncThunkConfig
>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      // Use the configured API URL for PayloadCMS
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://grandline-cms.vercel.app/api';
      const response = await fetch(`${apiUrl}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          message: error.message || 'Login failed',
          status: response.status,
        } as ApiError);
      }

      const data = await response.json();
      
      // Store token in localStorage for persistence
      if (credentials.rememberMe) {
        localStorage.setItem('encreasl_token', data.token);
        localStorage.setItem('encreasl_refresh_token', data.refreshToken);
      }

      return data;
    } catch (error) {
      return rejectWithValue({
        message: 'Network error occurred',
        status: 0,
      } as ApiError);
    }
  }
);

// Register user
export const registerUser = createAsyncThunk<
  { user: User; token: string; refreshToken: string; expiresIn: number },
  RegisterData,
  AsyncThunkConfig
>(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://grandline-cms.vercel.app/api';
      const response = await fetch(`${apiUrl}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          message: error.message || 'Registration failed',
          status: response.status,
          details: error.details,
        } as ApiError);
      }

      const data = await response.json();
      
      // Store token after successful registration
      localStorage.setItem('encreasl_token', data.token);
      localStorage.setItem('encreasl_refresh_token', data.refreshToken);

      return data;
    } catch (error) {
      return rejectWithValue({
        message: 'Network error occurred',
        status: 0,
      } as ApiError);
    }
  }
);

// Refresh token
export const refreshToken = createAsyncThunk<
  { token: string; refreshToken: string; expiresIn: number },
  void,
  AsyncThunkConfig
>(
  'auth/refreshToken',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const currentRefreshToken = auth.refreshToken || localStorage.getItem('encreasl_refresh_token');

      if (!currentRefreshToken) {
        return rejectWithValue({
          message: 'No refresh token available',
          status: 401,
        } as ApiError);
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://grandline-cms.vercel.app/api';
      const response = await fetch(`${apiUrl}/users/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          message: error.message || 'Token refresh failed',
          status: response.status,
        } as ApiError);
      }

      const data = await response.json();
      
      // Update stored tokens
      localStorage.setItem('encreasl_token', data.token);
      localStorage.setItem('encreasl_refresh_token', data.refreshToken);

      return data;
    } catch (error) {
      return rejectWithValue({
        message: 'Network error occurred',
        status: 0,
      } as ApiError);
    }
  }
);

// Logout user
export const logoutUser = createAsyncThunk<
  void,
  void,
  AsyncThunkConfig
>(
  'auth/logout',
  async (_, { getState }) => {
    try {
      const { auth } = getState();
      
      // Call logout API if we have a refresh token
      if (auth.refreshToken) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://grandline-cms.vercel.app/api';
        await fetch(`${apiUrl}/users/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.token}`,
          },
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
      }

      // Clear stored tokens regardless of API call success
      localStorage.removeItem('encreasl_token');
      localStorage.removeItem('encreasl_refresh_token');
      
    } catch (error) {
      // Don't reject on logout - always clear local state
      console.warn('Logout API call failed, but continuing with local cleanup');
    }
  }
);

// Load user from token
export const loadUserFromToken = createAsyncThunk<
  User,
  void,
  AsyncThunkConfig
>(
  'auth/loadUserFromToken',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('encreasl_token');
      
      if (!token) {
        return rejectWithValue({
          message: 'No token found',
          status: 401,
        } as ApiError);
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://grandline-cms.vercel.app/api';
      const response = await fetch(`${apiUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          message: error.message || 'Failed to load user',
          status: response.status,
        } as ApiError);
      }

      const user = await response.json();
      return user;
    } catch (error) {
      return rejectWithValue({
        message: 'Network error occurred',
        status: 0,
      } as ApiError);
    }
  }
);

// Update user profile
export const updateUserProfile = createAsyncThunk<
  User,
  Partial<User>,
  AsyncThunkConfig
>(
  'auth/updateProfile',
  async (updates, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://grandline-cms.vercel.app/api';
      const response = await fetch(`${apiUrl}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue({
          message: error.message || 'Profile update failed',
          status: response.status,
        } as ApiError);
      }

      const updatedUser = await response.json();
      return updatedUser;
    } catch (error) {
      return rejectWithValue({
        message: 'Network error occurred',
        status: 0,
      } as ApiError);
    }
  }
);

// ============================================================================
// Auth Slice
// ============================================================================

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
    
    // Update last activity
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    
    // Set session expiry
    setSessionExpiry: (state, action: PayloadAction<number>) => {
      state.sessionExpiry = action.payload;
    },
    
    // Increment login attempts
    incrementLoginAttempts: (state) => {
      state.loginAttempts += 1;
    },
    
    // Reset login attempts
    resetLoginAttempts: (state) => {
      state.loginAttempts = 0;
    },
    
    // Update user preferences
    updateUserPreferences: (state, action: PayloadAction<Partial<User['preferences']>>) => {
      if (state.user) {
        state.user.preferences = {
          ...state.user.preferences,
          ...action.payload,
        };
      }
    },
    
    // Force logout (for security purposes)
    forceLogout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.sessionExpiry = null;
      state.error = 'Session expired. Please log in again.';
      
      // Clear stored tokens
      localStorage.removeItem('encreasl_token');
      localStorage.removeItem('encreasl_refresh_token');
    },
  },
  extraReducers: (builder) => {
    // Login cases
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.loginAttempts = 0;
        state.lastActivity = Date.now();
        state.sessionExpiry = Date.now() + (action.payload.expiresIn * 1000);
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Login failed';
        state.loginAttempts += 1;
      });

    // Register cases
    builder
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.lastActivity = Date.now();
        state.sessionExpiry = Date.now() + (action.payload.expiresIn * 1000);
        state.error = null;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.message || 'Registration failed';
      });

    // Refresh token cases
    builder
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.refreshToken = action.payload.refreshToken;
        state.sessionExpiry = Date.now() + (action.payload.expiresIn * 1000);
        state.lastActivity = Date.now();
      })
      .addCase(refreshToken.rejected, (state) => {
        // Force logout on refresh failure
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.sessionExpiry = null;
        state.error = 'Session expired. Please log in again.';
      });

    // Logout cases
    builder
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.sessionExpiry = null;
        state.error = null;
        state.loginAttempts = 0;
      });

    // Load user cases
    builder
      .addCase(loadUserFromToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loadUserFromToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.token = localStorage.getItem('encreasl_token');
        state.refreshToken = localStorage.getItem('encreasl_refresh_token');
        state.lastActivity = Date.now();
      })
      .addCase(loadUserFromToken.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        
        // Clear invalid tokens
        localStorage.removeItem('encreasl_token');
        localStorage.removeItem('encreasl_refresh_token');
      });

    // Update profile cases
    builder
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.error = action.payload?.message || 'Profile update failed';
      });
  },
});

// ============================================================================
// Export actions and reducer
// ============================================================================

export const {
  clearError,
  updateLastActivity,
  setSessionExpiry,
  incrementLoginAttempts,
  resetLoginAttempts,
  updateUserPreferences,
  forceLogout,
} = authSlice.actions;

export default authSlice;
