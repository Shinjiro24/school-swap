import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Check, X, Trash2, Eye, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  status: string;
  images: string[];
  seller_id: string;
  created_at: string;
  class_level?: string;
  subject?: string;
  listing_type?: string;
  seller?: {
    name: string;
    email: string;
    grade: string;
  };
}

const Admin = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    fetchListings();
    fetchStats();
  }, [activeTab]);

  const fetchStats = async () => {
    const [pending, approved, rejected] = await Promise.all([
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
    ]);
    
    setStats({
      pending: pending.count || 0,
      approved: approved.count || 0,
      rejected: rejected.count || 0,
    });
  };

  const fetchListings = async () => {
    setLoading(true);
    
    // Fetch listings first
    const { data: listingsData, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .eq('status', activeTab)
      .order('created_at', { ascending: activeTab === 'pending' });

    if (listingsError) {
      console.error('Error fetching listings:', listingsError);
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
    
    // Fetch profiles for those sellers
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, email, grade')
      .in('id', sellerIds);

    // Create a map of profiles
    const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);

    // Combine listings with seller info
    const listingsWithSellers = listingsData.map(listing => ({
      ...listing,
      seller: profileMap.get(listing.seller_id)
    }));

    setListings(listingsWithSellers);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    const listing = listings.find(l => l.id === id);
    
    const { error } = await supabase
      .from('listings')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update listing');
    } else {
      toast.success(`Listing ${status}`);
      
      // Create notification for seller
      if (listing) {
        await supabase.from('notifications').insert({
          user_id: listing.seller_id,
          type: status === 'approved' ? 'listing_approved' : 'listing_rejected',
          title: status === 'approved' ? 'Listing Approved!' : 'Listing Rejected',
          message: status === 'approved' 
            ? `Your listing "${listing.title}" has been approved and is now visible.`
            : `Your listing "${listing.title}" has been rejected. Please review our guidelines.`,
          listing_id: listing.id
        });
      }
      
      fetchListings();
      fetchStats();
      setSelectedListing(null);
    }
  };

  const deleteListing = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    const { error } = await supabase.from('listings').delete().eq('id', id);
    
    if (error) {
      toast.error('Failed to delete listing');
    } else {
      toast.success('Listing deleted');
      fetchListings();
      fetchStats();
      setSelectedListing(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">Review and manage listings</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" /> Pending ({stats.pending})
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="w-4 h-4" /> Approved ({stats.approved})
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="w-4 h-4" /> Rejected ({stats.rejected})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : listings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No {activeTab} listings</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {listings.map(listing => (
                  <Card key={listing.id} className="overflow-hidden">
                    <div className="aspect-square bg-muted relative">
                      <img
                        src={listing.images[0] || '/placeholder.svg'}
                        alt={listing.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 flex gap-1">
                        <Badge>{listing.category}</Badge>
                        {listing.listing_type === 'borrow' && (
                          <Badge variant="secondary">Borrowable</Badge>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-1 line-clamp-1">{listing.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{listing.description}</p>
                      <p className="text-xl font-bold text-primary mb-2">€{listing.price.toFixed(2)}</p>
                      
                      {(listing.class_level || listing.subject) && (
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {listing.class_level && (
                            <Badge variant="outline">{listing.class_level}</Badge>
                          )}
                          {listing.subject && (
                            <Badge variant="outline">{listing.subject}</Badge>
                          )}
                        </div>
                      )}
                      
                      {listing.seller && (
                        <div className="text-sm text-muted-foreground mb-3 pb-3 border-b">
                          <p className="font-medium">Seller: {listing.seller.name}</p>
                          <p>{listing.seller.email}</p>
                          <p>Grade: {listing.seller.grade}</p>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedListing(listing)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        {activeTab === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateStatus(listing.id, 'approved')}
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateStatus(listing.id, 'rejected')}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        {activeTab !== 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteListing(listing.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedListing} onOpenChange={() => setSelectedListing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedListing && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedListing.title}</DialogTitle>
                <DialogDescription>Review listing details</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedListing.images.map((img: string, idx: number) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`${selectedListing.title} ${idx + 1}`}
                      className="w-full aspect-square object-cover rounded-lg"
                    />
                  ))}
                </div>
                
                <div>
                  <h4 className="font-semibold mb-1">Description</h4>
                  <p className="text-muted-foreground">{selectedListing.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-1">Price</h4>
                    <p className="text-2xl font-bold text-primary">€{selectedListing.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Category</h4>
                    <Badge>{selectedListing.category}</Badge>
                  </div>
                </div>

                {(selectedListing.class_level || selectedListing.subject) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedListing.class_level && (
                      <div>
                        <h4 className="font-semibold mb-1">Class Level</h4>
                        <p>{selectedListing.class_level}</p>
                      </div>
                    )}
                    {selectedListing.subject && (
                      <div>
                        <h4 className="font-semibold mb-1">Subject</h4>
                        <p>{selectedListing.subject}</p>
                      </div>
                    )}
                  </div>
                )}

                {selectedListing.seller && (
                  <div>
                    <h4 className="font-semibold mb-1">Seller Information</h4>
                    <p>Name: {selectedListing.seller.name}</p>
                    <p>Email: {selectedListing.seller.email}</p>
                    <p>Grade: {selectedListing.seller.grade}</p>
                  </div>
                )}
                
                <div className="flex gap-2 pt-4">
                  {selectedListing.status === 'pending' && (
                    <>
                      <Button
                        className="flex-1"
                        onClick={() => updateStatus(selectedListing.id, 'approved')}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => updateStatus(selectedListing.id, 'rejected')}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => deleteListing(selectedListing.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
