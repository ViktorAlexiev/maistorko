"use client";

import { useEffect } from "react";
import "./proto.css";

/** Marks <body> so ./proto.css restyles the real header and footer as the approved „Светла лента“. */
export function HfVariants() {
  useEffect(() => {
    document.body.dataset.hf = "svetla";
    return () => {
      delete document.body.dataset.hf;
    };
  }, []);
  return null;
}
