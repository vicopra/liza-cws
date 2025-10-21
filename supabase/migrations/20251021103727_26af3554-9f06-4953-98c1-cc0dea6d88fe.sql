-- Create wallet_transactions table to track cash flow
CREATE TABLE public.wallet_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'payment')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  notes TEXT,
  recorded_by UUID NOT NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('deposit', 'payment'))
);

-- Enable RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for wallet_transactions
CREATE POLICY "Authenticated users can view wallet transactions"
  ON public.wallet_transactions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and clerks can create wallet transactions"
  ON public.wallet_transactions
  FOR INSERT
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role))
    AND recorded_by = auth.uid()
  );

CREATE POLICY "Admins can update wallet transactions"
  ON public.wallet_transactions
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete wallet transactions"
  ON public.wallet_transactions
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create function to calculate current wallet balance
CREATE OR REPLACE FUNCTION public.get_wallet_balance()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(CASE 
      WHEN transaction_type = 'deposit' THEN amount
      WHEN transaction_type = 'payment' THEN -amount
      ELSE 0
    END), 
    0
  )
  FROM public.wallet_transactions;
$$;

-- Create function to get total coffee sold (sum of all cherry deliveries)
CREATE OR REPLACE FUNCTION public.get_total_coffee_sold()
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity_kg), 0)
  FROM public.cherry_deliveries;
$$;