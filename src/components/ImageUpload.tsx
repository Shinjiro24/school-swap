import { useState, useCallback } from 'react';
import { Upload, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  images: File[];
  previews: string[];
  onChange: (images: File[], previews: string[]) => void;
  maxImages?: number;
}

const ImageUpload = ({ images, previews, onChange, maxImages = 5 }: ImageUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        return false;
      }
      return true;
    });

    if (images.length + validFiles.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    const newImages = [...images, ...validFiles].slice(0, maxImages);
    
    // Clean up old previews
    previews.forEach(preview => URL.revokeObjectURL(preview));
    
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    onChange(newImages, newPreviews);
  }, [images, previews, onChange, maxImages]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    const newImages = images.filter((_, i) => i !== index);
    const newPreviews = previews.filter((_, i) => i !== index);
    onChange(newImages, newPreviews);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const newPreviews = [...previews];
    
    const [movedImage] = newImages.splice(draggedIndex, 1);
    const [movedPreview] = newPreviews.splice(draggedIndex, 1);
    
    newImages.splice(index, 0, movedImage);
    newPreviews.splice(index, 0, movedPreview);
    
    setDraggedIndex(index);
    onChange(newImages, newPreviews);
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
          isDragging 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-muted-foreground/25 hover:border-primary/50",
          images.length >= maxImages && "opacity-50 pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-foreground font-medium mb-1">
          Drag & drop images here
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          or click to browse ({images.length}/{maxImages} images)
        </p>
        <label className="inline-block">
          <Button type="button" variant="secondary" asChild>
            <span>Choose Files</span>
          </Button>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
            multiple
            disabled={images.length >= maxImages}
          />
        </label>
      </div>

      {previews.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          {previews.map((preview, index) => (
            <div
              key={preview}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleImageDragOver(e, index)}
              className={cn(
                "relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-move transition-all",
                draggedIndex === index && "opacity-50 scale-95",
                index === 0 && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <img 
                src={preview} 
                alt={`Preview ${index + 1}`} 
                className="w-full h-full object-cover"
                draggable={false}
              />
              
              {/* Drag handle indicator */}
              <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-background/80 rounded p-1">
                  <GripVertical className="w-4 h-4 text-foreground" />
                </div>
              </div>
              
              {/* Remove button */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
              >
                <X className="w-4 h-4" />
              </Button>
              
              {/* Main image badge */}
              {index === 0 && (
                <div className="absolute bottom-2 left-2 right-2">
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                    Main Image
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <p className="text-xs text-muted-foreground">
        Drag images to reorder. First image will be the main listing photo. Max 10MB per image.
      </p>
    </div>
  );
};

export default ImageUpload;
