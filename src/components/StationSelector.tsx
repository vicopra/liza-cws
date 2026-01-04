import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStation } from "@/contexts/StationContext";
import { Building2 } from "lucide-react";

export const StationSelector = () => {
  const { stations, currentStation, setCurrentStation, isAdmin, userStations, loading } = useStation();

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    );
  }

  const availableStations = isAdmin ? stations : userStations;

  // If only one station available, show it as static text
  if (availableStations.length === 1 && !isAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-sm font-medium">
        <Building2 className="h-4 w-4 text-primary" />
        <span>{availableStations[0].name}</span>
      </div>
    );
  }

  return (
    <Select
      value={currentStation?.id || "all"}
      onValueChange={(value) => {
        if (value === "all") {
          setCurrentStation(null);
        } else {
          const station = availableStations.find(s => s.id === value);
          setCurrentStation(station || null);
        }
      }}
    >
      <SelectTrigger className="w-[200px] bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground">
        <Building2 className="h-4 w-4 mr-2" />
        <SelectValue placeholder="Select station" />
      </SelectTrigger>
      <SelectContent 
        position="popper" 
        sideOffset={5}
        className="bg-popover border shadow-lg"
      >
        {isAdmin && (
          <SelectItem value="all">All Stations</SelectItem>
        )}
        {availableStations.map((station) => (
          <SelectItem key={station.id} value={station.id}>
            {station.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
