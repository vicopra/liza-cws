-- Create stations table
CREATE TABLE public.stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on stations
ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

-- Insert the two stations
INSERT INTO public.stations (name, code, location) VALUES 
  ('Mururu Coffee Station', 'MUR', 'Mururu'),
  ('Gashonga Coffee Station', 'GAS', 'Gashonga');

-- Create user_station_assignments table to link users to stations
CREATE TABLE public.user_station_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id uuid NOT NULL REFERENCES public.stations(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, station_id)
);

-- Enable RLS on user_station_assignments
ALTER TABLE public.user_station_assignments ENABLE ROW LEVEL SECURITY;

-- Add station_id to farmers
ALTER TABLE public.farmers ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- Add station_id to cherry_deliveries
ALTER TABLE public.cherry_deliveries ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- Add station_id to payments
ALTER TABLE public.payments ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- Add station_id to farmer_advances
ALTER TABLE public.farmer_advances ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- Add station_id to parch_stock
ALTER TABLE public.parch_stock ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- Add station_id to wallet_transactions
ALTER TABLE public.wallet_transactions ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- Add station_id to casual_workers
ALTER TABLE public.casual_workers ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- Add station_id to casual_attendance
ALTER TABLE public.casual_attendance ADD COLUMN station_id uuid REFERENCES public.stations(id);

-- Create function to check if user can access a station
CREATE OR REPLACE FUNCTION public.can_access_station(_user_id uuid, _station_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    -- Admins can access all stations
    has_role(_user_id, 'admin'::app_role)
    OR
    -- Users assigned to this station can access it
    EXISTS (
      SELECT 1 FROM public.user_station_assignments
      WHERE user_id = _user_id AND station_id = _station_id
    )
$$;

-- Create function to get user's accessible station IDs
CREATE OR REPLACE FUNCTION public.get_user_stations(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN has_role(_user_id, 'admin'::app_role) THEN 
      (SELECT id FROM public.stations WHERE is_active = true)
    ELSE
      (SELECT station_id FROM public.user_station_assignments WHERE user_id = _user_id)
  END
$$;

-- Policies for stations table
CREATE POLICY "Everyone can view active stations"
ON public.stations FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage stations"
ON public.stations FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policies for user_station_assignments
CREATE POLICY "Admins can manage station assignments"
ON public.user_station_assignments FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own assignments"
ON public.user_station_assignments FOR SELECT
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Update trigger for stations
CREATE TRIGGER update_stations_updated_at
BEFORE UPDATE ON public.stations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();