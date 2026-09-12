// Student/Volunteer/Facilitator's "Events" tab is now the same shared
// Event Organization page Director/Admin and Teacher use (see
// EventManagement.jsx) — it already detects the signed-in role via
// useAuth() and shows only what that role may see (no charts, no Add
// Event, no management actions for a browsing role). Kept as its own
// module (rather than updating every import site to point at
// EventManagement directly) so this file's name keeps documenting exactly
// which dashboard tab it backs.
export { default } from "./EventManagement";
