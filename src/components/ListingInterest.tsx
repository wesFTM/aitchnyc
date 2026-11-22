"use client";

import { useState } from "react";
import { LikeButton } from "@/components/LikeButton";
import { RequestTourButton } from "@/components/RequestTourButton";

export function ListingInterest({
  propertyId,
  name,
  liked,
  tourRequested,
  likeEndpoint,
  tourEndpoint,
}: {
  propertyId: string;
  name: string;
  liked: boolean;
  tourRequested: boolean;
  likeEndpoint: string;
  tourEndpoint: string;
}) {
  const [on, setOn] = useState(liked);
  const [tour, setTour] = useState(tourRequested);

  function onLiked(next: boolean) {
    setOn(next);
    if (!next) setTour(false);
  }

  return (
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
          onChange={setTour}
        />
      )}
    </div>
  );
}
