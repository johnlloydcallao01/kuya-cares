// Barrel exports for custom hooks

export { useSidebar } from './useSidebar';
export { useCategory } from './useCategory';
export {
  useDataLoading,
  useAsyncLoading,
  useSimulatedLoading,
  usePageLoading
} from './useLoading';

// Authentication hooks
export {
  useAuth,
  useUser,
  useAuthActions,
  useAuthStatus,
  useLogin,
  useLogout,
  useSession,
  useRouteProtection,
  useAuthEvents,
  usePermissions
} from './useAuth';
