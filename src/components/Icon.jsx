import React from "react";
import * as P from "@phosphor-icons/react";
export default function Icon({
  name,
  size = 18,
  weight = "duotone",
  ...props
}) {
  const C = P[name] || P.Circle;
  return <C size={size} weight={weight} {...props} />;
}
