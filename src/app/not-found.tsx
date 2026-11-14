import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-[560px] justify-items-start gap-4 px-4 py-24 sm:px-6">
      <h1 className="text-4xl font-medium">Tokio puslapio nėra</h1>
      <p className="text-ink-2">Nuoroda gali būti pasenusi arba įvesta su klaida. Grįžk į pradžią arba pasirink žaidimą.</p>
      <div className="flex flex-wrap gap-3">
        <Button href="/">Į pradžią</Button>
        <Button href="/zaidimai" variant="ghost">
          Žaidimai
        </Button>
      </div>
    </div>
  );
}
