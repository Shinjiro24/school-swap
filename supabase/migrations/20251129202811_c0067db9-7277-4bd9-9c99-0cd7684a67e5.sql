-- Add new columns to listings for filters and borrowable items
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS class_level text,
ADD COLUMN IF NOT EXISTS subject text,
ADD COLUMN IF NOT EXISTS is_borrowable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS borrow_duration_days integer,
ADD COLUMN IF NOT EXISTS listing_type text DEFAULT 'sale',
ADD COLUMN IF NOT EXISTS payment_method text[] DEFAULT '{}';

-- Create pickup_locations table
CREATE TABLE IF NOT EXISTS public.pickup_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Add pickup location to listings
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS pickup_location_id uuid REFERENCES public.pickup_locations(id);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  status text DEFAULT 'pending',
  transaction_type text DEFAULT 'purchase',
  borrow_due_date timestamptz,
  borrow_returned_at timestamptz,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Create ratings table
CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  rater_id uuid NOT NULL,
  rated_user_id uuid NOT NULL,
  product_quality integer CHECK (product_quality >= 1 AND product_quality <= 5),
  communication integer CHECK (communication >= 1 AND communication <= 5) NOT NULL,
  transaction_speed integer CHECK (transaction_speed >= 1 AND transaction_speed <= 5) NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Anyone can view pickup locations" ON public.pickup_locations;
DROP POLICY IF EXISTS "Admins can manage pickup locations" ON public.pickup_locations;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can create transactions as buyer" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Anyone can view ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can create ratings for their transactions" ON public.ratings;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Pickup locations policies
CREATE POLICY "Anyone can view pickup locations" ON public.pickup_locations FOR SELECT USING (true);
CREATE POLICY "Admins can manage pickup locations" ON public.pickup_locations FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Transactions policies
CREATE POLICY "Users can view their own transactions" ON public.transactions 
FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Users can create transactions as buyer" ON public.transactions 
FOR INSERT WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Users can update their own transactions" ON public.transactions 
FOR UPDATE USING (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Ratings policies
CREATE POLICY "Anyone can view ratings" ON public.ratings FOR SELECT USING (true);

CREATE POLICY "Users can create ratings for their transactions" ON public.ratings 
FOR INSERT WITH CHECK (rater_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications 
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.notifications 
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" ON public.notifications 
FOR INSERT WITH CHECK (true);

-- Insert default pickup locations if table is empty
INSERT INTO public.pickup_locations (name, description) 
SELECT * FROM (VALUES
  ('Aula', 'Main hall - Central meeting point'),
  ('Mensa', 'Cafeteria - During lunch breaks'),
  ('Haupteingang', 'Main entrance - Before/after school'),
  ('Sporthalle', 'Sports hall entrance'),
  ('Bibliothek', 'Library - During opening hours'),
  ('Pausenhof', 'Schoolyard - During breaks')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.pickup_locations LIMIT 1);