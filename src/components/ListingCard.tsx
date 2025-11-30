import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, FileText } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    price: number;
    category: string;
    images: string[];
    status?: string;
    class_level?: string;
    subject?: string;
    listing_type?: string;
    seller_id?: string;
    seller?: {
      name: string;
      grade: string;
    };
  };
  isFavorite?: boolean;
  onFavoriteChange?: () => void;
}

const ListingCard = ({ listing, isFavorite = false, onFavoriteChange }: ListingCardProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user) {
        toast.error('Please sign in to save favorites');
        return;
      }

      if (isFavorite) {
        await supabase.from('favorites').delete().eq('listing_id', listing.id).eq('user_id', user.id);
        toast.success('Removed from favorites');
      } else {
        await supabase.from('favorites').insert({ listing_id: listing.id, user_id: user.id });
        toast.success('Added to favorites');
        
        // Create notification for seller
        if (listing.seller_id && listing.seller_id !== user.id) {
          await supabase.from('notifications').insert({
            user_id: listing.seller_id,
            type: 'favorite_added',
            title: 'Someone favorited your listing!',
            message: `Your listing "${listing.title}" was added to favorites.`,
            listing_id: listing.id
          });
        }
      }
      
      onFavoriteChange?.();
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setLoading(false);
    }
  };

  const imageUrl = listing.images[0] || '/placeholder.svg';
  const isBorrowable = listing.listing_type === 'borrow';
  const isSold = listing.status === 'sold';

  return (
    <Link to={`/listing/${listing.id}`}>
      <Card className={`overflow-hidden hover:shadow-[var(--shadow-hover)] transition-shadow duration-300 group ${isSold ? 'opacity-75' : ''}`}>
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          
          {isSold && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <Badge variant="destructive" className="text-lg px-4 py-2 bg-red-500">
                Sold
              </Badge>
            </div>
          )}
          
          <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
            {isBorrowable && !isSold && (
              <Badge className="bg-primary/90 backdrop-blur-sm">
                <FileText className="w-3 h-3 mr-1" />
                Lernzettel
              </Badge>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
            onClick={toggleFavorite}
            disabled={loading}
          >
            <Heart className={`w-5 h-5 ${isFavorite ? 'fill-accent text-accent' : ''}`} />
          </Button>
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-lg line-clamp-2">{listing.title}</h3>
            <Badge variant="secondary" className="shrink-0">
              {listing.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Badge>
          </div>
          
          {(listing.class_level || listing.subject) && (
            <div className="flex gap-1 mb-2 flex-wrap">
              {listing.class_level && (
                <Badge variant="outline" className="text-xs">
                  Class {listing.class_level}
                </Badge>
              )}
              {listing.subject && (
                <Badge variant="outline" className="text-xs">
                  {listing.subject}
                </Badge>
              )}
            </div>
          )}
          
          <p className="text-2xl font-bold text-primary">
            {isBorrowable ? 'Free' : `€${listing.price.toFixed(2)}`}
          </p>
        </CardContent>
        {listing.seller && (
          <CardFooter className="px-4 pb-4 pt-0 text-sm text-muted-foreground">
            {listing.seller.name} · {listing.seller.grade}
          </CardFooter>
        )}
      </Card>
    </Link>
  );
};

export default ListingCard;
