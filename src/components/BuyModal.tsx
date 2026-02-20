import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Smartphone, Banknote, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BuyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: {
    id: string;
    title: string;
    price: number;
    seller_id: string;
    payment_method?: string[];
    listing_type?: string;
    borrow_duration_days?: number;
  };
  userId: string;
  onSuccess: () => void;
}

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  visa: <CreditCard className="w-4 h-4" />,
  apple_pay: <Smartphone className="w-4 h-4" />,
  cash: <Banknote className="w-4 h-4" />,
};

const PAYMENT_LABELS: Record<string, string> = {
  visa: 'Visa/Kreditkarte',
  apple_pay: 'Apple Pay',
  cash: 'Barzahlung in der Schule',
};

const BuyModal = ({ open, onOpenChange, listing, userId, onSuccess }: BuyModalProps) => {
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locations, setLocations] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(true);

  const isBorrow = listing.listing_type === 'borrow';
  const availablePayments = listing.payment_method?.length ? listing.payment_method : ['cash'];

  // Fetch pickup locations when modal opens
  useEffect(() => {
    const fetchLocations = async () => {
      const { data } = await supabase.from('pickup_locations').select('*');
      if (data) setLocations(data);
      setLoadingLocations(false);
    };
    if (open) {
      fetchLocations();
    }
  }, [open]);

  const handlePurchase = async () => {
    if (!selectedPayment) {
      toast.error('Bitte wähle eine Zahlungsmethode');
      return;
    }

    if (selectedPayment === 'cash' && !selectedLocation) {
      toast.error('Bitte wähle einen Abholort');
      return;
    }

    setLoading(true);

    try {
      // Create transaction
      const transactionData: any = {
        listing_id: listing.id,
        buyer_id: userId,
        seller_id: listing.seller_id,
        amount: isBorrow ? 0 : listing.price,
        payment_method: selectedPayment,
        status: 'pending',
        transaction_type: isBorrow ? 'borrow' : 'purchase',
      };

      if (isBorrow && listing.borrow_duration_days) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + listing.borrow_duration_days);
        transactionData.borrow_due_date = dueDate.toISOString();
      }

      const { error: transactionError } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (transactionError) throw transactionError;

      // Create notification for seller
      await supabase.from('notifications').insert({
        user_id: listing.seller_id,
        type: isBorrow ? 'borrow_request' : 'purchase',
        title: isBorrow ? 'Jemand möchte deinen Artikel ausleihen!' : 'Du hast einen neuen Käufer!',
        message: `Jemand möchte dein Inserat "${listing.title}" ${isBorrow ? 'ausleihen' : 'kaufen'}${selectedPayment === 'cash' ? '. Treffe dich am gewählten Abholort.' : '.'}`,
        listing_id: listing.id,
      });

      // Send message to seller
      await supabase.from('messages').insert({
        listing_id: listing.id,
        sender_id: userId,
        receiver_id: listing.seller_id,
        content: `Hallo! Ich möchte "${listing.title}" ${isBorrow ? 'ausleihen' : 'kaufen'}${selectedPayment === 'cash' ? ` und mich treffen bei ${locations.find(l => l.id === selectedLocation)?.name || 'der Schule'}` : ''}.${isBorrow ? ` Ich gebe es innerhalb von ${listing.borrow_duration_days} Tagen zurück.` : ''} Lass mich wissen, wann es passt!`,
      });

      toast.success(isBorrow ? 'Ausleihantrag gesendet!' : 'Kauf eingeleitet! Kontaktiere den Verkäufer zur Bezahlung.');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating transaction:', error);
      toast.error('Verarbeitung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isBorrow ? 'Artikel ausleihen' : 'Artikel kaufen'}</DialogTitle>
          <DialogDescription>
            {isBorrow 
              ? `Antrag auf Ausleihe von "${listing.title}" für ${listing.borrow_duration_days || 7} Tage`
              : `"${listing.title}" für €${listing.price.toFixed(2)} kaufen`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!isBorrow && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Zahlungsmethode</Label>
              <RadioGroup value={selectedPayment} onValueChange={setSelectedPayment}>
                {availablePayments.map((method) => (
                  <div key={method} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <RadioGroupItem value={method} id={method} />
                    <Label htmlFor={method} className="flex items-center gap-2 cursor-pointer flex-1">
                      {PAYMENT_ICONS[method]}
                      {PAYMENT_LABELS[method] || method}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {isBorrow && (
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Dieser Artikel ist kostenlos ausleihbar. Du musst ihn innerhalb von {listing.borrow_duration_days || 7} Tagen zurückgeben.
              </p>
            </div>
          )}

          {(selectedPayment === 'cash' || isBorrow) && (
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Abholort
              </Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Abholort auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                      {location.description && (
                        <span className="text-muted-foreground ml-2">- {location.description}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="font-medium">Gesamt</span>
              <span className="text-2xl font-bold text-primary">
                {isBorrow ? 'Kostenlos' : `€${listing.price.toFixed(2)}`}
              </span>
            </div>

            <Button 
              className="w-full" 
              onClick={handlePurchase}
              disabled={loading || (!isBorrow && !selectedPayment) || ((selectedPayment === 'cash' || isBorrow) && !selectedLocation)}
            >
              {loading ? 'Verarbeitung...' : isBorrow ? 'Ausleihe anfragen' : 'Kauf bestätigen'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BuyModal;
