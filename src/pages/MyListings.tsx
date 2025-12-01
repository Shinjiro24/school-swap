import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Trash2, Users, CheckCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface InterestedBuyer {
  transaction_id: string;
  buyer_id: string;
  buyer_name: string;
  payment_method: string;
  amount: number;
  created_at: string;
}

interface ListingWithBuyers {
  id: string;
  title: string;
  category: string;
  price: number;
  status: string;
  images: string[];
  created_at: string;
  interested_buyers: InterestedBuyer[];
}

const MyListings = () => {
  const { user } = useAuth();
  const [listings, setListings] = useState<ListingWithBuyers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<ListingWithBuyers | null>(null);
  const [showBuyersDialog, setShowBuyersDialog] = useState(false);
  const [processingBuyer, setProcessingBuyer] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchListings();
    }
  }, [user]);

  const fetchListings = async () => {
    if (!user) return;
    
    setLoading(true);
    
    // Fetch listings
    const { data: listingsData, error: listingsError } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    if (listingsError || !listingsData) {
      setLoading(false);
      return;
    }

    // Fetch pending transactions for these listings
    const listingIds = listingsData.map(l => l.id);
    
    const { data: transactionsData } = await supabase
      .from('transactions')
      .select('id, listing_id, buyer_id, payment_method, amount, created_at')
      .in('listing_id', listingIds)
      .eq('status', 'pending');

    // Fetch buyer profiles
    const buyerIds = [...new Set(transactionsData?.map(t => t.buyer_id) || [])];
    let profilesData = null;
    
    if (buyerIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', buyerIds);
      profilesData = data;
    }

    const profilesMap = new Map<string, string>(profilesData?.map(p => [p.id, p.name]) || []);

    // Group transactions by listing
    const transactionsByListing = new Map<string, InterestedBuyer[]>();
    transactionsData?.forEach(t => {
      const buyers = transactionsByListing.get(t.listing_id) || [];
      buyers.push({
        transaction_id: t.id,
        buyer_id: t.buyer_id,
        buyer_name: profilesMap.get(t.buyer_id) || 'Unknown User',
        payment_method: t.payment_method,
        amount: t.amount,
        created_at: t.created_at
      });
      transactionsByListing.set(t.listing_id, buyers);
    });

    // Combine listings with their interested buyers
    const listingsWithBuyers: ListingWithBuyers[] = listingsData.map(listing => ({
      ...listing,
      interested_buyers: transactionsByListing.get(listing.id) || []
    }));

    setListings(listingsWithBuyers);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    const { error } = await supabase.from('listings').delete().eq('id', id);
    
    if (error) {
      toast.error('Failed to delete listing');
    } else {
      toast.success('Listing deleted');
      fetchListings();
    }
  };

  const handleAcceptBuyer = async (listing: ListingWithBuyers, buyer: InterestedBuyer) => {
    if (!user) return;
    
    if (!confirm(`Accept purchase from ${buyer.buyer_name} for €${buyer.amount.toFixed(2)}?`)) {
      return;
    }
    
    setProcessingBuyer(buyer.transaction_id);

    try {
      // 1. Mark listing as sold FIRST to prevent race conditions
      const { error: listingError } = await supabase
        .from('listings')
        .update({ status: 'sold' })
        .eq('id', listing.id)
        .eq('seller_id', user.id); // Extra security check

      if (listingError) {
        console.error('Listing update error:', listingError);
        throw new Error('Failed to update listing status');
      }

      // 2. Update the selected transaction to completed
      const { error: transactionError } = await supabase
        .from('transactions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', buyer.transaction_id)
        .eq('seller_id', user.id); // Extra security check

      if (transactionError) {
        console.error('Transaction update error:', transactionError);
        throw new Error('Failed to complete transaction');
      }

      // 3. Cancel all other pending transactions for this listing
      const otherTransactionIds = listing.interested_buyers
        .filter(b => b.transaction_id !== buyer.transaction_id)
        .map(b => b.transaction_id);

      if (otherTransactionIds.length > 0) {
        const { error: cancelError } = await supabase
          .from('transactions')
          .update({ status: 'cancelled' })
          .in('id', otherTransactionIds);
        
        if (cancelError) {
          console.error('Cancel other transactions error:', cancelError);
          // Don't throw - this is not critical
        }
      }

      // 4. Send notifications (non-blocking)
      Promise.all([
        // Notify accepted buyer
        supabase.from('notifications').insert({
          user_id: buyer.buyer_id,
          title: 'Purchase Confirmed!',
          message: `Your purchase of "${listing.title}" has been accepted by the seller. You can now rate the seller.`,
          type: 'purchase_confirmed',
          listing_id: listing.id
        }),
        // Notify rejected buyers
        ...listing.interested_buyers
          .filter(b => b.transaction_id !== buyer.transaction_id)
          .map(otherBuyer => 
            supabase.from('notifications').insert({
              user_id: otherBuyer.buyer_id,
              title: 'Item Sold',
              message: `Unfortunately, "${listing.title}" has been sold to another buyer.`,
              type: 'purchase_rejected',
              listing_id: listing.id
            })
          )
      ]).catch(err => console.error('Notification error:', err));

      toast.success(`Successfully sold to ${buyer.buyer_name}!`);
      setShowBuyersDialog(false);
      setSelectedListing(null);
      fetchListings();
    } catch (error: any) {
      console.error('Error accepting buyer:', error);
      toast.error(error.message || 'Failed to complete sale. Please try again.');
    } finally {
      setProcessingBuyer(null);
    }
  };

  const openBuyersDialog = (listing: ListingWithBuyers) => {
    setSelectedListing(listing);
    setShowBuyersDialog(true);
  };

  const getStatusBadge = (status: string, interestedCount: number) => {
    const variants: Record<string, any> = {
      pending: { variant: 'secondary', label: 'Pending Approval' },
      approved: { variant: 'default', label: 'Available' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      sold: { variant: 'outline', label: 'Sold', className: 'bg-green-500/10 text-green-600 border-green-500/30' }
    };
    
    const config = variants[status] || variants.pending;
    return (
      <div className="flex items-center gap-2">
        <Badge variant={config.variant} className={config.className}>{config.label}</Badge>
        {status === 'approved' && interestedCount > 0 && (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            <Users className="w-3 h-3 mr-1" />
            {interestedCount} interested
          </Badge>
        )}
      </div>
    );
  };

  const filterByStatus = (status: string) => {
    return listings.filter(listing => listing.status === status);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const ListingsList = ({ items }: { items: ListingWithBuyers[] }) => (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No listings found</p>
      ) : (
        items.map(listing => (
          <Card key={listing.id}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img
                    src={listing.images[0] || '/placeholder.svg'}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-lg truncate">{listing.title}</h3>
                      <p className="text-muted-foreground text-sm">{listing.category}</p>
                    </div>
                    {getStatusBadge(listing.status, listing.interested_buyers.length)}
                  </div>
                  <p className="text-xl font-bold text-primary mb-2">€{listing.price.toFixed(2)}</p>
                  <div className="flex flex-wrap gap-2">
                    {listing.status === 'approved' && (
                      <>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/listing/${listing.id}`}>View</Link>
                        </Button>
                        {listing.interested_buyers.length > 0 && (
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => openBuyersDialog(listing)}
                          >
                            <Users className="w-4 h-4 mr-1" />
                            View Interested ({listing.interested_buyers.length})
                          </Button>
                        )}
                      </>
                    )}
                    {listing.status === 'sold' && (
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/listing/${listing.id}`}>View</Link>
                      </Button>
                    )}
                    {listing.status !== 'sold' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(listing.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">My Listings</h1>
        
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All ({listings.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({filterByStatus('pending').length})</TabsTrigger>
            <TabsTrigger value="approved">Available ({filterByStatus('approved').length})</TabsTrigger>
            <TabsTrigger value="sold">Sold ({filterByStatus('sold').length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({filterByStatus('rejected').length})</TabsTrigger>
          </TabsList>
          
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <>
              <TabsContent value="all">
                <ListingsList items={listings} />
              </TabsContent>
              <TabsContent value="pending">
                <ListingsList items={filterByStatus('pending')} />
              </TabsContent>
              <TabsContent value="approved">
                <ListingsList items={filterByStatus('approved')} />
              </TabsContent>
              <TabsContent value="sold">
                <ListingsList items={filterByStatus('sold')} />
              </TabsContent>
              <TabsContent value="rejected">
                <ListingsList items={filterByStatus('rejected')} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Interested Buyers Dialog */}
      <Dialog open={showBuyersDialog} onOpenChange={setShowBuyersDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Interested Buyers</DialogTitle>
            <DialogDescription>
              Choose a buyer to mark your listing as sold
            </DialogDescription>
          </DialogHeader>
          
          {selectedListing && (
            <div className="space-y-3 mt-4">
              {selectedListing.interested_buyers.map(buyer => (
                <Card key={buyer.transaction_id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{buyer.buyer_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {buyer.payment_method} • €{buyer.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(buyer.created_at)}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptBuyer(selectedListing, buyer)}
                        disabled={processingBuyer !== null}
                      >
                        {processingBuyer === buyer.transaction_id ? (
                          'Processing...'
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Accept
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyListings;