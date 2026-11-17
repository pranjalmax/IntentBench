declare const __INTENTBENCH_STATIC_REPLAY__: boolean;

export const staticReplay =
  typeof __INTENTBENCH_STATIC_REPLAY__ !== "undefined" && __INTENTBENCH_STATIC_REPLAY__;
export const applicationBase = import.meta.env.BASE_URL;
