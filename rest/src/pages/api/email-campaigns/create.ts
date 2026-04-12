import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { name, subject, discountCode, discountPercent, ctaUrl, ctaText } = req.body;

    if (!name || !subject) {
      return res.status(400).json({ message: 'Name and Subject are required' });
    }

    const campaign = await prisma.email_campaigns.create({
      data: {
        name,
        subject,
        discount_code: discountCode || null,
        discount_percent: discountPercent ? parseInt(discountPercent) : null,
        cta_url: ctaUrl || 'https://idreamshirt.com/products/customize/premium-t-shirt',
        cta_text: ctaText || 'Shop Now',
        status: 'draft',
        preview_text: `30% OFF - Custom Design Service`,
        heading: 'Your Imagination,<br>Our Creation',
        batch_size: 50,
      },
    });

    return res.status(201).json(campaign);
  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return res.status(500).json({ message: 'Failed to create campaign', error: error.message });
  } finally {
    await prisma.$disconnect();
  }
}
