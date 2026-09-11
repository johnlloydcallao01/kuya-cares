'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';
import { useUser } from '@/hooks/useAuth';

type OrderHelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | number;
};

export default function OrderHelpModal({ isOpen, onClose, orderId }: OrderHelpModalProps) {
  const { user } = useUser();
  const [concern, setConcern] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Reset state when closed
      setConcern('');
      setScreenshots([]);
      setScreenshotPreviews([]);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      const validFiles: File[] = [];
      const newPreviews: string[] = [];

      // Process each file
      let processedCount = 0;

      newFiles.forEach(file => {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
          toast.error(`Image ${file.name} size should be less than 5MB`);
          processedCount++;
          return;
        }

        validFiles.push(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          processedCount++;
          
          // Once all files are processed, update state
          if (processedCount === newFiles.length) {
            setScreenshots(prev => [...prev, ...validFiles]);
            setScreenshotPreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removeImage = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
    setScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concern.trim()) {
      toast.error('Please describe your concern');
      return;
    }

    setIsSending(true);

    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
      
      const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['Authorization'] = `users API-Key ${apiKey}`;
      }

      let screenshotsData: string[] = [];
      if (screenshots.length > 0) {
        // Convert to base64 if not already done for preview, but we can reuse the preview if it's the full data URL
        // In our case, screenshotPreviews are data URLs
        screenshotsData = screenshotPreviews;
      }

      const res = await fetch(`${API_BASE}/support/order-help`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderId,
          concern,
          screenshots: screenshotsData,
          customerEmail: user?.email,
          customerName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Help request sent successfully!');
        onClose();
      } else {
        toast.error(data.error || 'Failed to send help request');
      }
    } catch (error) {
      console.error('Error sending help request:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        <div className="p-6 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Get Help with Order</h2>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <p className="text-sm text-gray-500 mb-6">
            Please describe your issue with order <span className="font-medium text-gray-900">#{orderId}</span>. 
            Our support team will contact you shortly via email.
          </p>
        </div>

        <div className="p-6 pt-0 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="concern" className="block text-sm font-medium text-gray-700 mb-1">
                Your Concern
              </label>
              <textarea
                id="concern"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none transition-shadow"
                placeholder="e.g., Missing items, wrong order, delivery delay..."
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                disabled={isSending}
                required
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Screenshots (Optional)
              </label>
              
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-amber-500 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    multiple
                  />
                  <div className="text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">Click to upload images</p>
                    <p className="text-xs text-gray-400 mt-1">Max 5MB each</p>
                  </div>
                </div>

                {screenshotPreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {screenshotPreviews.map((preview, index) => (
                      <div key={index} className="relative rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video">
                        <img src={preview} alt={`Screenshot ${index + 1}`} className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                disabled={isSending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg shadow-sm disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Submit Request'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' 
    ? createPortal(modalContent, document.body) 
    : null;
}
