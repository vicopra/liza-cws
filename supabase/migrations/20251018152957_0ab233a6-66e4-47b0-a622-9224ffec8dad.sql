-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'clerk', 'viewer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, role)
);

-- Create farmers table
CREATE TABLE public.farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  id_number TEXT,
  village TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create cherry_deliveries table
CREATE TABLE public.cherry_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES public.farmers(id) ON DELETE CASCADE NOT NULL,
  delivery_date DATE DEFAULT CURRENT_DATE NOT NULL,
  quantity_kg DECIMAL(10, 2) NOT NULL CHECK (quantity_kg > 0),
  price_per_kg DECIMAL(10, 2) NOT NULL CHECK (price_per_kg > 0),
  total_amount DECIMAL(10, 2) GENERATED ALWAYS AS (quantity_kg * price_per_kg) STORED,
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES public.farmers(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE DEFAULT CURRENT_DATE NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create parch_stock table
CREATE TABLE public.parch_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date DATE DEFAULT CURRENT_DATE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('input', 'output')),
  quantity_kg DECIMAL(10, 2) NOT NULL CHECK (quantity_kg > 0),
  notes TEXT,
  recorded_by UUID REFERENCES public.profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cherry_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parch_stock ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for farmers
CREATE POLICY "Authenticated users can view farmers"
  ON public.farmers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and clerks can manage farmers"
  ON public.farmers FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'clerk')
  );

-- RLS Policies for cherry_deliveries
CREATE POLICY "Authenticated users can view deliveries"
  ON public.cherry_deliveries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and clerks can create deliveries"
  ON public.cherry_deliveries FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'clerk')
  );

CREATE POLICY "Admins and clerks can update deliveries"
  ON public.cherry_deliveries FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'clerk')
  );

CREATE POLICY "Admins can delete deliveries"
  ON public.cherry_deliveries FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for payments
CREATE POLICY "Authenticated users can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and clerks can create payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'clerk')
  );

CREATE POLICY "Admins and clerks can update payments"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'clerk')
  );

CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for parch_stock
CREATE POLICY "Authenticated users can view parch stock"
  ON public.parch_stock FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins and clerks can manage parch stock"
  ON public.parch_stock FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'clerk')
  );

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_farmers_updated_at
  BEFORE UPDATE ON public.farmers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cherry_deliveries_updated_at
  BEFORE UPDATE ON public.cherry_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone'
  );
  
  -- Assign default role as clerk
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'clerk');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();