import React from 'react';
import { Button } from './Button';
import { AlertCircle } from 'lucide-react';

interface ApiKeyModalProps {
  onSelect: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSelect }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4 text-amber-500">
          <AlertCircle size={28} />
          <h2 className="text-xl font-bold text-white">API Key Required</h2>
        </div>
        <p className="text-gray-300 mb-6">
          To use the high-quality <b>Gemini 3 Pro</b> and <b>Upscale</b> features, you need to select a billing-enabled API key from your Google Cloud project.
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={onSelect} variant="primary" size="lg" className="w-full">
            Select API Key
          </Button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-center text-sm text-indigo-400 hover:text-indigo-300"
          >
            Learn more about billing requirements
          </a>
        </div>
      </div>
    </div>
  );
};