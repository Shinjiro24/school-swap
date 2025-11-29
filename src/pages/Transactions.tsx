import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { History, Star, ShoppingBag, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  payment_method: string;
  status: string;
  transaction_type: string;
  created_at: string;
  completed_at?: string;
  listing?: {
    title: string;
    images: string[];
  };
  buyer?: {
    name: string;
  };
  seller?: {
    name: string;
  };
  rating?: {
    product_quality: number;
    communication: number;
    transaction_speed: number;
    comment?: string;
  };
}

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('purchases');
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [rating, setRating] = useState({
    product_quality: 5,
    communication: 5,
    transaction_speed: 5,
    comment: ''
  });

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user, activeTab]);

  const fetchTransactions = async () => {
    if (!user) return;
    setLoading(true);

    const column = activeTab === 'purchases' ? 'buyer_id' : 'seller_id';
    
    const { data: transactionsData, error } = await supabase
      .from('transactions')
      .select('*')
      .eq(column, user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      setLoading(false);
      return;
    }

    if (!transactionsData || transactionsData.length === 0) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    // Fetch related data
    const listingIds = [...new Set(transactionsData.map(t => t.listing_id).filter(Boolean))];
    const userIds = [...new Set([
      ...transactionsData.map(t => t.buyer_id),
      ...transactionsData.map(t => t.seller_id)
    ])];
    const transactionIds = transactionsData.map(t => t.id);

    const [listingsRes, profilesRes, ratingsRes] = await Promise.all([
      listingIds.length > 0 
        ? supabase.from('listings').select('id, title, images').in('id', listingIds)
        : { data: [] },
      supabase.from('profiles').select('id, name').in('id', userIds),
      supabase.from('ratings').select('*').in('transaction_id', transactionIds).eq('rater_id', user.id)
    ]);

    const listingsMap = new Map<string, any>();
    listingsRes.data?.forEach(l => listingsMap.set(l.id, l));
    
    const profilesMap = new Map<string, any>();
    profilesRes.data?.forEach(p => profilesMap.set(p.id, p));
    
    const ratingsMap = new Map<string, any>();
    ratingsRes.data?.forEach(r => ratingsMap.set(r.transaction_id, r));

    const enrichedTransactions: Transaction[] = transactionsData.map(t => ({
      ...t,
      listing: listingsMap.get(t.listing_id),
      buyer: profilesMap.get(t.buyer_id),
      seller: profilesMap.get(t.seller_id),
      rating: ratingsMap.get(t.id)
    }));

    setTransactions(enrichedTransactions);
    setLoading(false);
  };

  const openRatingDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setRating({
      product_quality: 5,
      communication: 5,
      transaction_speed: 5,
      comment: ''
    });
    setShowRatingDialog(true);
  };

  const submitRating = async () => {
    if (!user || !selectedTransaction) return;

    const ratedUserId = activeTab === 'purchases' 
      ? selectedTransaction.seller_id 
      : selectedTransaction.buyer_id;

    const { error } = await supabase.from('ratings').insert({
      transaction_id: selectedTransaction.id,
      rater_id: user.id,
      rated_user_id: ratedUserId,
      product_quality: rating.product_quality,
      communication: rating.communication,
      transaction_speed: rating.transaction_speed,
      comment: rating.comment || null
    });

    if (error) {
      toast.error('Failed to submit rating');
    } else {
      toast.success('Rating submitted!');
      setShowRatingDialog(false);
      fetchTransactions();
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const StarRating = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          className={`${onChange ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <Star
            className={`w-6 h-6 ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <History className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Transaction History</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="purchases" className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              My Purchases
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <Package className="w-4 h-4" />
              My Sales
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Loading...</div>
            ) : transactions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
                  <p className="text-muted-foreground">
                    {activeTab === 'purchases' 
                      ? 'When you buy items, they\'ll appear here.'
                      : 'When you sell items, they\'ll appear here.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {transactions.map(transaction => (
                  <Card key={transaction.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {transaction.listing?.images?.[0] && (
                          <Link to={`/listing/${transaction.listing_id}`}>
                            <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              <img 
                                src={transaction.listing.images[0]} 
                                alt="" 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          </Link>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h3 className="font-semibold">
                                {transaction.listing?.title || 'Deleted Listing'}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {activeTab === 'purchases' ? 'From: ' : 'To: '}
                                {activeTab === 'purchases' 
                                  ? transaction.seller?.name 
                                  : transaction.buyer?.name}
                              </p>
                            </div>
                            {getStatusBadge(transaction.status)}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span>€{transaction.amount.toFixed(2)}</span>
                            <span>{transaction.payment_method}</span>
                            <span>{formatDate(transaction.created_at)}</span>
                          </div>

                          {transaction.status === 'completed' && !transaction.rating && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => openRatingDialog(transaction)}
                            >
                              <Star className="w-4 h-4 mr-2" />
                              Rate {activeTab === 'purchases' ? 'Seller' : 'Buyer'}
                            </Button>
                          )}

                          {transaction.rating && (
                            <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm font-medium mb-2">Your Rating</p>
                              <div className="grid gap-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground w-32">Quality:</span>
                                  <StarRating value={transaction.rating.product_quality || 0} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground w-32">Communication:</span>
                                  <StarRating value={transaction.rating.communication} />
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground w-32">Speed:</span>
                                  <StarRating value={transaction.rating.transaction_speed} />
                                </div>
                                {transaction.rating.comment && (
                                  <p className="text-muted-foreground mt-1">
                                    "{transaction.rating.comment}"
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Rating Dialog */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Your Experience</DialogTitle>
            <DialogDescription>
              How was your experience with this transaction?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Product Quality</Label>
              <StarRating 
                value={rating.product_quality} 
                onChange={(v) => setRating({ ...rating, product_quality: v })} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Communication</Label>
              <StarRating 
                value={rating.communication} 
                onChange={(v) => setRating({ ...rating, communication: v })} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Transaction Speed</Label>
              <StarRating 
                value={rating.transaction_speed} 
                onChange={(v) => setRating({ ...rating, transaction_speed: v })} 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Comment (optional)</Label>
              <Textarea
                placeholder="Share your experience..."
                value={rating.comment}
                onChange={(e) => setRating({ ...rating, comment: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowRatingDialog(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={submitRating}>
              Submit Rating
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transactions;
