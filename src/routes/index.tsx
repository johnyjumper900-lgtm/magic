import { createFileRoute } from "@tanstack/react-router";
import MagicApp from "@/components/magic-page/MagicApp";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return <MagicApp />;
}
