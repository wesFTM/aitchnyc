"use client";

import { useState } from "react";
import { LikeButton } from "@/components/LikeButton";
import { RequestTourButton } from "@/components/RequestTourButton";
import { TourScheduleNote } from "@/components/TourScheduleNote";

export function ListingInterest({
  propertyId,
  name,
  liked,
  tourRequested,
  tourScheduledAt,
  likeEndpoint,
  tourEndpoint,
}: {
  propertyId: string;
  name: string;
  liked: boolean;
  tourRequested: boolean;
  tourScheduledAt: string | null;
  likeEndpoint: string;
  tourEndpoint: string;
}) {
  const [on, setOn] = useState(liked);
  const [tour, setTour] = useState(tourRequested);
  const [scheduledAt, setScheduledAt] = useState(tourScheduledAt);

  function onLiked(next: boolean) {
    setOn(next);
    if (!next) {
      setTour(false);
      setScheduledAt(null);
    }
  }

  function onTour(next: boolean) {
    setTour(next);
    if (!next) setScheduledAt(null);
  }

  return (
    <div className="space-y-2">
      {on && tour && scheduledAt && <TourScheduleNote scheduledAt={scheduledAt} />}
      <div className="flex flex-wrap items-center gap-2">
        <LikeButton
          propertyId={propertyId}
          name={name}
          liked={liked}
          endpoint={likeEndpoint}
          variant="label"
          onChange={onLiked}
        />
        {on && (
          <RequestTourButton
            propertyId={propertyId}
            name={name}
            requested={tour}
            endpoint={tourEndpoint}
            onChange={onTour}
          />
        )}
      </div>
    </div>
  );
}
