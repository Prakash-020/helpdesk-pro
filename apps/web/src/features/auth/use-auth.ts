import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, UserDto } from '@helpdesk/shared';
import { api, ApiRequestError } from '../../lib/api';

/**
 * Auth state = a server query. The session cookie is the credential;
 * there is no token in JS-readable storage anywhere.
 */
export function useAuth() {
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const res = await api.get<{ user: UserDto }>('/api/v1/auth/me');
        return res.user;
      } catch (e) {
        if (e instanceof ApiRequestError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const login = useMutation({
    mutationFn: (input: LoginInput) => api.post<{ user: UserDto }>('/api/v1/auth/login', input),
    onSuccess: (res) => {
      queryClient.setQueryData(['auth', 'me'], res.user);
    },
  });

  const register = useMutation({
    mutationFn: (input: RegisterInput) => api.post<{ user: UserDto }>('/api/v1/auth/register', input),
    onSuccess: (res) => {
      queryClient.setQueryData(['auth', 'me'], res.user);
    },
  });

  const logout = useMutation({
    mutationFn: () => api.post('/api/v1/auth/logout'),
    onSettled: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' });
    },
  });

  return { user: data ?? null, isPending, login, register, logout };
}
