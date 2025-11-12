import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  if (req.method === 'GET') {
    // Return minimal settings to avoid external API call
    // This is a placeholder - adjust based on what settings are actually needed
    console.log(`⏱️ /api/settings: ${Date.now() - startTime}ms (cached)`);
    
    return res.status(200).json({
      options: {
        siteTitle: "Admin Dashboard",
        siteSubtitle: "Order Management",
        currency: "USD",
        // Add other minimal settings as needed
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}




