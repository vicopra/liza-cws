import { useState } from "react";
import { useStation } from "@/contexts/StationContext";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const StationSelector = () => {
  const { stations, currentStation, setCurrentStation, isAdmin, userStations, loading } = useStation();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-primary-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  const availableStations = isAdmin ? stations : userStations;

  // If only one station available and not admin, show it as static text
  if (availableStations.length === 1 && !isAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/10 text-sm font-medium text-primary-foreground">
        <Building2 className="h-4 w-4" />
        <span>{availableStations[0].name}</span>
      </div>
    );
  }

  const handleSelect = (stationId: string | null) => {
    if (stationId === null) {
      setCurrentStation(null);
    } else {
      const station = availableStations.find(s => s.id === stationId);
      setCurrentStation(station || null);
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="w-[260px] justify-between bg-background/20 border-background/30 text-primary-foreground hover:bg-background/30 hover:text-primary-foreground"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {currentStation ? currentStation.name : "All Stations"}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>Select Station</DialogTitle>
          <DialogDescription>
            Choose a station to filter data
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1 mt-2 max-h-[300px] overflow-y-auto">
          {isAdmin && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={cn(
                "flex items-center justify-between w-full px-3 py-3 text-left rounded-md hover:bg-accent transition-colors text-foreground",
                !currentStation && "bg-accent"
              )}
            >
              <span>All Stations</span>
              {!currentStation && <Check className="h-4 w-4 text-primary" />}
            </button>
          )}
          {availableStations.length === 0 ? (
            <div className="px-3 py-3 text-muted-foreground text-sm">
              No stations available
            </div>
          ) : (
            availableStations.map((station) => (
              <button
                key={station.id}
                type="button"
                onClick={() => handleSelect(station.id)}
                className={cn(
                  "flex items-center justify-between w-full px-3 py-3 text-left rounded-md hover:bg-accent transition-colors text-foreground",
                  currentStation?.id === station.id && "bg-accent"
                )}
              >
                <span>{station.name}</span>
                {currentStation?.id === station.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
