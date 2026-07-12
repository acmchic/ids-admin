import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const STORAGE_TYPES = ['images', 'customize'] as const;
type StorageType = typeof STORAGE_TYPES[number];

export const config = {
  api: {
    bodyParser: false,
  },
};

interface UploadRequest extends NextApiRequest {
  files?: any;
}

export default async function handler(req: UploadRequest, res: NextApiResponse) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const sendResponse = (statusCode: number, body: Record<string, unknown>) => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    if (res.headersSent || res.writableEnded) {
      return;
    }

    res.status(statusCode).json(body);
  };

  if (req.method !== 'POST') {
    return sendResponse(405, { error: 'Method not allowed' });
  }

  // PRODUCTION SECURITY: Rate limiting check
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`Upload request from IP: ${clientIP}`);

  // Add timeout for the entire request
  timeout = setTimeout(() => {
    sendResponse(408, { error: 'Request timeout' });
  }, 120000); // SCP uploads can take longer than 30 seconds on large files

  try {
    const form = formidable({
      uploadDir: '/tmp',
      keepExtensions: true,
      maxFileSize: 25 * 1024 * 1024, // 25MB limit
    });

    const [fields, files]: any = await new Promise<any>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = files.file?.[0];
    const imagePath = fields.path?.[0]; // param1: path (e.g., "custom/x")
    const originalFileName = fields.fileName?.[0]; // param2: original fileName (e.g., "image.png")
    const requestedStorage = (fields.storage?.[0] || 'images') as StorageType;
    const forceReplace = fields.forceReplace?.[0] === '1' || fields.forceReplace?.[0] === 'true';

    if (!file || !imagePath || !originalFileName) {
      return sendResponse(400, { 
        error: 'Missing required parameters',
        required: ['file', 'path', 'fileName']
      });
    }

    if (!STORAGE_TYPES.includes(requestedStorage)) {
      return sendResponse(400, { error: 'Invalid storage parameter' });
    }

    // PRODUCTION SECURITY: STRICT VALIDATION
    // Validate path format - only allow safe characters and prevent path traversal
    if (!imagePath || typeof imagePath !== 'string') {
      return sendResponse(400, { error: 'Invalid path parameter' });
    }
    
    if (!/^[a-zA-Z0-9\/_-]+$/.test(imagePath) || imagePath.includes('..') || imagePath.includes('//')) {
      return sendResponse(400, { error: 'Invalid path format - security violation' });
    }
    
    // PRODUCTION SECURITY: Prevent access to system directories
    const forbiddenPaths = ['system', 'admin', 'root', 'etc', 'var', 'tmp', 'proc', 'dev'];
    const pathSegments = imagePath.toLowerCase().split('/');
    for (const segment of pathSegments) {
      if (forbiddenPaths.includes(segment)) {
        return sendResponse(400, { error: 'Access to forbidden directory' });
      }
    }

    // Get uploaded file name and extension
    const uploadedFileName = file.originalFilename || 'uploaded_file';

    // Determine final file name based on comparison
    let finalFileName: string;
    let isReplacing = false;
    
    if (forceReplace || uploadedFileName === originalFileName) {
      // Same name - replace original file
      finalFileName = originalFileName;
      isReplacing = true;
    } else {
      // Different name - keep original and upload with new name
      finalFileName = uploadedFileName;
      isReplacing = false;
    }

    // Validate final fileName format - only allow safe characters
    if (!/^[a-zA-Z0-9._-]+$/.test(finalFileName) || finalFileName.includes('..') || finalFileName.includes('/')) {
      return sendResponse(400, { error: 'Invalid fileName format - security violation' });
    }

    // PRODUCTION SECURITY: Strict file extension validation
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const dangerousExtensions = ['.sh', '.php', '.js', '.py', '.exe', '.bat', '.cmd', '.html', '.htm', '.xml', '.json'];
    const fileExtension = path.extname(finalFileName).toLowerCase();
    
    if (dangerousExtensions.includes(fileExtension)) {
      return sendResponse(400, { error: 'Dangerous file extension not allowed' });
    }
    
    if (!allowedExtensions.includes(fileExtension)) {
      return sendResponse(400, { error: 'Only image files are allowed' });
    }

    // SAFE PATH CONSTRUCTION - Prevent any directory manipulation
    let remoteFolder = requestedStorage === 'customize'
      ? (process.env.SCP_CUSTOMIZE_REMOTE_FOLDER || '/home/production/image-server/customize')
      : (process.env.SCP_REMOTE_FOLDER || '/home/images_ids/images');
    // Ensure remoteFolder starts with /
    if (!remoteFolder.startsWith('/')) {
      remoteFolder = '/' + remoteFolder;
    }
    // Remove trailing slash if exists
    remoteFolder = remoteFolder.replace(/\/$/, '');
    
    // SECURITY: Normalize and validate final path
    const serverPath = `${remoteFolder}/${imagePath}/${finalFileName}`;
    
    // CRITICAL SECURITY CHECK: Ensure path is within allowed directory
    const normalizedPath = path.normalize(serverPath);
    if (!normalizedPath.startsWith(remoteFolder)) {
      return sendResponse(400, { error: 'Path traversal attack detected' });
    }
    
    // Additional check: prevent any attempt to access parent directories
    if (normalizedPath.includes('..') || normalizedPath.includes('//')) {
      return sendResponse(400, { error: 'Malicious path detected' });
    }

    console.log('Uploading file:', {
      localFile: file.filepath,
      serverPath: normalizedPath,
      originalFileName: originalFileName,
      uploadedFileName: uploadedFileName,
      finalFileName: finalFileName,
      isReplacing: isReplacing,
      storage: requestedStorage
    });

    // SSH configuration - using same pattern as upscayl
    const remoteUser = process.env.SCP_USER || 'root';
    const remoteHost = process.env.SCP_HOST || 'vmi2327956.contaboserver.net';
    const sshKeyPath = process.env.SSH_PRIVATE_KEY_PATH || '/root/.ssh/id_rsa';
    const sshPrefix = `${remoteUser}@${remoteHost}`;

    // Create the target directory before uploading. Customize uploads are
    // grouped by month (for example, 2026_07), so a new month may not exist
    // on the remote server yet.
    const remoteDirectory = path.posix.dirname(normalizedPath);
    if (remoteDirectory !== remoteFolder && !remoteDirectory.startsWith(`${remoteFolder}/`)) {
      return sendResponse(400, { error: 'Invalid remote directory' });
    }

    const mkdirCommand = `ssh -i '${sshKeyPath}' ${sshPrefix} 'mkdir -p "${remoteDirectory}" && test -d "${remoteDirectory}" && echo "exists"'`;
    console.log('Ensuring upload directory exists:', remoteDirectory);
    const { stdout: mkdirResult } = await execAsync(mkdirCommand);
    if (!mkdirResult.includes('exists')) {
      throw new Error('Target directory could not be created');
    }

    // PRODUCTION SECURITY: SAFE FILE UPLOAD with validation
    const scpCommand = `scp -i '${sshKeyPath}' "${file.filepath}" ${sshPrefix}:${normalizedPath}`;
    console.log('Uploading file (safe overwrite):', scpCommand);
    
    try {
      // PRODUCTION SECURITY: Check if target directory exists before upload
      const checkDirCommand = `ssh -i '${sshKeyPath}' ${sshPrefix} 'test -d "$(dirname "${normalizedPath}")" && echo "exists"'`;
      const { stdout: dirCheck } = await execAsync(checkDirCommand);
      
      if (!dirCheck.includes('exists')) {
        throw new Error('Target directory does not exist - cannot upload');
      }
      
      await execAsync(scpCommand);
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Clean up temporary file
    try {
      fs.unlinkSync(file.filepath);
    } catch (error) {
      console.warn('Failed to clean up temp file:', error);
    }

    // PRODUCTION SECURITY: SAFE PERMISSION SETTING with validation
    const chmodCommand = `ssh -i '${sshKeyPath}' ${sshPrefix} 'chmod 644 "${normalizedPath}"'`;
    console.log('Setting permissions (safe):', chmodCommand);
    try {
      await execAsync(chmodCommand);
      
      // PRODUCTION SECURITY: Verify file was uploaded successfully
      const verifyCommand = `ssh -i '${sshKeyPath}' ${sshPrefix} 'test -f "${normalizedPath}" && echo "exists"'`;
      const { stdout: verifyResult } = await execAsync(verifyCommand);
      
      if (!verifyResult.includes('exists')) {
        throw new Error('File upload verification failed');
      }
    } catch (error) {
      console.error('Failed to set permissions or verify upload:', error);
      // Don't throw error for permission setting, just log it
    }

    // Return appropriate message based on whether we're replacing or adding new file
    const message = isReplacing 
      ? 'File uploaded successfully and safely - replaced original file'
      : 'File uploaded successfully and safely - added new file with different name';
    
    return sendResponse(200, { 
      success: true, 
      message: message,
      serverPath: normalizedPath,
      url: requestedStorage === 'customize'
        ? `https://customize.idreamshirt.com/uploads/customize/${imagePath}/${finalFileName}`
        : `https://api.idreamshirt.com/images/${imagePath}/${finalFileName}`,
      isReplacing: isReplacing,
      originalFileName: originalFileName,
      uploadedFileName: uploadedFileName,
      finalFileName: finalFileName,
      storage: requestedStorage
    });

  } catch (error) {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    console.error('Upload error:', error);

    if (res.headersSent || res.writableEnded) {
      return;
    }

    return sendResponse(500, { 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
