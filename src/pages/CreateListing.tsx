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
  'Mathematics', 'German', 'English', 'French', 'Spanish', 'Latin',
  'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Politics',
  'Art', 'Music', 'Sports', 'Computer Science', 'Economics', 'Other'
];

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash (Barzahlung)' },
  { id: 'visa', label: 'Visa / Credit Card' },
  { id: 'apple_pay', label: 'Apple Pay' },
  { id: 'paypal', label: 'PayPal' },
];

interface PickupLocation {
  id: string;
  name: string;
  description: string;
}

const listingSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100, 'Title too long'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(1000, 'Description too long'),
  price: z.number().min(0, 'Price must be positive').max(10000, 'Price too high'),
  category: z.string().min(1, 'Please select a category')
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
        toast.error('Please add at least one image');
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

      toast.success('Listing created! Waiting for admin approval.');
      navigate('/my-listings');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error('Error creating listing:', error);
        toast.error('Failed to create listing');
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
            <CardTitle>Create New Listing</CardTitle>
            <CardDescription>Your listing will be reviewed by an admin before it goes live</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Listing Type Tabs */}
            <Tabs value={listingType} onValueChange={(v) => setListingType(v as 'sale' | 'borrow')} className="mb-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="sale" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  Sell Item
                </TabsTrigger>
                <TabsTrigger value="borrow" className="gap-2">
                  <FileText className="w-4 h-4" />
                  Lend Notes (Verleihen)
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder={listingType === 'borrow' ? 'e.g., Math Notes Chapter 5' : 'e.g., Calculus Textbook'}
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  placeholder={listingType === 'borrow' 
                    ? 'Describe your notes, topics covered, etc...'
                    : 'Describe the condition, any markings, etc...'}
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {listingType === 'sale' && (
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (€) *</Label>
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
                    <Label htmlFor="duration">Borrow Duration (days)</Label>
                    <Select 
                      value={formData.borrow_duration_days} 
                      onValueChange={(value) => setFormData({ ...formData, borrow_duration_days: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 days</SelectItem>
                        <SelectItem value="7">1 week</SelectItem>
                        <SelectItem value="14">2 weeks</SelectItem>
                        <SelectItem value="30">1 month</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
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
                  <Label htmlFor="class_level">Class Level (optional)</Label>
                  <Select value={formData.class_level || 'none'} onValueChange={(value) => setFormData({ ...formData, class_level: value === 'none' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      {CLASS_LEVELS.map(level => (
                        <SelectItem key={level} value={level}>
                          Class {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject (optional)</Label>
                  <Select value={formData.subject || 'none'} onValueChange={(value) => setFormData({ ...formData, subject: value === 'none' ? '' : value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
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
                <Label htmlFor="pickup_location">Pickup Location (optional)</Label>
                <Select 
                  value={formData.pickup_location_id || 'none'} 
                  onValueChange={(value) => setFormData({ ...formData, pickup_location_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Where can buyers pick up?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific location</SelectItem>
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
                  <Label>Accepted Payment Methods</Label>
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
                <Label>Images * (1-5 images)</Label>
                <ImageUpload
                  images={images}
                  previews={previews}
                  onChange={handleImagesChange}
                  maxImages={5}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating...' : listingType === 'borrow' ? 'Create Borrowable Listing' : 'Create Listing'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateListing;
