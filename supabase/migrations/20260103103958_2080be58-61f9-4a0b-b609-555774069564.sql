-- Drop existing RLS policies and recreate with station filtering

-- FARMERS: Update policies
DROP POLICY IF EXISTS "Admins and clerks can manage farmers" ON public.farmers;
DROP POLICY IF EXISTS "Admins and clerks can view farmers" ON public.farmers;

CREATE POLICY "Users can view farmers in their stations"
ON public.farmers FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    (has_role(auth.uid(), 'clerk'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can create farmers in their stations"
ON public.farmers FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can update farmers in their stations"
ON public.farmers FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Admins can delete farmers"
ON public.farmers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- CHERRY_DELIVERIES: Update policies
DROP POLICY IF EXISTS "Admins and clerks can create deliveries" ON public.cherry_deliveries;
DROP POLICY IF EXISTS "Admins and clerks can update deliveries" ON public.cherry_deliveries;
DROP POLICY IF EXISTS "Admins and clerks can view deliveries" ON public.cherry_deliveries;
DROP POLICY IF EXISTS "Admins can delete deliveries" ON public.cherry_deliveries;

CREATE POLICY "Users can view deliveries in their stations"
ON public.cherry_deliveries FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    (has_role(auth.uid(), 'clerk'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can create deliveries in their stations"
ON public.cherry_deliveries FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can update deliveries in their stations"
ON public.cherry_deliveries FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Admins can delete deliveries"
ON public.cherry_deliveries FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- PAYMENTS: Update policies
DROP POLICY IF EXISTS "Admins and clerks can create payments" ON public.payments;
DROP POLICY IF EXISTS "Admins and clerks can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins and clerks can view payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;

CREATE POLICY "Users can view payments in their stations"
ON public.payments FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    (has_role(auth.uid(), 'clerk'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can create payments in their stations"
ON public.payments FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can update payments in their stations"
ON public.payments FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Admins can delete payments"
ON public.payments FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- FARMER_ADVANCES: Update policies
DROP POLICY IF EXISTS "Admins and clerks can create advances" ON public.farmer_advances;
DROP POLICY IF EXISTS "Admins and clerks can update advances" ON public.farmer_advances;
DROP POLICY IF EXISTS "Admins and clerks can view advances" ON public.farmer_advances;
DROP POLICY IF EXISTS "Admins can delete advances" ON public.farmer_advances;

CREATE POLICY "Users can view advances in their stations"
ON public.farmer_advances FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    (has_role(auth.uid(), 'clerk'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can create advances in their stations"
ON public.farmer_advances FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can update advances in their stations"
ON public.farmer_advances FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Admins can delete advances"
ON public.farmer_advances FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- PARCH_STOCK: Update policies
DROP POLICY IF EXISTS "Admins and clerks can manage parch stock" ON public.parch_stock;
DROP POLICY IF EXISTS "Admins and clerks can view parch stock" ON public.parch_stock;

CREATE POLICY "Users can view stock in their stations"
ON public.parch_stock FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    (has_role(auth.uid(), 'clerk'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can create stock in their stations"
ON public.parch_stock FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can update stock in their stations"
ON public.parch_stock FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Admins can delete stock"
ON public.parch_stock FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- WALLET_TRANSACTIONS: Update policies
DROP POLICY IF EXISTS "Admins and clerks can create wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins and clerks can view wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can delete wallet transactions" ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can update wallet transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view wallet transactions in their stations"
ON public.wallet_transactions FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    (has_role(auth.uid(), 'clerk'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can create wallet transactions in their stations"
ON public.wallet_transactions FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
    AND recorded_by = auth.uid()
  )
);

CREATE POLICY "Admins can update wallet transactions"
ON public.wallet_transactions FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete wallet transactions"
ON public.wallet_transactions FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- CASUAL_WORKERS: Update policies
DROP POLICY IF EXISTS "Admins and clerks can create casual workers" ON public.casual_workers;
DROP POLICY IF EXISTS "Admins and clerks can update casual workers" ON public.casual_workers;
DROP POLICY IF EXISTS "Admins and clerks can view casual workers" ON public.casual_workers;
DROP POLICY IF EXISTS "Admins can delete casual workers" ON public.casual_workers;

CREATE POLICY "Users can view workers in their stations"
ON public.casual_workers FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    (has_role(auth.uid(), 'clerk'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can create workers in their stations"
ON public.casual_workers FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can update workers in their stations"
ON public.casual_workers FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Admins can delete workers"
ON public.casual_workers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- CASUAL_ATTENDANCE: Update policies
DROP POLICY IF EXISTS "Admins and clerks can create attendance" ON public.casual_attendance;
DROP POLICY IF EXISTS "Admins and clerks can update attendance" ON public.casual_attendance;
DROP POLICY IF EXISTS "Admins and clerks can view attendance" ON public.casual_attendance;
DROP POLICY IF EXISTS "Admins can delete attendance" ON public.casual_attendance;

CREATE POLICY "Users can view attendance in their stations"
ON public.casual_attendance FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    (has_role(auth.uid(), 'clerk'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can create attendance in their stations"
ON public.casual_attendance FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Users can update attendance in their stations"
ON public.casual_attendance FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (
    has_role(auth.uid(), 'clerk'::app_role)
    AND can_access_station(auth.uid(), station_id)
  )
);

CREATE POLICY "Admins can delete attendance"
ON public.casual_attendance FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));