import axios from "axios";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function sendEmail(templateVariables) {
    require('dotenv').config();

    const emailSupport = process.env.EMAIL_SUPPORT;
    const emailSupportName = process.env.EMAIL_SUPPORT_NAME;
    const mailtrapApiKey = process.env.MAILTRAP_API_KEY;
    const templateUuid = process.env.TEMPLATE_UUID;

    console.log(templateUuid)
    
    const data = {
      from: {
        email: emailSupport,
        name: emailSupportName,
      },
      to: [{ email: templateVariables.shipping_email }],
      cc: [{ email: emailSupport }],
      template_uuid: templateUuid,
      template_variables: templateVariables,
    };
    
    const config = {
      headers: {
        Authorization: `Bearer ${mailtrapApiKey}`,
        "Content-Type": "application/json",
      },
    };
    

  try {
    const response = await axios.post(
      "https://send.api.mailtrap.io/api/send",
      data,
      config
    );
    console.log("Email sent successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending email:", error.response.data);
    throw error;
  }
}

export default async function handler(req, res) {
  try {
    const orders = await prisma.$queryRaw`
      SELECT
          id, amount, tracking_number, discount, delivery_fee,
          JSON_UNQUOTE(JSON_EXTRACT(orders.shipping_address, '$.shipping_address1')) AS shipping_address1,
          JSON_UNQUOTE(JSON_EXTRACT(orders.shipping_address, '$.shipping_city')) AS shipping_city,
          JSON_UNQUOTE(JSON_EXTRACT(orders.shipping_address, '$.shipping_zipcode')) AS shipping_zipcode,
          JSON_UNQUOTE(JSON_EXTRACT(orders.shipping_address, '$.shipping_name')) AS shipping_name,
          JSON_UNQUOTE(JSON_EXTRACT(orders.shipping_address, '$.shipping_email')) AS shipping_email
      FROM
          orders
      WHERE
          orders.payment_status = 'COMPLETED' AND orders.email_send = 0;
    `;

    if (orders.length > 0) {
      for (const order of orders) {
        const orderProducts = await prisma.$queryRaw`
          SELECT
              products.name AS product_name,
              order_product.order_quantity,
              order_product.unit_price AS subtotal,
              order_product.subtotal AS product_subtotal,
              order_product.img_url,
              JSON_UNQUOTE(JSON_EXTRACT(order_product.variation, '$.size')) AS size,
              JSON_UNQUOTE(JSON_EXTRACT(order_product.variation, '$.color')) AS color
          FROM
              order_product
          JOIN
              products ON order_product.product_id = products.id
          WHERE
              order_product.order_id = ${order.id};
        `;
        const productsInfo = orderProducts.map((product) => ({
          product_name: product.product_name,
          order_quantity: product.order_quantity,
          subtotal: product.product_subtotal,
          img_url: product.img_url,
          size: product.size,
          color: product.color,
        }));

        const templateVariables = {
          tracking_number: order.tracking_number,
          shipping: order.delivery_fee,
          discount: order.discount,
          total: order.amount,
          shipping_name: order.shipping_name,
          shipping_address1: order.shipping_address1,
          shipping_city: order.shipping_city,
          shipping_zipcode: order.shipping_zipcode,
          shipping_email: order.shipping_email,
          products: productsInfo.map((product) => ({
            product: {
              product_name: product.product_name,
              order_quantity: product.order_quantity,
              size: product.size,
              color: product.color,
              subtotal: product.subtotal,
            },
          })),
        };
        console.log(templateVariables);

        if (templateVariables.shipping_email === "changha8888@gmail.com") {
          continue;
        }

        await sendEmail(templateVariables);

        await prisma.orders.update({
          where: { tracking_number: order.tracking_number },
          data: { email_send: 1 },
        });
      }
      console.log("Emails sent and database updated successfully.");
      res.status(200).json({ message: "Emails sent and database updated successfully." });
    }  
  } catch (error) {
    console.error("Error processing orders:", error);
    res.status(500).json({ error: error });
  } finally {
    await prisma.$disconnect();
  }
}
