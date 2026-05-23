import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../../config/database';

const execAsync = promisify(exec);

export const config = {
    api: {
        bodyParser: false,
    },
};

interface UploadRequest extends NextApiRequest {
    files?: any;
}

export default async function handler(req: UploadRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Add timeout for the entire request
    const timeout = setTimeout(() => {
        res.status(408).json({ error: 'Request timeout' });
    }, 60000); // 60 seconds timeout

    try {
        const form = formidable({
            uploadDir: '/tmp',
            keepExtensions: true,
            maxFileSize: 50 * 1024 * 1024, // 50MB limit
        });

        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                else resolve([fields, files]);
            });
        });

        const file = files.file?.[0];
        const orderId = fields.orderId?.[0];
        const productId = fields.productId?.[0];

        if (!file || !orderId || !productId) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['file', 'orderId', 'productId']
            });
        }

        const uploadedFileName = file.originalFilename || `upload_${Date.now()}.png`;

        // 1. Upload to Remote Server via SCP
        // Destination: root@vmi2327956:/home/production/atwork/public/fullfill

        // SSH configuration
        const remoteUser = process.env.SCP_USER || 'root';
        const remoteHost = process.env.SCP_HOST || 'vmi2327956.contaboserver.net';
        const sshKeyPath = process.env.SSH_PRIVATE_KEY_PATH || '/Users/changha/.ssh/id_rsa_scp'; // Adjusted based on previous .env readout
        const remoteDir = '/home/production/atwork/public/fullfill';
        const sshPrefix = `${remoteUser}@${remoteHost}`;
        const remotePath = `${remoteDir}/${uploadedFileName}`;

        console.log(`🚀 Starting upload: ${uploadedFileName} to ${remoteHost}:${remoteDir}`);

        // Create remote directory if passed in somehow? No, assuming /home/production/atwork/public/fullfill exists as per requirement.
        // However, it's safer to ensure it exists.
        try {
            await execAsync(`ssh -i '${sshKeyPath}' ${sshPrefix} 'mkdir -p ${remoteDir}'`);
        } catch (e) {
            console.warn("Failed to ensure remote directory exists, possibly already exists or perm issue:", e);
        }

        // SCP Command
        const scpCommand = `scp -i '${sshKeyPath}' "${file.filepath}" ${sshPrefix}:${remotePath}`;

        try {
            await execAsync(scpCommand);
            console.log('✅ SCP upload success');
        } catch (error) {
            console.error('❌ SCP upload failed:', error);
            throw new Error(`Failed to upload file to server: ${error instanceof Error ? error.message : String(error)}`);
        }

        // Clean up local temp file
        try {
            fs.unlinkSync(file.filepath);
        } catch (e) {
            console.warn('Failed to delete temp file:', e);
        }

        // 2. Update Database
        const finalUrl = `https://atwork.idreamshirt.com/fullfill/${uploadedFileName}`;

        console.log(`💾 Updating DB for Order: ${orderId}, Product: ${productId} -> ${finalUrl}`);

        try {
            const [result] = await db.execute(
                `UPDATE order_product SET upscayl_image = ? WHERE order_id = ? AND product_id = ?`,
                [finalUrl, orderId, productId]
            );

            console.log('✅ DB Update result:', result);
        } catch (dbError) {
            console.error('❌ DB Update failed:', dbError);
            throw new Error(`Failed to update database: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        }

        clearTimeout(timeout);

        res.status(200).json({
            success: true,
            message: 'File uploaded and updated successfully',
            url: finalUrl
        });

    } catch (error) {
        clearTimeout(timeout);
        console.error('Handler error:', error);
        res.status(500).json({
            error: 'Process failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
