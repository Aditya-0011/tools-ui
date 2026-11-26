import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

type ListSearchProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function ListSearch({
  label,
  placeholder,
  value,
  onChange,
  className,
}: ListSearchProps) {
  return (
    <div className="relative w-full">
      <Search
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
      />
      <Input
        type="search"
        name="search"
        aria-label={label}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      />
    </div>
  );
}
