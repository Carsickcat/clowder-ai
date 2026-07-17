import breakpoints from '@/styles/responsive-breakpoints.json';

export const RESPONSIVE_BREAKPOINTS = Object.freeze(breakpoints);

export const WIDE_SHELL_QUERY = `(min-width: ${RESPONSIVE_BREAKPOINTS.wide}px)`;
export const MOBILE_WORK_SURFACE_QUERY = `(max-width: ${RESPONSIVE_BREAKPOINTS.wide - 1}px)`;
