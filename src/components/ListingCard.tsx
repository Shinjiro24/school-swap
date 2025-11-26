import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    price: number;
    category: string;
    images: string[];
    seller?: {
      name: string;
      grade: string;
    };
  };
  isFavorite?: boolean;
  onFavoriteChange?: () => void;
}

const ListingCard = ({ listing, isFavorite = false, onFavoriteChange }: ListingCardProps) => {
  const [loading, setLoading] = useState(false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      }
      
      onFavoriteChange?.();
    } catch (error) {
      toast.error('Failed to update favorites');
    } finally {
      setLoading(false);
    }
  };

  const imageUrl = listing.images[0] || '/placeholder.svg';

  return (
    <Link to={`/listing/${listing.id}`}>
      <Card className="overflow-hidden hover:shadow-[var(--shadow-hover)] transition-shadow duration-300 group">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
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
            <Badge variant="secondary" className="shrink-0">{listing.category}</Badge>
          </div>
          <p className="text-2xl font-bold text-primary">${listing.price.toFixed(2)}</p>
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