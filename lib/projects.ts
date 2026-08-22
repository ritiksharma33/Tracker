/**
 * The dropdown on the dashboard is generated from this list. To add a
 * project, add one line below — nothing else in the app needs to change.
 *
 * `id` is just a URL-safe slug you make up (used internally, never shown).
 * `name` must match the project exactly as `stb` expects it via
 * `--project-name`, e.g. what you'd type in:
 *
 *   stb submissions list --project-name "<name>"
 */
export type Project = {
  id: string;
  name: string;
  label: string;
};

export const PROJECTS: Project[] = [
  {
    id: "starfish",
    name: "CDG_Starfish_Pilot_uTYAV_Coding",
    label: "Starfish Pilot (Coding)",
  },
  // Add more projects here, for example:
  // {
  //   id: "another-project",
  //   name: "CDG_Another_Project_Name",
  //   label: "Another Project",
  // },
];
