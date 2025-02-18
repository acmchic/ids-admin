import sharp from "sharp";
import axios from "axios";
import fs from "fs";
import path from "path";
import cors from 'cors';

const corsOptions = {
  origin: 'https://orders.idreamshirt.com',
};

export default async function handler(req, res) {
  const { imageUrl, width, height } = req.body;
  const imageName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
  const outputImagePath = path.join('/home/debian/order/images/atwork/', imageName);

  try {
    // Sử dụng middleware CORS
    await cors(corsOptions)(req, res);

    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    fs.writeFileSync(imageName, response.data);
    console.log(`Downloaded image: ${imageName}`);

    await sharp(imageName)
      .resize({ width: 4200, height: 4800 })
      .toFile(outputImagePath);
    console.log(`Resized image saved at: ${outputImagePath}`);

    res.status(200).json({ imageName: imageName });
  } catch (error) {
    console.error(`Error resizing image: ${error.message}`);
    res.status(500).json({ error: "An error occurred while resizing the image" });
  }
}
