import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Station {
  id: string;
  name: string;
  code: string;
  location: string | null;
}

interface StationContextType {
  stations: Station[];
  currentStation: Station | null;
  setCurrentStation: (station: Station | null) => void;
  isAdmin: boolean;
  loading: boolean;
  userStations: Station[];
}

const StationContext = createContext<StationContextType | undefined>(undefined);

export const StationProvider = ({ children }: { children: ReactNode }) => {
  const [stations, setStations] = useState<Station[]>([]);
  const [userStations, setUserStations] = useState<Station[]>([]);
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStationsAndRole();
  }, []);

  const fetchStationsAndRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Check if user is admin
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const userIsAdmin = roleData?.role === 'admin';
      setIsAdmin(userIsAdmin);

      // Fetch all active stations
      const { data: allStations } = await supabase
        .from('stations')
        .select('*')
        .eq('is_active', true)
        .order('name');

      setStations(allStations || []);

      if (userIsAdmin) {
        // Admins can access all stations
        setUserStations(allStations || []);
        // Default to "All Stations" for admin (null means all)
        const savedStationId = localStorage.getItem('currentStationId');
        if (savedStationId && savedStationId !== 'all') {
          const saved = allStations?.find(s => s.id === savedStationId);
          setCurrentStation(saved || null);
        }
      } else {
        // Fetch user's assigned stations
        const { data: assignments } = await supabase
          .from('user_station_assignments')
          .select('station_id')
          .eq('user_id', user.id);

        const assignedStationIds = assignments?.map(a => a.station_id) || [];
        const assignedStations = allStations?.filter(s => assignedStationIds.includes(s.id)) || [];
        setUserStations(assignedStations);

        // Set current station to first assigned station if only one
        if (assignedStations.length === 1) {
          setCurrentStation(assignedStations[0]);
          localStorage.setItem('currentStationId', assignedStations[0].id);
        } else if (assignedStations.length > 0) {
          const savedStationId = localStorage.getItem('currentStationId');
          if (savedStationId) {
            const saved = assignedStations.find(s => s.id === savedStationId);
            setCurrentStation(saved || assignedStations[0]);
          } else {
            setCurrentStation(assignedStations[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCurrentStation = (station: Station | null) => {
    setCurrentStation(station);
    if (station) {
      localStorage.setItem('currentStationId', station.id);
    } else {
      localStorage.setItem('currentStationId', 'all');
    }
  };

  return (
    <StationContext.Provider value={{
      stations,
      currentStation,
      setCurrentStation: handleSetCurrentStation,
      isAdmin,
      loading,
      userStations,
    }}>
      {children}
    </StationContext.Provider>
  );
};

export const useStation = () => {
  const context = useContext(StationContext);
  if (context === undefined) {
    throw new Error('useStation must be used within a StationProvider');
  }
  return context;
};
