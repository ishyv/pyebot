import type { PageServerLoad } from "./$types";

// Landing uses static topic metadata + the layout's feature-enabled map; nothing
// server-side to fetch here.
export const load: PageServerLoad = () => ({});
