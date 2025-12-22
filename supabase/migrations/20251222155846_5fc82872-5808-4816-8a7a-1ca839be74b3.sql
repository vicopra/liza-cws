
-- Create casual workers table
CREATE TABLE public.casual_workers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  id_number TEXT,
  phone TEXT,
  role TEXT,
  daily_wage NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance records table
CREATE TABLE public.casual_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.casual_workers(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  is_present BOOLEAN NOT NULL DEFAULT false,
  daily_wage NUMERIC NOT NULL,
  notes TEXT,
  recorded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(worker_id, work_date)
);

-- Enable RLS
ALTER TABLE public.casual_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casual_attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies for casual_workers
CREATE POLICY "Admins and clerks can view casual workers"
ON public.casual_workers FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can create casual workers"
ON public.casual_workers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can update casual workers"
ON public.casual_workers FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins can delete casual workers"
ON public.casual_workers FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for casual_attendance
CREATE POLICY "Admins and clerks can view attendance"
ON public.casual_attendance FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can create attendance"
ON public.casual_attendance FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins and clerks can update attendance"
ON public.casual_attendance FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'clerk'::app_role));

CREATE POLICY "Admins can delete attendance"
ON public.casual_attendance FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_casual_workers_updated_at
BEFORE UPDATE ON public.casual_workers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
