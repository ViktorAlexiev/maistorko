export const HUBS = ["sofia", "plovdiv", "varna", "burgas", "ruse"] as const;
export type Hub = (typeof HUBS)[number];
export const HUB_LABEL: Record<Hub, string> = {
  sofia: "София и околността",
  plovdiv: "Пловдив и околността",
  varna: "Варна и околността",
  burgas: "Бургас и околността",
  ruse: "Русе и околността",
};
