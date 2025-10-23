-- Add foreign key constraint between farmer_advances and farmers
ALTER TABLE public.farmer_advances
ADD CONSTRAINT farmer_advances_farmer_id_fkey 
FOREIGN KEY (farmer_id) 
REFERENCES public.farmers(id) 
ON DELETE CASCADE;