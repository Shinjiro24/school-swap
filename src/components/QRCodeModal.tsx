import { QRCodeSVG } from 'qrcode.react';
import { Download, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: string;
  listingTitle: string;
}

const QRCodeModal = ({ open, onOpenChange, listingId, listingTitle }: QRCodeModalProps) => {
  const listingUrl = `${window.location.origin}/listing/${listingId}`;

  const handleDownload = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `qr-${listingId}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      
      toast.success('QR code downloaded!');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: listingTitle,
          text: `Check out this listing: ${listingTitle}`,
          url: listingUrl,
        });
      } catch (error) {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(listingUrl);
      toast.success('Link copied to clipboard!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Listing</DialogTitle>
          <DialogDescription>
            Scan this QR code to view the listing
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="bg-white p-4 rounded-xl">
            <QRCodeSVG
              id="qr-code-svg"
              value={listingUrl}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          
          <p className="text-sm text-muted-foreground text-center max-w-xs break-all">
            {listingUrl}
          </p>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Share Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QRCodeModal;
