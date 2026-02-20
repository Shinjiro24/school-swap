import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import ImageUpload from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { z } from 'zod';
import { BookOpen, FileText } from 'lucide-react';

const CATEGORIES = ['books', 'notebooks', 'calculators', 'supplies', 'stationery', 'other'];
const BORROW_CATEGORIES = ['study_notes', 'worksheets', 'posters'];

const CLASS_LEVELS = ['7', '8', '9', '10', '11', '12'];

const SUBJECTS = [
  'Mathematik', 'Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Latein',
  'Physik', 'Chemie', 'Biologie', 'Geschichte', 'Geographie', 'Politik',
  'Kunst', 'Musik', 'Sport', 'Informatik', 'Wirtschaft', 'Sonstiges'
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Barzahlung' },
  { id: 'visa', label: 'Visa / Kreditkarte' },
  { id: 'apple_pay', label: 'Apple Pay' },
  { id: 'paypal', label: 'PayPal' },
];

interface PickupLocation {
  id: string;
  name: string;
  description: string;
}

const listingSchema = z.object({
  title: z.string().trim().min(3, 'Titel muss mindestens 3 Zeichen haben').max(100, 'Titel zu lang'),
  description: z.string().trim().min(10, 'Beschreibung muss mindestens 10 Zeichen haben').max(1000, 'Beschreibung zu lang'),
  price: z.number().min(0, 'Preis muss positiv sein').max(10000, 'Preis zu hoch'),
  category: z.string().min(1, 'Bitte wähle eine Kategorie')
});

const CreateListing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [listingType, setListingType] = useState<'sale' | 'borrow'>('sale');
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    class_level: '',
    subject: '',
    pickup_location_id: '',
    payment_methods: [] as string[],
    borrow_duration_days: '7'
  });

  useEffect(() => {
    fetchPickupLocations();
  }, []);

  const fetchPickupLocations = async () => {
    const { data } = await supabase
      .from('pickup_locations')
      .select('*')
      .order('name');
    
    if (data) {
      setPickupLocations(data);
    }
  };

  const handleImagesChange = (newImages: File[], newPreviews: string[]) => {
    setImages(newImages);
    setPreviews(newPreviews);
  };

  const handlePaymentMethodChange = (methodId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      payment_methods: checked 
        ? [...prev.payment_methods, methodId]
        : prev.payment_methods.filter(m => m !== methodId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const price = listingType === 'borrow' ? 0 : parseFloat(formData.price);
      
      const validated = listingSchema.parse({
        ...formData,
        price
      });

      if (images.length === 0) {
        toast.error('Bitte füge mindestens ein Bild hinzu');
        setLoading(false);
        return;
      }

      // Upload images
      const imageUrls: string[] = [];
      for (const image of images) {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, image);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('listing-images').getPublicUrl(fileName);
        imageUrls.push(data.publicUrl);
      }

      // Create listing
      const { error } = await supabase.from('listings').insert([{
        title: validated.title,
        description: validated.description,
        price: validated.price,
        category: validated.category,
        seller_id: user.id,
        images: imageUrls,
        status: 'pending',
        listing_type: listingType,
        class_level: formData.class_level || null,
        subject: formData.subject || null,
        pickup_location_id: formData.pickup_location_id || null,
        payment_method: listingType === 'sale' ? formData.payment_methods : [],
        is_borrowable: listingType === 'borrow',
        borrow_duration_days: listingType === 'borrow' ? parseInt(formData.borrow_duration_days) : null
      }]);

      if (error) throw error;

      toast.success('Inserat erstellt! Warte auf Admin-Genehmigung.');
      navigate('/my-listings');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error creating listing:', error);
        toast.error('Inserat konnte nicht erstellt werden');
      }
    } finally {
      setLoading(false);
    }
  };

  const categories = listingType === 'borrow' ? BORROW_CATEGORIES : CATEGORIES;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Neues Inserat erstellen</CardTitle>
            <CardDescription>Dein Inserat wird von einem Admin geprüft, bevor es veröffentlicht wird</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Listing Type Tabs */}
            <Tabs value={listingType} onValueChange={(v) => setListingType(v as 'sale' | 'borrow')} className="mb-6">
              <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sale" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Artikel verkaufen
              </TabsTrigger>
              <TabsTrigger value="borrow" className="gap-2">
                <FileText className="w-4 h-4" />
                Lernzettel verleihen
              </TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  placeholder={listingType === 'borrow' ? 'z.B. Mathe-Notizen Kapitel 5' : 'z.B. Analysis Lehrbuch'}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung *</Label>
                <Textarea
                  id="description"
                  placeholder={listingType === 'borrow' 
                    ? 'Beschreibe deine Notizen, behandelte Themen usw...'
                    : 'Beschreibe den Zustand, etwaige Markierungen usw...'}
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {listingType === 'sale' && (
                  <div className="space-y-2">
                    <Label htmlFor="price">Preis (€) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                )}

                {listingType === 'borrow' && (
                  <div className="space-y-2">
                    <Label htmlFor="duration">Ausleihzeit (Tage)</Label>
                    <Select 
                      value={formData.borrow_duration_days} 
                      onValueChange={(value) => setFormData({ ...formData, borrow_duration_days: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Dauer auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 Tage</SelectItem>
                        <SelectItem value="7">1 Woche</SelectItem>
                        <SelectItem value="14">2 Wochen</SelectItem>
                        <SelectItem value="30">1 Monat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Class Level & Subject Filters */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                <Label htmlFor="class_level">Klassenstufe (optional)</Label>
                  <Select value={formData.class_level || 'none'} onValueChange={(value) => setFormData({ ...formData, class_level: value === 'none' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Klasse auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht angegeben</SelectItem>
                      {CLASS_LEVELS.map(level => (
                        <SelectItem key={level} value={level}>
                          Klasse {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                <Label htmlFor="subject">Fach (optional)</Label>
                  <Select value={formData.subject || 'none'} onValueChange={(value) => setFormData({ ...formData, subject: value === 'none' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Fach auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht angegeben</SelectItem>
                      {SUBJECTS.map(subject => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Pickup Location */}
              <div className="space-y-2">
                <Label htmlFor="pickup_location">Abholort (optional)</Label>
                <Select 
                  value={formData.pickup_location_id || 'none'} 
                  onValueChange={(value) => setFormData({ ...formData, pickup_location_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Wo können Käufer abholen?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein bestimmter Ort</SelectItem>
                    {pickupLocations.map(location => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} - {location.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Methods (only for sale) */}
              {listingType === 'sale' && (
                <div className="space-y-3">
                  <Label>Akzeptierte Zahlungsmethoden</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {PAYMENT_METHODS.map(method => (
                      <div key={method.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={method.id}
                          checked={formData.payment_methods.includes(method.id)}
                          onCheckedChange={(checked) => handlePaymentMethodChange(method.id, checked as boolean)}
                        />
                        <label
                          htmlFor={method.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {method.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Bilder * (1–5 Bilder)</Label>
                <ImageUpload
                  images={images}
                  previews={previews}
                  onChange={handleImagesChange}
                  maxImages={5}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Wird erstellt...' : listingType === 'borrow' ? 'Ausleihbares Inserat erstellen' : 'Inserat erstellen'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateListing;
