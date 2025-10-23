-- Fix RLS policies to restrict data access to admin and clerk roles only

-- Drop existing permissive SELECT policies
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON public.cherry_deliveries;
DROP POLICY IF EXISTS "Authenticated users can view advances" ON public.farmer_advances;
DROP POLICY IF EXISTS "Authenticated users can view farmers" ON public.farmers;
DROP POLICY IF EXISTS "Authenticated users can view parch stock" ON public.parch_stock;
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can view wallet transactions" ON public.wallet_transactions;

-- Create new restrictive SELECT policies requiring admin or clerk role
CREATE POLICY "Admins and clerks can view deliveries"
ON public.cherry_deliveries
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can view advances"
ON public.farmer_advances
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can view farmers"
ON public.farmers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can view parch stock"
ON public.parch_stock
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can view payments"
ON public.payments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can view wallet transactions"
ON public.wallet_transactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));