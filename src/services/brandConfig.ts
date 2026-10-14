// Lightweight brand-name holder (kept separate so the app shell does not load PDF/Excel libraries).
let platformBrandName = 'SIVER MARKET 509';
export const setBrandingName = (name: string) => {
  if (name) platformBrandName = name;
};
export const getBrandingName = () => platformBrandName;
