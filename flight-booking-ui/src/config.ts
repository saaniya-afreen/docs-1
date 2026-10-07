// Demo branding. Kept generic on purpose; change freely for the client demo.
export const BRAND = {
  name: (import.meta.env.VITE_BRAND_NAME as string | undefined) || 'SKYLINE AIR',
  agentName: (import.meta.env.VITE_AGENT_NAME as string | undefined) || 'Sara',
};
