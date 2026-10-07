// Agent display name (from the PRD). No airline branding in the demo.
export const BRAND = {
  agentName: (import.meta.env.VITE_AGENT_NAME as string | undefined) || 'Sara',
};
