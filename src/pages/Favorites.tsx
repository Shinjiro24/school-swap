import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import ListingCard from '@/components/ListingCard';

const Favorites = () => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFavorites();
    }
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        listing_id,
        listings (
          *,
          profiles:seller_id (name, grade)
        )
      `)
      .eq('user_id', user.id);

    if (!error && data) {
      const listingsData = data
        .filter(f => f.listings)
        .map(f => ({
          ...f.listings,
          seller: f.listings.profiles
        }));
      
      setFavorites(listingsData);
      setFavoriteIds(new Set(data.map(f => f.listing_id)));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Favorites</h1>
        
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No favorites yet</p>
            <p className="text-muted-foreground">Browse listings and save your favorites!</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isFavorite={favoriteIds.has(listing.id)}
                onFavoriteChange={fetchFavorites}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Favorites;