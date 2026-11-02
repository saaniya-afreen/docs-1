/*
 * Role-play scenarios (AI customers).
 *
 * Each scenario = one OneInbox voice agent configured to act as a CUSTOMER.
 * Build the agent in OneInbox (see agent-prompts/customer-persona-template.md),
 * copy its widget embed code, and paste it into `widgetCode` below.
 *
 * Scenarios can also be created from the UI ("+ New scenario"); those are saved
 * in the browser and can be exported/imported as JSON, so no code edit is needed.
 *
 * Fields
 *   id          unique string
 *   direction   "inbound"  -> the customer calls the trainee (phone rings)
 *               "outbound" -> the trainee calls the customer (trainee dials)
 *   project     client project / industry the BPO is running
 *   customer    what the trainee sees on the caller-ID / lead card
 *   brief       short context shown to the trainee (NOT the hidden persona)
 *   difficulty  "easy" | "medium" | "hard"
 *   widgetMode  "iframe" (default, isolated, removed on hang-up) | "inline"
 *   widgetCode  the OneInbox widget embed snippet for this agent
 */
window.DEFAULT_SCENARIOS = [
  {
    id: "in-washer-error",
    direction: "inbound",
    project: "Home appliances support",
    customer: { name: "Yuki Sato", phone: "+81 90-1234-5678", gender: "Female", age: 34 },
    brief: "Customer calling about a front-load washing machine that stops mid-cycle and shows an error code.",
    difficulty: "easy",
    widgetMode: "iframe",
    widgetCode: ""
  },
  {
    id: "in-antivirus-renewal",
    direction: "inbound",
    project: "Antivirus software",
    customer: { name: "Kenji Watanabe", phone: "+81 80-2345-6789", gender: "Male", age: 52 },
    brief: "Customer was auto-charged for a renewal they did not expect and is annoyed.",
    difficulty: "medium",
    widgetMode: "iframe",
    widgetCode: ""
  },
  {
    id: "out-fiber-upgrade",
    direction: "outbound",
    project: "Fiber internet sales",
    customer: { name: "Haruka Ito", phone: "+81 70-3456-7890", gender: "Female", age: 41 },
    brief: "Existing customer on a 100 Mbps plan. Pitch the 1 Gbps upgrade campaign.",
    difficulty: "medium",
    widgetMode: "iframe",
    widgetCode: ""
  },
  {
    id: "out-cold-lead",
    direction: "outbound",
    project: "Water server subscription",
    customer: { name: "Takeshi Nakamura", phone: "+81 90-4567-8901", gender: "Male", age: 29 },
    brief: "Cold lead from a web form. Busy and skeptical; book a free trial delivery.",
    difficulty: "hard",
    widgetMode: "iframe",
    widgetCode: ""
  }
];
