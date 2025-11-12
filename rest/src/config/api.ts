// API Configuration
export const API_CONFIG = {
  API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3007",
  REST_ENDPOINT: process.env.NEXT_PUBLIC_REST_API_ENDPOINT || "http://localhost:3007/graphql",
  ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3000",
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://idreamshirt.com",
};

// Helper function to get API URL
export const getApiUrl = () => API_CONFIG.API_URL;






