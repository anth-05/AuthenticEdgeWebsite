// Shared Tailwind Play CDN config for Authentic Edge.
// Loaded on every page after the CDN script, before any <style type="text/tailwindcss"> block.
tailwind.config = {
  // This site has no CSS reset today and relies on default browser
  // margins (h1, p, etc.). Preflight would strip those sitewide and
  // shrink spacing everywhere, so it stays off — utilities only.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        muted: '#666666',
        line: '#eeeeee',
        hairline: '#f9f9f9',
        surface: '#fafafa',
        faint: '#999999',
        charcoal: '#333333',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
};
