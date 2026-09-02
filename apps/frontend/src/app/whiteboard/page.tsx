"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SpatialWhiteboard } from "../../components/whiteboard/SpatialWhiteboard";

export default function WhiteboardPage() {
  const router = useRouter();

  return <SpatialWhiteboard onExit={() => router.push("/")} />;
}
