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

/** Creates a supervisor or another administrator. Both are Cognito groups. */
export const createStaffMember = async (input: {
  name: string;
  phone: string;
  email: string;
  description: string;
  role: 'ADMIN' | 'SUPERVISOR';
}) => {
  const args = {
    name: input.name.trim(),
    phone: input.phone,
    email: input.email.trim() || undefined,
    description: input.description.trim() || undefined,
  };
  const result =
    input.role === 'ADMIN'
      ? await client.mutations.createAdministrator(args)
      : await client.mutations.createSupervisor(args);
  return must(result, `create ${input.role.toLowerCase()}`);
};

export const setSupervisorAccess = async (supervisorId: string, isActive: boolean) => {
  const result = await client.mutations.updateSupervisorAccess({ supervisorId, isActive });
  return must(result, 'update supervisor access');
};

export const removeSupervisor = async (supervisorId: string) => {
  const result = await client.mutations.deleteSupervisor({ supervisorId });
  return must(result, 'delete supervisor');
};
