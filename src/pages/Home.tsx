import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import ListingCard from '@/components/ListingCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, SlidersHorizontal, BookOpen, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CATEGORIES = ['books', 'notebooks', 'calculators', 'supplies', 'stationery', 'study_notes', 'worksheets', 'posters', 'other'];

const CLASS_LEVELS = ['5', '6', '7', '8', '9', '10', '11', '12', '13'];

const SUBJECTS = [
  'Mathematics', 'German', 'English', 'French', 'Spanish', 'Latin',
  'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Politics',
  'Art', 'Music', 'Sports', 'Computer Science', 'Economics', 'Other'
];

const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listings, setListings] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedClassLevel, setSelectedClassLevel] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [listingType, setListingType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    } else {
      fetchListings();
      fetchFavorites();
    }
  }, [user, navigate]);

  const fetchListings = async () => {
    setLoading(true);
    
    // Fetch listings
    const { data: listingsData, error } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching listings:', error);
      setLoading(false);
      return;
    }

    if (!listingsData || listingsData.length === 0) {
      setListings([]);
      setLoading(false);
      return;
    }

    // Get unique seller IDs
    const sellerIds = [...new Set(listingsData.map(l => l.seller_id))];
    
    // Fetch profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, grade')
      .in('id', sellerIds);

    const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    setListings(listingsData.map(listing => ({
      ...listing,
      seller: profileMap.get(listing.seller_id)
    })));
    
    setLoading(false);
  };

  const fetchFavorites = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id);
    
    if (data) {
      setFavorites(new Set(data.map(f => f.listing_id)));
    }
  };

  const filteredListings = listings
    .filter(listing => {
      const matchesSearch = searchQuery === '' || 
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || listing.category === selectedCategory;
      const matchesClassLevel = selectedClassLevel === 'all' || listing.class_level === selectedClassLevel;
      const matchesSubject = selectedSubject === 'all' || listing.subject === selectedSubject;
      const matchesType = listingType === 'all' || 
        (listingType === 'sale' && listing.listing_type !== 'borrow') ||
        (listingType === 'borrow' && listing.listing_type === 'borrow');
      
      return matchesSearch && matchesCategory && matchesClassLevel && matchesSubject && matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        default:
          return 0;
      }
    });

  const activeFiltersCount = [
    selectedCategory !== 'all',
    selectedClassLevel !== 'all',
    selectedSubject !== 'all',
    listingType !== 'all'
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Browse Marketplace
          </h1>
          <p className="text-muted-foreground">Find great deals on school items from your classmates</p>
        </div>

        {/* Type Tabs */}
        <Tabs value={listingType} onValueChange={setListingType} className="mb-6">
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              All Items
            </TabsTrigger>
            <TabsTrigger value="sale" className="gap-2">
              <BookOpen className="w-4 h-4" />
              For Sale
            </TabsTrigger>
            <TabsTrigger value="borrow" className="gap-2">
              <FileText className="w-4 h-4" />
              Borrowable (Lernzettel)
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search & Main Filters */}
        <div className="mb-4 grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search for items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <SlidersHorizontal className="w-4 h-4" />
            More Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>
            )}
          </Button>
        </div>

        {/* Extended Filters */}
        {showFilters && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg grid gap-4 md:grid-cols-4">
            <Select value={selectedClassLevel} onValueChange={setSelectedClassLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Class Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Class Levels</SelectItem>
                {CLASS_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>
                    Class {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {SUBJECTS.map(subject => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="ghost" 
              onClick={() => {
                setSelectedCategory('all');
                setSelectedClassLevel('all');
                setSelectedSubject('all');
                setSortBy('newest');
                setListingType('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        )}

        {/* Results Count */}
        <p className="text-sm text-muted-foreground mb-4">
          {filteredListings.length} {filteredListings.length === 1 ? 'listing' : 'listings'} found
        </p>

        {/* Listings Grid */}
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No listings found</p>
            <Button asChild className="mt-4">
              <a href="/create-listing">Create the first listing!</a>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredListings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                isFavorite={favorites.has(listing.id)}
                onFavoriteChange={fetchFavorites}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
