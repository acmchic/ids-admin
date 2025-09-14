import React, { useState, useRef } from 'react';
import { toast } from 'react-toastify';

interface UploadImageButtonProps {
  imagePath: string;
  fileName: string;
  originalImageUrl?: string;
  onUploadSuccess?: () => void;
}

const UploadImageButton: React.FC<UploadImageButtonProps> = ({
  imagePath,
  fileName,
  originalImageUrl,
  onUploadSuccess
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to decode HTML entities in filename
  const decodeHtmlEntities = (str: string): string => {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = str;
    return textarea.value;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be less than 25MB');
      return;
    }

    setIsUploading(true);

    // Decode HTML entities in fileName (fix &amp;amp;amp; issue)
    const decodedFileName = decodeHtmlEntities(fileName);

    // Fallback timeout to reset button state if upload hangs
    const fallbackTimeout = setTimeout(() => {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast.error('Upload timeout. Please try again.');
    }, 35000);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', imagePath);
      formData.append('fileName', decodedFileName);

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (response.ok) {
        if (result.isReplacing) {
          toast.success('Upload thành công! Đã thay thế ảnh gốc.');
        } else {
          toast.success(`Upload thành công! File ảnh khác tên - đã upload với tên mới: ${result.finalFileName}`);
        }
        onUploadSuccess?.();
      } else {
        console.error('Upload failed:', result);
        toast.error(`Upload failed: ${result.error || result.details || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error('Upload failed. Please try again.');
      }
    } finally {
      clearTimeout(fallbackTimeout);
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Original Image Preview */}
      {originalImageUrl && (
        <div className="flex flex-col items-center">
          <img
            src={originalImageUrl}
            alt="Original artwork"
            className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => window.open(originalImageUrl, '_blank')}
            title="Click to view original image in new tab"
          />
          <span className="text-xs text-gray-500 mt-1">Original</span>
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={handleClick}
        disabled={isUploading}
        className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Upload new artwork image"
      >
        {isUploading ? (
          <span className="w-4 h-4 animate-spin">⏳</span>
        ) : (
          <span className="w-4 h-4">📤</span>
        )}
        {isUploading ? 'Up...' : 'Up'}
      </button>
    </div>
  );
};

export default UploadImageButton;
