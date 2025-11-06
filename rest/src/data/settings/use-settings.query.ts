import Settings from "@repositories/settings";
import { useQuery } from "react-query";
import { Settings as TSettings } from "@ts-types/generated";
import { API_ENDPOINTS } from "@utils/api/endpoints";

export const fetchSettings = async () => {
  const startTime = Date.now();
  
  try {
    // Call internal Next.js API instead of external
    const response = await fetch('/api/settings');
    const data = await response.json();
    console.log(`⏱️ fetchSettings: ${Date.now() - startTime}ms`);
    return data;
  } catch (error) {
    console.error(`❌ fetchSettings failed: ${Date.now() - startTime}ms`, error);
    // Return default settings
    return {
      options: {
        siteTitle: "Admin Dashboard",
        currency: "USD",
      }
    };
  }
};

export const useSettingsQuery = () => {
  return useQuery<TSettings, Error>(
    [API_ENDPOINTS.SETTINGS], 
    () => fetchSettings(),
    {
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
      cacheTime: 10 * 60 * 1000,
    }
  );
};
