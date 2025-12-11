import React, { useState, useEffect } from 'react';
import { Image, Upload, Wand2, Download, Maximize2, X, Grid, Camera, ZoomIn } from 'lucide-react';
import { generateImagePro, editImageFlash, upscaleImage, checkApiKeySelection, openApiKeySelection } from './services/geminiService';
import { Button } from './components/Button';
import { Spinner } from './components/Spinner';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImageResult, GenerationMode, ImageSize, AspectRatio } from './types';

// Extend window definition for AI Studio specific API
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}

const App: React.FC = () => {
  const [mode, setMode] = useState<GenerationMode>(GenerationMode.EDIT_ANGLES);
  const [prompt, setPrompt] = useState('');
  const [inputImage, setInputImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<ImageResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<ImageSize>(ImageSize.SIZE_1K);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('1:1');
  
  // Modal / Viewer state
  const [viewImage, setViewImage] = useState<ImageResult | null>(null);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // API Key State
  const [hasApiKey, setHasApiKey] = useState(true);

  // Check API key status on mount
  useEffect(() => {
    checkApiKeySelection().then(setHasApiKey);
  }, []);

  // Reset zoom when viewing a new image
  useEffect(() => {
    if (viewImage) setZoomLevel(1);
  }, [viewImage]);

  const handleApiKeySelect = async () => {
    try {
      await openApiKeySelection();
      setHasApiKey(true);
    } catch (e) {
      console.error("Failed to select key", e);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInputImage(reader.result as string);
        setGeneratedImages([]); // Clear previous generations when new image uploaded
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleZoom = () => {
    setZoomLevel(prev => prev === 1 ? 2.5 : 1);
  };

  const handleGenerate = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (mode === GenerationMode.GENERATE) {
        if (!hasApiKey) {
          setIsLoading(false);
          return;
        }
        
        if (!prompt) {
          throw new Error("Please enter a prompt description.");
        }

        const base64 = await generateImagePro(prompt, selectedSize, selectedRatio);
        setGeneratedImages([{
          id: Date.now().toString(),
          data: base64,
          mimeType: 'image/png',
          prompt,
          model: 'gemini-3-pro-image-preview',
          timestamp: Date.now()
        }]);

      } else if (mode === GenerationMode.EDIT_ANGLES) {
        if (!inputImage) {
          throw new Error("Please upload an image first.");
        }

        // Generate 7 variations based on different camera angles
        const angles = [
          { name: "Low Angle", promptSuffix: "viewed from a low camera angle, looking up, dramatic perspective" },
          { name: "High Angle", promptSuffix: "viewed from a high camera angle, looking down, bird's eye view" },
          { name: "Side Profile", promptSuffix: "viewed from the side profile, cinematic lighting" },
          { name: "Wide Shot", promptSuffix: "wide angle shot, showing surrounding context, environmental view" },
          { name: "Close Up", promptSuffix: "extreme close up shot, highly detailed texture, macro photography style" },
          { name: "Dutch Angle", promptSuffix: "Dutch angle shot, tilted camera horizon, dynamic energy, unease" },
          { name: "Over the Shoulder", promptSuffix: "over-the-shoulder shot, narrative perspective, depth of field" }
        ];

        // Execute in parallel with allSettled to allow partial success
        const promises = angles.map(async (angle) => {
          const fullPrompt = prompt 
            ? `${prompt}, ${angle.promptSuffix}`
            : `Keep the subject but change camera to ${angle.promptSuffix}`;
            
          const resultBase64 = await editImageFlash(inputImage, fullPrompt, selectedRatio);
          return {
            id: crypto.randomUUID(),
            data: resultBase64,
            mimeType: 'image/png',
            prompt: `${angle.name}: ${fullPrompt}`,
            model: 'gemini-2.5-flash-image',
            timestamp: Date.now()
          } as ImageResult;
        });

        const results = await Promise.allSettled(promises);
        
        const successfulImages = results
          .filter((r): r is PromiseFulfilledResult<ImageResult> => r.status === 'fulfilled')
          .map(r => r.value);

        if (successfulImages.length === 0) {
            // Check if any rejected reason was due to API key
            const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
            if (rejected?.reason?.message?.includes('Requested entity was not found')) {
                 setHasApiKey(false);
            }
            throw new Error(rejected?.reason?.message || "Failed to generate any variations.");
        }

        setGeneratedImages(successfulImages);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during generation");
      if (err.message?.includes("Requested entity was not found") || err.message?.includes("API key")) {
        setHasApiKey(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpscale = async (imageToUpscale: ImageResult) => {
    if (!hasApiKey) {
      setHasApiKey(false);
      return;
    }

    setIsUpscaling(true);
    try {
      const upscaledBase64 = await upscaleImage(imageToUpscale.data, imageToUpscale.prompt, ImageSize.SIZE_4K);
      
      const upscaledResult: ImageResult = {
        id: Date.now().toString(),
        data: upscaledBase64,
        mimeType: 'image/png',
        prompt: imageToUpscale.prompt,
        model: 'gemini-3-pro-image-preview (Upscaled)',
        timestamp: Date.now()
      };

      setViewImage(upscaledResult);
      setGeneratedImages(prev => [upscaledResult, ...prev]);

    } catch (err: any) {
      setError(err.message || "Failed to upscale");
      if (err.message?.includes("Requested entity was not found")) {
         setHasApiKey(false);
      }
    } finally {
      setIsUpscaling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-indigo-500 selection:text-white">
      {!hasApiKey && <ApiKeyModal onSelect={handleApiKeySelect} />}

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Camera size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              RANUM ADJENG KIRANI GRID
            </h1>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={mode === GenerationMode.EDIT_ANGLES ? 'primary' : 'ghost'} 
              onClick={() => setMode(GenerationMode.EDIT_ANGLES)}
              size="sm"
            >
              <Grid size={16} className="mr-2" />
              Angle Variations
            </Button>
            <Button 
              variant={mode === GenerationMode.GENERATE ? 'primary' : 'ghost'} 
              onClick={() => setMode(GenerationMode.GENERATE)}
              size="sm"
            >
              <Wand2 size={16} className="mr-2" />
              Generate New
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Controls Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          
          {/* Left Panel: Inputs */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              
              {mode === GenerationMode.EDIT_ANGLES && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Source Image</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      className="hidden" 
                      id="image-upload"
                    />
                    <label 
                      htmlFor="image-upload" 
                      className={`
                        flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                        ${inputImage ? 'border-indigo-500 bg-gray-800' : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'}
                      `}
                    >
                      {inputImage ? (
                        <img src={inputImage} alt="Input" className="h-full w-full object-cover rounded-lg opacity-80 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="flex flex-col items-center p-4 text-center">
                          <Upload className="h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-400">Click to upload sample image</p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    {mode === GenerationMode.GENERATE ? "Image Prompt" : "Editing Instructions (Optional)"}
                  </label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={mode === GenerationMode.GENERATE 
                      ? "Describe the image you want to create..." 
                      : "E.g., 'Make it cyberpunk style' (Angles will be applied automatically)"}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[100px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Aspect Ratio</label>
                    <select 
                      value={selectedRatio} 
                      onChange={(e) => setSelectedRatio(e.target.value as AspectRatio)}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="1:1">Square (1:1)</option>
                      <option value="16:9">Landscape (16:9)</option>
                      <option value="9:16">Portrait (9:16)</option>
                      <option value="4:3">Standard (4:3)</option>
                      <option value="3:4">Vertical (3:4)</option>
                    </select>
                  </div>

                  {mode === GenerationMode.GENERATE && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Size (Quality)</label>
                      <select 
                        value={selectedSize} 
                        onChange={(e) => setSelectedSize(e.target.value as ImageSize)}
                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-100 focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value={ImageSize.SIZE_1K}>Standard (1K)</option>
                        <option value={ImageSize.SIZE_2K}>High (2K)</option>
                        <option value={ImageSize.SIZE_4K}>Ultra (4K)</option>
                      </select>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={isLoading || (mode === GenerationMode.EDIT_ANGLES && !inputImage) || (mode === GenerationMode.GENERATE && !prompt)}
                  isLoading={isLoading}
                  className="w-full mt-4"
                  size="lg"
                >
                  {mode === GenerationMode.GENERATE ? 'Generate Image' : 'Generate Variations'}
                </Button>
                
                {error && (
                  <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Results Grid */}
          <div className="lg:col-span-2">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {generatedImages.length > 0 ? "Results" : "Preview Area"}
                </h2>
                {generatedImages.length > 0 && (
                   <span className="text-sm text-gray-400">
                     {generatedImages.length} image{generatedImages.length !== 1 ? 's' : ''} generated
                   </span>
                )}
             </div>

             {isLoading ? (
               <div className="h-96 flex flex-col items-center justify-center bg-gray-900/30 border border-gray-800 rounded-xl border-dashed">
                 <Spinner />
                 <p className="text-gray-400 mt-4 animate-pulse">
                   {mode === GenerationMode.GENERATE ? "Creating your masterpiece..." : "Generating 7 angle variations..."}
                 </p>
               </div>
             ) : generatedImages.length > 0 ? (
               <div className={`grid gap-4 ${generatedImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'}`}>
                 {generatedImages.map((img) => (
                   <div 
                    key={img.id} 
                    className="group relative aspect-square bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-indigo-500 transition-all cursor-pointer shadow-lg"
                    onClick={() => setViewImage(img)}
                   >
                     <img src={img.data} alt={img.prompt} className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                        <p className="text-white text-sm line-clamp-2 mb-2">{img.prompt}</p>
                        <div className="flex items-center gap-2">
                           <span className="text-xs bg-indigo-600/80 text-white px-2 py-1 rounded">
                              {img.model.includes('flash') ? 'Flash' : 'Pro'}
                           </span>
                           <Maximize2 size={14} className="text-white ml-auto" />
                        </div>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="h-96 flex flex-col items-center justify-center bg-gray-900/30 border border-gray-800 rounded-xl border-dashed text-gray-500">
                 <Image size={48} className="mb-4 opacity-50" />
                 <p>No images generated yet.</p>
                 <p className="text-sm">Upload a sample or enter a prompt to begin.</p>
               </div>
             )}
          </div>
        </div>
      </main>

      {/* Image Viewer / Upscale Modal */}
      {viewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
          <button 
            onClick={() => setViewImage(null)}
            className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 z-50 bg-black/50 rounded-full"
          >
            <X size={24} />
          </button>

          <div className="max-w-6xl w-full h-[90vh] flex flex-col md:flex-row gap-6 p-2">
            
            {/* Image Viewer with Zoom */}
            <div 
              className="flex-1 flex items-center justify-center bg-gray-900/50 rounded-xl overflow-hidden border border-gray-800 relative group"
              onClick={toggleZoom}
              style={{ cursor: zoomLevel > 1 ? 'zoom-out' : 'zoom-in' }}
            >
               <img 
                 src={viewImage.data} 
                 alt={viewImage.prompt} 
                 className="max-w-none transition-transform duration-300 ease-out"
                 style={{ 
                   transform: `scale(${zoomLevel})`,
                   maxHeight: '100%',
                   maxWidth: '100%',
                   objectFit: 'contain' 
                 }}
               />
               <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 pointer-events-none">
                 <ZoomIn size={16} />
                 {zoomLevel === 1 ? "Click to Zoom" : "Click to Reset"}
               </div>
            </div>
            
            {/* Sidebar Controls */}
            <div className="w-full md:w-80 flex flex-col gap-4 bg-gray-900 p-6 rounded-xl border border-gray-800 h-fit overflow-y-auto">
               <div>
                  <h3 className="text-lg font-bold text-white mb-2">Image Details</h3>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-6">{viewImage.prompt}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-700">
                      {viewImage.model}
                    </span>
                    <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300 border border-gray-700">
                      PNG
                    </span>
                  </div>
               </div>

               <div className="flex flex-col gap-3 mt-auto">
                 <Button 
                   onClick={(e) => { e.stopPropagation(); handleUpscale(viewImage); }}
                   disabled={isUpscaling || viewImage.model.includes('Upscaled')}
                   variant="secondary"
                   isLoading={isUpscaling}
                   className="w-full justify-between"
                 >
                   <span className="flex items-center">
                     <Maximize2 size={18} className="mr-2" />
                     Upscale to 4K
                   </span>
                   {viewImage.model.includes('Upscaled') && <span className="text-xs bg-green-900 text-green-200 px-1.5 py-0.5 rounded">Done</span>}
                 </Button>

                 <a 
                   href={viewImage.data} 
                   download={`gemini-image-${viewImage.id}.png`}
                   className="flex items-center justify-center w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
                   onClick={(e) => e.stopPropagation()}
                 >
                   <Download size={18} className="mr-2" />
                   Download Image
                 </a>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;