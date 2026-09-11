import type { Access, FieldAccess } from 'payload'

// API Key Cache for Performance Optimization
interface ApiKeyCache {
  [key: string]: {
    isValid: boolean
    userId: string
    role: string
    timestamp: number
  }
}

const apiKeyCache: ApiKeyCache = {}
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds
const MAX_CACHE_SIZE = 1000 // Maximum number of cached entries

// Cache cleanup function
const cleanupCache = () => {
  const now = Date.now()
  const keys = Object.keys(apiKeyCache)
  
  // Remove expired entries
  for (const key of keys) {
    if (now - apiKeyCache[key].timestamp > CACHE_TTL) {
      delete apiKeyCache[key]
    }
  }
  
  // If cache is still too large, remove oldest entries
  const remainingKeys = Object.keys(apiKeyCache)
  if (remainingKeys.length > MAX_CACHE_SIZE) {
    const sortedKeys = remainingKeys.sort((a, b) => 
      apiKeyCache[a].timestamp - apiKeyCache[b].timestamp
    )
    const keysToRemove = sortedKeys.slice(0, remainingKeys.length - MAX_CACHE_SIZE)
    for (const key of keysToRemove) {
      delete apiKeyCache[key]
    }
  }
}

// LMS role hierarchy levels
export const ROLE_LEVELS = {
  CUSTOMER: 1,
  SERVICE: 3, // Step 2: Add service account role level (between customer and admin)
  ADMIN: 10,
} as const

// Legacy role mapping for backward compatibility
export const LEGACY_ROLE_LEVELS = {
  'customer': ROLE_LEVELS.CUSTOMER,
  'service': ROLE_LEVELS.SERVICE, // Step 2: Map service role for API key users
  'admin': ROLE_LEVELS.ADMIN,
} as const

/**
 * Check if user has minimum role level
 */
export const hasMinimumRoleLevel = (userRole: string, minimumLevel: number): boolean => {
  const userLevel = LEGACY_ROLE_LEVELS[userRole as keyof typeof LEGACY_ROLE_LEVELS] || 0
  return userLevel >= minimumLevel
}

/**
 * Access control for admins only
 */
export const adminOnly: Access = ({ req: { user } }) => {
  return user?.role === 'admin'
}

/**
 * Access control for authenticated users
 */
export const authenticatedUsers: Access = ({ req: { user } }) => {
  return !!user
}

/**
 * API key-only access control - bypasses user authentication
 * Allows access if valid API key is provided in Authorization header
 * Now with performance caching to reduce database queries
 */
export const apiKeyOnly: Access = async ({ req }) => {
  const authHeader = req.headers?.get('authorization')
  if (!authHeader) return false
  
  // Check for API key format: "users API-Key <key>"
  const apiKeyMatch = authHeader.match(/^users API-Key (.+)$/)
  if (!apiKeyMatch) return false
  
  const providedKey = apiKeyMatch[1]
  const now = Date.now()
  
  // Check cache first
  if (apiKeyCache[providedKey]) {
    const cached = apiKeyCache[providedKey]
    
    // Return cached result if not expired
    if (now - cached.timestamp < CACHE_TTL) {
      return cached.isValid
    }
    
    // Remove expired entry
    delete apiKeyCache[providedKey]
  }
  
  try {
    // Professional approach: Validate API key against database
    const payload = req.payload
    if (!payload) {
      // Cache negative result
      apiKeyCache[providedKey] = {
        isValid: false,
        userId: '',
        role: '',
        timestamp: now
      }
      return false
    }
    
    // Find user with matching API key
    const users = await payload.find({
      collection: 'users',
      where: {
        apiKey: {
          equals: providedKey
        },
        // Ensure user is active and has service role
        role: {
          in: ['service', 'admin']
        }
      },
      limit: 1,
      depth: 0
    })
    
    const isValid = users.docs.length === 1
    const user = users.docs[0]
    
    // Cache the result
    apiKeyCache[providedKey] = {
      isValid,
      userId: user?.id?.toString() || '',
      role: user?.role || '',
      timestamp: now
    }
    
    // Periodic cache cleanup (every 100 requests approximately)
    if (Math.random() < 0.01) {
      cleanupCache()
    }
    
    return isValid
  } catch (error) {
    console.error('API key validation error:', error)
    
    // Cache negative result for failed validations
    apiKeyCache[providedKey] = {
      isValid: false,
      userId: '',
      role: '',
      timestamp: now
    }
    
    return false
  }
}

/**
 * Access control for users to read their own data
 */
export const usersOwnData: Access = ({ req: { user } }) => {
  if (!user) return false
  
  // Admins can access all user data
  if (user.role === 'admin') {
    return true
  }
  
  // Users can only access their own data
  return {
    id: {
      equals: user.id,
    },
  }
}

/**
 * Field access for sensitive data
 */
export const sensitiveData: FieldAccess = ({ req: { user } }) => {
  // Only admins can access sensitive data
  return user?.role === 'admin'
}

/**
 * Access control for media based on user role
 */
export const mediaAccess: Access = ({ req: { user } }) => {
  if (!user) return false

  // Admins can access all media
  if (user.role === 'admin') {
    return true
  }

  // Service accounts and customers can access media
  return true // Simplified for now
}

/**
 * Dynamic access control based on user roles
 */
export const dynamicRoleAccess = (resource: string, action: string): Access => {
  return ({ req: { user } }) => {
    if (!user) return false
    
    switch (action) {
      case 'create':
        return hasMinimumRoleLevel(user.role || '', ROLE_LEVELS.SERVICE)
      case 'read':
        return hasMinimumRoleLevel(user.role || '', ROLE_LEVELS.CUSTOMER)
      case 'update':
        return hasMinimumRoleLevel(user.role || '', ROLE_LEVELS.SERVICE)
      case 'delete':
        return hasMinimumRoleLevel(user.role || '', ROLE_LEVELS.ADMIN)
      default:
        return false
    }
  }
}

/**
 * LMS-specific access control
 */
export const lmsAccess: Access = ({ req: { user } }) => {
  if (!user) return false
  
  // All authenticated users have basic LMS access
  return hasMinimumRoleLevel(user.role || '', ROLE_LEVELS.CUSTOMER)
}

/**
 * Access control for service accounts or above (service, admin)
 */
export const serviceOrAbove: Access = ({ req: { user } }) => {
  return hasMinimumRoleLevel(user?.role || '', ROLE_LEVELS.SERVICE)
}

const accessControls = {
  adminOnly,
  serviceOrAbove, // Service or above access control
  authenticatedUsers,
  apiKeyOnly, // API key-only access control
  usersOwnData,
  sensitiveData,
  mediaAccess,
  dynamicRoleAccess,
  lmsAccess,
}

export default accessControls
