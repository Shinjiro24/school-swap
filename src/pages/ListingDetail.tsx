import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Heart, MessageCircle, ArrowLeft } from 'lucide-react';
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
      .select(`
        *,
        profiles:seller_id (name, email, grade)
      `)
      .eq('id', id)
      .eq('status', 'approved')
      .maybeSingle();

    if (error || !data) {
      toast.error('Listing not found');
      navigate('/');
    } else {
      setListing({ ...data, seller: data.profiles });
    }
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
                <Badge>{listing.category}</Badge>
              </div>
              <p className="text-4xl font-bold text-primary mb-4">${listing.price.toFixed(2)}</p>
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

            <div className="flex gap-3">
              <Button
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
    </div>
  );
};

export default ListingDetail;