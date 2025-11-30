import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import QRCodeModal from '@/components/QRCodeModal';
import BuyModal from '@/components/BuyModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Heart, MessageCircle, ArrowLeft, QrCode, ShoppingCart, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

const ListingDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<any>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMessage, setShowMessage] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [message, setMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (id) {
      fetchListing();
      checkFavorite();
    }
  }, [id, user]);

  const fetchListing = async () => {
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .in('status', ['approved', 'sold'])
      .maybeSingle();

    if (error || !data) {
      toast.error('Listing not found');
      navigate('/');
      setLoading(false);
      return;
    }

    // Fetch seller profile separately
    const { data: profileData } = await supabase
      .from('profiles')
      .select('name, email, grade')
      .eq('id', data.seller_id)
      .maybeSingle();

    setListing({ ...data, seller: profileData });
    setLoading(false);
  };

  const checkFavorite = async () => {
    if (!user || !id) return;
    
    const { data } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('listing_id', id)
      .maybeSingle();
    
    setIsFavorite(!!data);
  };

  const toggleFavorite = async () => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      return;
    }

    if (isFavorite) {
      await supabase.from('favorites').delete().eq('listing_id', id).eq('user_id', user.id);
      toast.success('Removed from favorites');
      setIsFavorite(false);
    } else {
      await supabase.from('favorites').insert({ listing_id: id, user_id: user.id });
      toast.success('Added to favorites');
      setIsFavorite(true);
    }
  };

  const sendMessage = async () => {
    if (!user || !listing) return;
    
    if (message.trim().length < 1) {
      toast.error('Please enter a message');
      return;
    }

    setSendingMessage(true);
    const { error } = await supabase.from('messages').insert([{
      listing_id: listing.id,
      sender_id: user.id,
      receiver_id: listing.seller_id,
      content: message.trim()
    }]);

    if (error) {
      toast.error('Failed to send message');
    } else {
      toast.success('Message sent to seller!');
      setMessage('');
      setShowMessage(false);
    }
    setSendingMessage(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 text-center">Loading...</div>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Carousel className="w-full">
              <CarouselContent>
                {listing.images.map((image: string, index: number) => (
                  <CarouselItem key={index}>
                    <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                      <img
                        src={image}
                        alt={`${listing.title} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {listing.images.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-3xl font-bold">{listing.title}</h1>
                <div className="flex gap-2">
                  {listing.status === 'sold' && (
                    <Badge variant="destructive" className="bg-red-500">
                      Sold
                    </Badge>
                  )}
                  {listing.listing_type === 'borrow' && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      <FileText className="w-3 h-3 mr-1" />
                      Borrowable
                    </Badge>
                  )}
                  <Badge>{listing.category}</Badge>
                </div>
              </div>
              
              <p className="text-4xl font-bold text-primary mb-2">
                {listing.listing_type === 'borrow' ? 'Free to Borrow' : `€${listing.price.toFixed(2)}`}
              </p>
              
              {listing.listing_type === 'borrow' && listing.borrow_duration_days && (
                <p className="text-sm text-muted-foreground mb-2">
                  Borrow period: {listing.borrow_duration_days} days
                </p>
              )}
              
              {(listing.class_level || listing.subject) && (
                <div className="flex gap-2 mb-4">
                  {listing.class_level && (
                    <Badge variant="outline">Class {listing.class_level}</Badge>
                  )}
                  {listing.subject && (
                    <Badge variant="outline">{listing.subject}</Badge>
                  )}
                </div>
              )}
              
              <p className="text-muted-foreground whitespace-pre-wrap">{listing.description}</p>
            </div>

            {listing.seller && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Seller Information</h3>
                  <p className="text-sm text-muted-foreground">Name: {listing.seller.name}</p>
                  <p className="text-sm text-muted-foreground">Grade: {listing.seller.grade}</p>
                </CardContent>
              </Card>
            )}

            {listing.payment_method && listing.payment_method.length > 0 && listing.listing_type !== 'borrow' && (
              <div>
                <h3 className="font-semibold mb-2 text-sm">Accepted Payment Methods</h3>
                <div className="flex gap-2 flex-wrap">
                  {listing.payment_method.map((method: string) => (
                    <Badge key={method} variant="outline" className="capitalize">
                      {method === 'apple_pay' ? 'Apple Pay' : method}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {listing.status === 'sold' ? (
                <div className="w-full p-4 bg-muted rounded-lg text-center">
                  <p className="text-muted-foreground font-medium">This item has been sold</p>
                </div>
              ) : listing.seller_id !== user?.id && (
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => setShowBuyModal(true)}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {listing.listing_type === 'borrow' ? 'Borrow This Item' : 'Buy Now'}
                </Button>
              )}
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowMessage(true)}
                  disabled={listing.seller_id === user?.id}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Contact Seller
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleFavorite}
                >
                  <Heart className={`w-5 h-5 ${isFavorite ? 'fill-accent text-accent' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowQRCode(true)}
                >
                  <QrCode className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showMessage} onOpenChange={setShowMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>Send a message to the seller about this listing</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Hi, I'm interested in this item..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
            <Button
              className="w-full"
              onClick={sendMessage}
              disabled={sendingMessage}
            >
              {sendingMessage ? 'Sending...' : 'Send Message'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <QRCodeModal
        open={showQRCode}
        onOpenChange={setShowQRCode}
        listingId={listing.id}
        listingTitle={listing.title}
      />

      {user && (
        <BuyModal
          open={showBuyModal}
          onOpenChange={setShowBuyModal}
          listing={listing}
          userId={user.id}
          onSuccess={() => {
            toast.success('Check your messages to coordinate with the seller!');
          }}
        />
      )}
    </div>
  );
};

export default ListingDetail;
