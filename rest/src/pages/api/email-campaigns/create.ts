import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { name, subject, discountCode, discountPercent, ctaUrl, ctaText, previewText, heading } = req.body;

    if (!name || !subject) {
      return res.status(400).json({ message: 'Name and Subject are required' });
    }

    const percent = discountPercent ? parseInt(discountPercent) : null;
    if (percent !== null && (isNaN(percent) || percent < 1 || percent > 90)) {
      return res.status(400).json({ message: 'Discount percent must be between 1 and 90' });
    }

    const campaign = await prisma.email_campaigns.create({
      data: {
        name,
        subject,
        discount_code: discountCode || null,
        discount_percent: percent,
        cta_url: ctaUrl || 'https://idreamshirt.com/products/customize/premium-t-shirt',
        cta_text: ctaText || (percent ? `Get ${percent}% Off Now` : 'Start Your Custom Shirt'),
        status: 'draft',
        // The preview text must match the real offer; it used to be a fixed "30% OFF".
        preview_text: previewText || (percent ? `${percent}% OFF - Custom Design Service` : 'Custom Design Service'),
        heading: heading || 'Your Imagination,<br>Our Creation',
        batch_size: 50,
      },
    });

    // Convert BigInt to Number for JSON serialization
    const safeCampaign = {
      ...campaign,
      id: Number(campaign.id),
      discount_percent: campaign.discount_percent ? Number(campaign.discount_percent) : null,
      batch_size: campaign.batch_size ? Number(campaign.batch_size) : null,
    };

    return res.status(201).json(safeCampaign);
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return res.status(500).json({ message: 'Failed to create campaign', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
}
