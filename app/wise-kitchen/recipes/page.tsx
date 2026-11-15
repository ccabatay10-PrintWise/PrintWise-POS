import { redirect } from "next/navigation";

export default function LegacyRecipeManagerRoute() {
  redirect("/inventory?tab=recipes");
}
