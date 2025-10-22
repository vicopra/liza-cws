-- Create farmer_advances table
CREATE TABLE public.farmer_advances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  amount_recovered NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purpose TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  recorded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on farmer_advances
ALTER TABLE public.farmer_advances ENABLE ROW LEVEL SECURITY;

-- RLS policies for farmer_advances
CREATE POLICY "Authenticated users can view advances"
ON public.farmer_advances
FOR SELECT
USING (true);

CREATE POLICY "Admins and clerks can create advances"
ON public.farmer_advances
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can update advances"
ON public.farmer_advances
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins can delete advances"
ON public.farmer_advances
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add columns to cherry_deliveries for payment tracking
ALTER TABLE public.cherry_deliveries 
ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN advance_deducted NUMERIC DEFAULT 0,
ADD COLUMN payment_due NUMERIC DEFAULT 0;

-- Function to get farmer's total advance balance
CREATE OR REPLACE FUNCTION public.get_farmer_advance_balance(farmer_uuid UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(balance), 0)
  FROM public.farmer_advances
  WHERE farmer_id = farmer_uuid AND status = 'active';
$$;

-- Function to get total advances owed to CWS
CREATE OR REPLACE FUNCTION public.get_total_advances_owed()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(balance), 0)
  FROM public.farmer_advances
  WHERE status = 'active';
$$;

-- Function to get amount owed to farmers
CREATE OR REPLACE FUNCTION public.get_amount_owed_to_farmers()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(payment_due), 0)
  FROM public.cherry_deliveries
  WHERE payment_status = 'pending';
$$;

-- Create trigger for updating farmer_advances updated_at
CREATE TRIGGER update_farmer_advances_updated_at
BEFORE UPDATE ON public.farmer_advances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();