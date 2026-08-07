import { useCallback } from 'react';
import { client, must, type SupervisorProfile } from '../lib/amplify';
import { useAsync } from './useAsync';

export const useSupervisors = (enabled = true) => {
  const load = useCallback(async () => {
    const result = must(await client.models.SupervisorProfile.list({ limit: 200 }), 'list supervisors');
    return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return useAsync<SupervisorProfile[]>(load, [], { enabled });
};

export const createSupervisor = async (input: {
  name: string;
  phone: string;
  email: string;
  description: string;
}) => {
  const result = await client.mutations.createSupervisor({
    name: input.name.trim(),
    phone: input.phone,
    email: input.email.trim() || undefined,
    description: input.description.trim() || undefined,
  });
  return must(result, 'create supervisor');
};

export const setSupervisorAccess = async (supervisorId: string, isActive: boolean) => {
  const result = await client.mutations.updateSupervisorAccess({ supervisorId, isActive });
  return must(result, 'update supervisor access');
};

export const removeSupervisor = async (supervisorId: string) => {
  const result = await client.mutations.deleteSupervisor({ supervisorId });
  return must(result, 'delete supervisor');
};
